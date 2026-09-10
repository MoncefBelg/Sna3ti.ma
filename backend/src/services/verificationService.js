const { AppError } = require("../utils/AppError");
const { listScope, canReadRecord } = require("./billingAccess");
const subscriptionSvc = require("./subscriptionService");
const notificationSvc = require("./notificationService");

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ─── List / get / create (req 17) ───────────────────────────────────────────
async function list(repos, query = {}, actor) {
  // REQ 57-D: staff may list all verification requests; a professional owner
  // sees only their own requests; anonymous/unrelated callers are denied.
  const scope = await listScope(repos, actor);
  if (!scope) throw new AppError("Accès non autorisé.", 403);
  const rows = await repos.verification.listByStatus(query.status || "all");
  const scoped = scope.professionalId ? rows.filter((r) => r.professionalId === scope.professionalId) : rows;
  const total = scoped.length;
  const page = toInt(query.page, 1);
  const limit = Math.min(toInt(query.limit, 20), 100);
  const pages = Math.max(1, Math.ceil(total / limit));
  const data = scoped.slice((page - 1) * limit, page * limit);
  return { data, pagination: { page, limit, total, pages } };
}

async function get(repos, id, actor) {
  const vr = await repos.verification.get(id);
  if (!vr) throw new AppError("Demande de vérification introuvable.", 404);
  // REQ 57-D: staff with verification.view, or the owning professional.
  const allowed = await canReadRecord(repos, actor, "verification.view", vr.professionalId);
  if (!allowed) throw new AppError("Accès non autorisé.", 403);
  return vr;
}

// Creates a verification request. Verification is INDEPENDENT of any
// subscription (req 18): this does not touch subscription or payment state.
async function create(repos, data) {
  if (!data.professionalId) throw new AppError("professionalId requis.", 400);
  if (!data.level) throw new AppError("level requis.", 400);
  if (!["join", "identity", "professionnel", "plan"].includes(data.level)) {
    throw new AppError("Level invalide.", 400);
  }
  const id = await repos.ids.nextId("verification");
  const vr = await repos.verification.create({
    id,
    professionalId: data.professionalId,
    level: data.level,
    planId: data.planId || null,
    requestedPlan: data.requestedPlan || null,
    status: "pending",
    priority: data.priority || "medium",
    submitted: new Date(),
    history: [{ date: new Date().toISOString(), text: "Demande créée" }],
    createdAt: new Date()
  });

  // Every verification request (join / identity / professionnel / plan) is
  // surfaced as an admin notification so the review workflow is never silent.
  const typeByLevel = { join: "verification", identity: "verification", professionnel: "verification", plan: "subscription" };
  let name = null;
  try {
    const pro = await repos.professionals.get(vr.professionalId);
    name = pro ? pro.name : null;
  } catch (e) { /* ignore */ }
  await notificationSvc.notifyAdmin(repos, {
    type: typeByLevel[vr.level] || "system",
    title: vr.level === "plan" ? "Nouvelle demande d'abonnement payant" : "Nouvelle demande de vérification",
    message: vr.level === "plan"
      ? `${name || "Un professionnel"} a demandé le plan ${vr.requestedPlan || vr.planId || "payant"}.`
      : `${name || "Un professionnel"} (${vr.professionalId}) a soumis une demande : ${vr.level}.`,
    entityType: "VerificationRequest",
    entityId: vr.id
  });
  return vr;
}


// ─── Scenario A: approve verification ────────────────────────────────────────
// • plan-level request: activates the requested subscription; badge unchanged
// • identity / professionnel: grants the verified badge; subscription untouched
// • join: activates the free subscription; NEVER publishes (REQ 57-E)
// • approval never touches payment status
async function approve(repos, requestId, admin) {
  const vr = await repos.verification.get(requestId);
  if (!vr) throw new AppError("Demande de vérification introuvable.", 404);
  if (vr.status === "approved") throw new AppError("Demande déjà approuvée.", 409);

  const now = new Date();

  // ── Plan request (VÉRIFIÉ / GOLD) ────────────────────────────────────────
  if (vr.level === "plan") {
    await repos.verification.update(requestId, {
      status: "approved",
      reviewedAt: now,
      reviewerId: admin.id,
      reviewerName: admin.name,
      history: [...(vr.history || []), { date: now.toISOString(), text: `Plan activé — ${vr.requestedPlan || vr.planId || ""}` }]
    });

    // Update professional: planEligible + ACTIVATE the requested subscription.
    await repos.professionals.update(vr.professionalId, { planEligible: true });
    if (vr.planId) {
      const plan = await repos.plans.get(vr.planId);
      if (plan) await subscriptionSvc.activateForProfessional(repos, vr.professionalId, plan, { audit: true, admin });
    }

    // Audit + professional's verification badge remains unchanged (independence rule).
    await repos.auditLogs.log({
      adminId: admin.id, adminName: admin.name,
      action: "VERIFICATION_APPROVED", entity: "VerificationRequest",
      entityId: requestId, result: "Approved"
    });
    await notificationSvc.notifyAdmin(repos, {
      type: "subscription",
      title: "Plan activé",
      message: `${vr.professionalId} — plan ${vr.requestedPlan || vr.planId || ""} activé`,
      entityType: "VerificationRequest",
      entityId: requestId
    });
    return repos.verification.get(requestId);
  }

  // ── Join request ──────────────────────────────────────────────────────────
  if (vr.level === "join") {
    await repos.verification.update(requestId, {
      status: "approved", reviewedAt: now, reviewerId: admin.id, reviewerName: admin.name,
      history: [...(vr.history || []), { date: now.toISOString(), text: `Adhésion confirmée par ${admin.name}` }]
    });
    // REQ 57-E: approval MUST NOT publish. The FREE subscription is activated
    // so the account is usable, but the professional STAYS PENDING in the
    // marketplace until an authorized admin activates it explicitly
    // (POST /admin/professionals/:id/activate).
    const freePlan = await repos.plans.find({ code: "free" }) || await repos.plans.get("PLAN-FREE");
    if (freePlan) await subscriptionSvc.activateForProfessional(repos, vr.professionalId, freePlan, { audit: true, admin });
    await repos.auditLogs.log({
      adminId: admin.id, adminName: admin.name,
      action: "JOIN_APPROVED", entity: "VerificationRequest",
      entityId: requestId, result: "Approved",
      metadata: { note: "Professional remains pending; publication requires admin activation" }
    });
    await notificationSvc.notifyAdmin(repos, {
      type: "verification",
      title: "Adhésion confirmée",
      message: `${vr.professionalId} — adhésion approuvée. Abonnement FREE activé.`,
      entityType: "VerificationRequest",
      entityId: requestId
    });
    return repos.verification.get(requestId);
  }

  // ── Identity / professionnel badge (NEVER touches subscription) ───────────
  await repos.verification.update(requestId, {
    status: "approved", reviewedAt: now, reviewerId: admin.id, reviewerName: admin.name,
    history: [...(vr.history || []), { date: now.toISOString(), text: `Approuvée par ${admin.name}` }]
  });

  const proUpdates = { verificationStatus: "approved", verified: true };
  if (vr.level === "professionnel") proUpdates.professionStatus = "verified";
  else proUpdates.identityStatus = "verified";
  await repos.professionals.update(vr.professionalId, proUpdates);

  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "VERIFICATION_APPROVED", entity: "VerificationRequest",
    entityId: requestId, result: "Approved"
  });
  await notificationSvc.notifyAdmin(repos, {
    type: "verification",
    title: "Vérification approuvée",
    message: `${vr.professionalId} — badge ${vr.level} ${vr.level === "professionnel" ? "professionnel" : "d'identité"} accordé.`,
    entityType: "VerificationRequest",
    entityId: requestId
  });
  return repos.verification.get(requestId);
}

// ─── Scenario C: reject ──────────────────────────────────────────────────────
async function reject(repos, requestId, reason, admin) {
  if (!reason || !String(reason).trim()) throw new AppError("Le motif du rejet est requis.", 400);
  const vr = await repos.verification.get(requestId);
  if (!vr) throw new AppError("Demande de vérification introuvable.", 404);

  const now = new Date();
  await repos.verification.update(requestId, {
    status: "rejected", reason, reviewedAt: now, reviewerId: admin.id, reviewerName: admin.name,
    history: [...(vr.history || []), { date: now.toISOString(), text: `Rejetée par ${admin.name}${reason ? " — " + reason : ""}` }]
  });

  if (vr.level === "plan") {
    await repos.professionals.update(vr.professionalId, { planEligible: false });
  } else if (vr.level === "join") {
    await repos.professionals.update(vr.professionalId, { status: "rejected", professionStatus: "rejected" });
  } else if (vr.level === "professionnel") {
    await repos.professionals.update(vr.professionalId, { professionStatus: "rejected" });
  } else {
    await repos.professionals.update(vr.professionalId, { identityStatus: "rejected" });
  }

  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "VERIFICATION_REJECTED", entity: "VerificationRequest",
    entityId: requestId, result: "Rejected", note: reason
  });
  await notificationSvc.notifyAdmin(repos, {
    type: "verification",
    title: "Vérification rejetée",
    message: `${vr.professionalId} — ${vr.level} rejeté. ${reason}`,
    entityType: "VerificationRequest",
    entityId: requestId
  });
  return repos.verification.get(requestId);
}

// ─── Request more info ──────────────────────────────────────────────────────
async function requestInfo(repos, requestId, note, admin) {
  if (!note || !String(note).trim()) throw new AppError("La note est requise.", 400);
  const vr = await repos.verification.get(requestId);
  if (!vr) throw new AppError("Demande introuvable.", 404);
  const now = new Date();
  await repos.verification.update(requestId, {
    status: "needs_info", infoRequested: note, reviewedAt: now, reviewerId: admin.id, reviewerName: admin.name,
    history: [...(vr.history || []), { date: now.toISOString(), text: `Informations demandées par ${admin.name}${note ? " — " + note : ""}` }]
  });
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "VERIFICATION_INFO_REQUESTED", entity: "VerificationRequest",
    entityId: requestId, result: "Needs info", note
  });
  return repos.verification.get(requestId);
}

module.exports = { approve, reject, requestInfo, list, get, create };