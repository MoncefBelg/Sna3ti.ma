// Review service (req 21). Public list (published only), user create/edit,
// and admin moderation (publish / flag / hide / delete). Every admin
// moderation action is recorded in the audit log (append-only, req 23).

const { AppError } = require("../utils/AppError");

const PUBLIC_STATUS = "published";

async function ensureProfessional(repos, id) {
  const pro = await repos.professionals.get(id);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  return pro;
}

async function list(reqCtx, professionalId, { includeHidden = false } = {}) {
  const pro = await ensureProfessional(reqCtx.repos, professionalId);
  const rows = await reqCtx.repos.reviews.findByProfessional(professionalId);
  const visible = includeHidden ? rows : rows.filter((r) => r.status === PUBLIC_STATUS);
  const data = visible.map((r) => ({
    id: r.id, professionalId: r.professionalId, customer: r.customer,
    rating: r.rating, comment: r.comment, status: r.status,
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
  const id = await reqCtx.repos.ids.nextId("review");
  const review = await reqCtx.repos.reviews.create({
    id,
    professionalId,
    userId: actor && actor.id ? actor.id : null,
    customer: (actor && actor.name) || data.customer || "Client",
    rating,
    comment: data.comment || null,
    status: "published",
    date: new Date(),
    createdAt: new Date()
  });
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

module.exports = { list, listAll, create, update, moderate };
