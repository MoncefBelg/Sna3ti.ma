const { AppError } = require("../utils/AppError");
const subscriptionSvc = require("./subscriptionService");

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ─── List / get / create (req 17) ───────────────────────────────────────────
async function list(repos, query = {}) {
  const rows = await repos.verification.listByStatus(query.status || "all");
  const total = rows.length;
  const page = toInt(query.page, 1);
  const limit = Math.min(toInt(query.limit, 20), 100);
  const pages = Math.max(1, Math.ceil(total / limit));
  const data = rows.slice((page - 1) * limit, page * limit);
  return { data, pagination: { page, limit, total, pages } };
}

async function get(repos, id) {
  const vr = await repos.verification.get(id);
  if (!vr) throw new AppError("Demande de vérification introuvable.", 404);
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
  return vr;
}


// ─── Scenario A: approve verification ────────────────────────────────────────
// • plan-level request: activates the requested subscription; badge unchanged
// • identity / professionnel: grants the verified badge; subscription untouched
// • join: activates the free subscription
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
      if (plan) await subscriptionSvc.activateForProfessional(repos, vr.professionalId, plan);
    }

    // Audit + professional's verification badge remains unchanged (independence rule).
    await repos.auditLogs.log({
      adminId: admin.id, adminName: admin.name,
      action: "VERIFICATION_APPROVED", entity: "VerificationRequest",
      entityId: requestId, result: "Approved"
    });
    return repos.verification.get(requestId);
  }

  // ── Join request ──────────────────────────────────────────────────────────
  if (vr.level === "join") {
    await repos.verification.update(requestId, {
      status: "approved", reviewedAt: now, reviewerId: admin.id, reviewerName: admin.name,
      history: [...(vr.history || []), { date: now.toISOString(), text: `Adhésion confirmée par ${admin.name}` }]
    });
    // Activate professional (pending → active) + free subscription
    const pro = await repos.professionals.get(vr.professionalId);
    if (pro && pro.status !== "active") {
      await repos.professionals.update(vr.professionalId, { status: "active", professionStatus: "pending" });
    }
    const freePlan = await repos.plans.find({ code: "free" }) || await repos.plans.get("PLAN-FREE");
    if (freePlan) await subscriptionSvc.activateForProfessional(repos, vr.professionalId, freePlan);
    await repos.auditLogs.log({
      adminId: admin.id, adminName: admin.name,
      action: "JOIN_APPROVED", entity: "VerificationRequest",
      entityId: requestId, result: "Approved"
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