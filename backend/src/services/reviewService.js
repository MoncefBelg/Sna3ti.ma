// Review service (req 21 + WhatsApp Interaction / Review Trust System).
// Public list (published only), authenticated customer create (guarded by a
// verified WhatsApp contact + 48h cooling-off), owner edit, and admin
// moderation (publish / flag / hide / delete). Every admin moderation action
// and every review submission is recorded in the audit log (append-only).

const { AppError } = require("../utils/AppError");
const env = require("../config/env");
const interactionService = require("./interactionService");
const notificationSvc = require("./notificationService");

const PUBLIC_STATUS = "published";

async function ensureProfessional(repos, id) {
  const pro = await repos.professionals.get(id);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  return pro;
}

function eligibilityError(reasons) {
  if (reasons.includes("channel_not_whatsapp")) {
    return new AppError("Seul un contact WhatsApp vérifié permet de laisser un avis.", 403);
  }
  if (reasons.includes("contact_not_confirmed")) {
    return new AppError("Confirmez d'abord que vous avez bien contacté cet artisan.", 403);
  }
  if (reasons.includes("cooldown_48h")) {
    return new AppError("Votre avis sera disponible 48h après le contact confirmé.", 403);
  }
  if (reasons.includes("interaction_rejected")) {
    return new AppError("Ce contact ne permet pas de laisser un avis.", 403);
  }
  if (reasons.includes("already_reviewed")) {
    return new AppError("Vous avez déjà laissé un avis pour cet artisan.", 409);
  }
  return new AppError("Vous devez d'abord contacter cet artisan via WhatsApp pour pouvoir laisser un avis.", 403);
}

async function list(reqCtx, professionalId, { includeHidden = false } = {}) {
  const pro = await ensureProfessional(reqCtx.repos, professionalId);
  const rows = await reqCtx.repos.reviews.findByProfessional(professionalId);
  const visible = includeHidden ? rows : rows.filter((r) => r.status === PUBLIC_STATUS);
  const data = visible.map((r) => ({
    id: r.id, professionalId: r.professionalId, customer: r.customer,
    rating: r.rating, comment: r.comment, status: r.status,
    verifiedContact: !!r.verifiedContact,
    date: r.date || r.createdAt, createdAt: r.createdAt
  }));
  return { data, meta: { total: data.length, average: data.length ? (data.reduce((s, r) => s + r.rating, 0) / data.length) : 0 } };
}

// Admin view — all reviews regardless of status.
async function listAll(reqCtx) {
  const rows = await reqCtx.repos.reviews.list({}, { orderBy: { createdAt: "desc" } });
  return { data: rows };
}

function normalizeRating(rating) {
  const n = Number(rating);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new AppError("La note doit être un entier entre 1 et 5.", 400, [{ field: "rating", message: "La note doit être un entier entre 1 et 5." }]);
  }
  return n;
}

async function create(reqCtx, professionalId, data, actor) {
  await ensureProfessional(reqCtx.repos, professionalId);
  const rating = normalizeRating(data.rating);

  // Customer account REQUIRED (req contact-trust §7). Reviews can only ever be
  // attributed to a real platform User resolved server-side.
  const user = await interactionService.resolveCustomer(reqCtx.repos, actor);
  if (!user) throw new AppError("Un compte client est requis pour laisser un avis.", 403);

  // Contact-eligibility chain (validation order §10): interaction exists →
  // belongs to this customer → channel WHATSAPP → positive confirmation →
  // 48h cooling-off → no previous review. Nothing here is trusted from the body.
  const interaction = await reqCtx.repos.interactions.findByCustomerAndProfessional(user.id, professionalId);
  if (!interaction) throw eligibilityError(["no_contact"]);

  const otherReviews = (await reqCtx.repos.interactions.listReviewsByCustomer(user.id))
    .filter((r) => r.professionalId === professionalId);
  const eligibility = interactionService.deriveEligibility(user, interaction, otherReviews);
  if (!eligibility.eligible) throw eligibilityError(eligibility.reasons);

  // Server-computed risk score decides publication policy.
  const risk = await interactionService.evaluateRisk(reqCtx.repos, user, { professionalId, comment: data.comment });
  const status = risk.level === "HIGH" || risk.level === "CRITICAL" ? "flagged" : "published";

  const id = await reqCtx.repos.ids.nextId("review");
  const review = await reqCtx.repos.reviews.create({
    id,
    professionalId,
    userId: user.id,
    customer: user.name || "Client",
    rating,
    comment: data.comment || null,
    status,
    verifiedContact: true,
    interactionId: interaction.id,
    riskScore: risk.score,
    date: new Date(),
    createdAt: new Date()
  });
  // Lock the interaction: one review per customer + professional.
  await reqCtx.repos.interactions.update(interaction.id, { reviewId: id, updatedAt: new Date() });
  await recomputeRating(reqCtx.repos, professionalId);

  await reqCtx.repos.auditLogs.log({
    adminId: user.id,
    action: status === "flagged" ? "REVIEW_FLAGGED_AUTO" : "REVIEW_CREATED",
    entity: "Review",
    entityId: id,
    result: status,
    metadata: { professionalId, riskScore: risk.score, verifiedContact: true }
  });

  // A suspicious review (HIGH / CRITICAL risk) is auto-flagged → surface it in
  // the admin notifications feed so moderation can act.
  if (status === "flagged") {
    const pro = await reqCtx.repos.professionals.get(professionalId).catch(() => null);
    await notificationSvc.notifyAdmin(reqCtx.repos, {
      type: "review",
      title: "Avis signalé",
      message: `Avis ${id} (${rating}/5) signalé automatiquement contre ${pro && pro.name ? pro.name : professionalId} (risque ${risk.level}).`,
      entityType: "Review",
      entityId: id
    });
  }

  return review;
}

// ── WhatsApp brief-avis submission (REQ 62) ─────────────────────────────────
// Anonymous by design: a site visitor picks a rating, types an "avis" and gives
// a WhatsApp number (no account required). The review is stored PENDING; the
// platform's own WhatsApp phone is returned so the client can be redirected to
// a pre-filled chat (wa.me) where the platform can follow up. An admin
// notification and an audit entry are created (nothing is auto-published).
async function submitWhatsApp(reqCtx, professionalId, data) {
  await ensureProfessional(reqCtx.repos, professionalId);
  const rating = normalizeRating(data.rating);
  const contact = String(data.contact || "").trim();
  const contactDigits = contact.replace(/\D/g, "");
  if (contactDigits.length < 8 || contactDigits.length > 15) {
    throw new AppError("Numéro WhatsApp invalide.", 400, [{ field: "contact", message: "Numéro WhatsApp invalide." }]);
  }
  if (!data.comment || !String(data.comment).trim()) {
    throw new AppError("Veuillez écrire votre avis.", 400, [{ field: "comment", message: "Veuillez écrire votre avis." }]);
  }
  const name = String(data.reviewerName || "").trim();

  // Duplicate / spam prevention (REQ 62): the same WhatsApp number cannot
  // submit a new avis for the same professional while an existing one is still
  // pending (or already recorded). This stops visitors from flooding the queue
  // with repeated submissions. Only the open (pending) window is blocked; once
  // an admin closes it, a genuine follow-up is still possible.
  const existing = await reqCtx.repos.reviews.find({ professionalId, reviewerContact: contact });
  if (existing) {
    const stillOpen = existing.status === "pending" || existing.status === "flagged";
    throw new AppError(
      stillOpen
        ? "Un avis est déjà en attente pour ce numéro et cet artisan. Merci de patienter."
        : "Un avis a déjà été envoyé avec ce numéro pour cet artisan.",
      409,
      [{ field: "contact", message: "Demande déjà envoyée pour ce contact." }]
    );
  }

  const id = await reqCtx.repos.ids.nextId("review");
  const review = await reqCtx.repos.reviews.create({
    id,
    professionalId,
    userId: null,
    customer: name || "Client WhatsApp",
    rating,
    comment: String(data.comment).trim(),
    status: "pending",
    verifiedContact: false,
    reviewerName: name || null,
    reviewerContact: contact,
    reviewSource: "whatsapp",
    date: new Date(),
    createdAt: new Date()
  });
  await reqCtx.repos.auditLogs.log({
    adminId: null,
    action: "REVIEW_SUBMITTED_WHATSAPP",
    entity: "Review",
    entityId: id,
    result: "pending",
    metadata: { professionalId, rating, hasContact: true }
  });

  const pro = await reqCtx.repos.professionals.get(professionalId).catch(() => null);
  await notificationSvc.notifyAdmin(reqCtx.repos, {
    type: "review",
    title: "Nouvel avis WhatsApp",
    message: `Avis ${id} (${rating}/5) reçu via WhatsApp pour ${pro && pro.name ? pro.name : professionalId} — à vérifier et publier. Contact : ${contact}.`,
    entityType: "Review",
    entityId: id
  });

  return { review, platformWhatsapp: env.whatsapp.businessPhone || env.whatsapp.defaultRecipient || "" };
}

// ── Admin manual capture (REQ 62): an admin types a client's review received
// on the platform WhatsApp. Published immediately unless publish=false.
async function createManual(reqCtx, data, admin) {
  const professionalId = String(data.professionalId || "");
  await ensureProfessional(reqCtx.repos, professionalId);
  const rating = normalizeRating(data.rating);
  const name = String(data.customer || "").trim() || "Client";
  const status = data.publish === false ? "pending" : "published";
  const contact = String(data.contact || "").trim() || null;

  const id = await reqCtx.repos.ids.nextId("review");
  const review = await reqCtx.repos.reviews.create({
    id,
    professionalId,
    userId: null,
    customer: name,
    rating,
    comment: data.comment ? String(data.comment).trim() : null,
    status,
    verifiedContact: false,
    reviewerName: name,
    reviewerContact: contact,
    reviewSource: "admin",
    date: new Date(),
    createdAt: new Date()
  });
  await reqCtx.repos.auditLogs.log({
    adminId: admin && admin.id,
    action: "REVIEW_CREATED_MANUAL",
    entity: "Review",
    entityId: id,
    result: status,
    metadata: { professionalId, rating, source: "admin" }
  });
  if (status === "published") {
    const pro = await reqCtx.repos.professionals.get(professionalId).catch(() => null);
    await notificationSvc.notifyAdmin(reqCtx.repos, {
      type: "review",
      title: "Avis ajouté par un admin",
      message: `Avis ${id} (${rating}/5) ajouté et publié pour ${pro && pro.name ? pro.name : professionalId}.`,
      entityType: "Review",
      entityId: id
    });
  }
  await recomputeRating(reqCtx.repos, professionalId);
  return review;
}

async function update(reqCtx, reviewId, data, actor) {
  const review = await reqCtx.repos.reviews.get(reviewId);
  if (!review) throw new AppError("Avis introuvable.", 404);
  if (actor && review.userId && review.userId !== actor.id) {
    throw new AppError("Vous ne pouvez pas modifier cet avis.", 403);
  }
  const rating = data.rating !== undefined ? normalizeRating(data.rating) : review.rating;
  const updated = await reqCtx.repos.reviews.update(reviewId, {
    rating, comment: data.comment !== undefined ? data.comment : review.comment,
    updatedAt: new Date()
  });
  await recomputeRating(reqCtx.repos, review.professionalId);
  return updated;
}

async function recomputeRating(repos, professionalId) {
  const rows = await repos.reviews.findByProfessional(professionalId);
  const published = rows.filter((r) => r.status === "published");
  const avg = published.length
    ? +(published.reduce((s, r) => s + Number(r.rating), 0) / published.length).toFixed(1)
    : null;
  await repos.professionals.update(professionalId, {
    rating: avg,
    reviewsCount: published.length
  });
}

// ── Admin moderation ─────────────────────────────────────────────────────────

async function moderate(reqCtx, reviewId, action, admin, reason) {
  const review = await reqCtx.repos.reviews.get(reviewId);
  if (!review) throw new AppError("Avis introuvable.", 404);
  const now = new Date();

  if (action === "publish") {
    await reqCtx.repos.reviews.update(reviewId, { status: "published", flaggedReason: null, updatedAt: now });
  } else if (action === "flag") {
    await reqCtx.repos.reviews.update(reviewId, { status: "flagged", flaggedReason: reason || "Signalé", flaggedReporter: admin && admin.name, flaggedDate: now, updatedAt: now });
  } else if (action === "hide") {
    await reqCtx.repos.reviews.update(reviewId, { status: "hidden", updatedAt: now });
  } else if (action === "delete") {
    await reqCtx.repos.reviews.remove(reviewId);
    await recomputeRating(reqCtx.repos, review.professionalId);
  } else {
    throw new AppError("Action de modération inconnue.", 400);
  }

  const AUDIT_ACTIONS = { publish: "REVIEW_PUBLISHED", flag: "REVIEW_FLAGGED", hide: "REVIEW_HIDDEN", delete: "REVIEW_DELETED" };
  await reqCtx.repos.auditLogs.log({
    adminId: admin && admin.id, action: AUDIT_ACTIONS[action] || `REVIEW_${action.toUpperCase()}`,
    entity: "Review", entityId: reviewId, reason: reason || null
  });

  if (action === "delete") return { id: reviewId, deleted: true };
  await recomputeRating(reqCtx.repos, review.professionalId);
  return reqCtx.repos.reviews.get(reviewId);
}

module.exports = { list, listAll, create, submitWhatsApp, createManual, update, moderate };
