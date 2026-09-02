// Subscription lifecycle. Used by verification approval (Scenario A), payment
// confirmation (Scenario B), and the subscriptions API (req 16).
//
// IMPORTANT (req 15/18): prices always come from the database plan — never
// from the frontend. Confirming a payment/subscription NEVER changes
// verificationStatus (req 18).

const { AppError } = require("../utils/AppError");

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Activate the requested plan for a professional.
async function activateForProfessional(repos, professionalId, plan) {
  const now = new Date();
  let sub = await repos.subscriptions.findActiveByProfessional(professionalId);
  const subData = {
    professionalId,
    planId: plan.id,
    planName: plan.name,
    status: "active",
    paymentStatus: "confirmed",
    price: plan.price,
    currency: plan.currency || "MAD",
    startedAt: sub?.startedAt || sub?.since || now,
    activeAt: now
  };
  if (sub) {
    await repos.subscriptions.update(sub.id, subData);
  } else {
    await repos.subscriptions.create(subData);
  }

  await repos.professionals.update(professionalId, {
    subscriptionPlanId: plan.id,
    package: plan.code,
    subscriptionStatus: "active"
  });

  return plan;
}

// ── API methods (req 16) ─────────────────────────────────────────────────────

async function list(repos, query = {}) {
  const rows = await repos.subscriptions.list({}, { orderBy: { createdAt: "desc" } });
  const total = rows.length;
  const page = toInt(query.page, 1);
  const limit = Math.min(toInt(query.limit, 20), 100);
  const pages = Math.max(1, Math.ceil(total / limit));
  const data = rows.slice((page - 1) * limit, page * limit);
  return { data, pagination: { page, limit, total, pages } };
}

async function get(repos, id) {
  const sub = await repos.subscriptions.get(id);
  if (!sub) throw new AppError("Abonnement introuvable.", 404);
  return sub;
}

async function create(repos, data, actor) {
  if (!data.professionalId) throw new AppError("professionalId requis.", 400);
  if (!data.planId) throw new AppError("planId requis.", 400);

  const plan = await repos.plans.get(data.planId);
  if (!plan) throw new AppError("Plan introuvable.", 404);

  // Price is ALWAYS taken from the DB plan (req 15) — never from the client.
  const now = new Date();
  const id = await repos.ids.nextId("subscription");
  const sub = await repos.subscriptions.create({
    id,
    professionalId: data.professionalId,
    planId: plan.id,
    planName: plan.name,
    status: data.status || "pending",
    paymentStatus: data.paymentStatus || "pending",
    price: plan.price,
    currency: plan.currency || "MAD",
    since: now,
    startedAt: now,
    createdAt: now
  });
  if (actor) {
    await repos.auditLogs.log({
      adminId: actor && actor.id, adminName: actor && actor.name,
      action: "SUBSCRIPTION_ACTIVATED", entity: "Subscription",
      entityId: id, result: "Created"
    });
  }
  return sub;
}

async function update(repos, id, data, actor) {
  const sub = await repos.subscriptions.get(id);
  if (!sub) throw new AppError("Abonnement introuvable.", 404);
  const updates = { ...data };
  if (data.planId && data.planId !== sub.planId) {
    const plan = await repos.plans.get(data.planId);
    if (!plan) throw new AppError("Plan introuvable.", 404);
    updates.planId = plan.id;
    updates.planName = plan.name;
    updates.price = plan.price; // price from DB, never frontend
  }
  delete updates.id;
  const updated = await repos.subscriptions.update(id, { ...updates, updatedAt: new Date() });
  await repos.auditLogs.log({
    adminId: actor && actor.id, adminName: actor && actor.name,
    action: "UPDATE_SUBSCRIPTION", entity: "Subscription",
    entityId: id, result: "Updated"
  });
  return updated;
}

async function cancel(repos, id, actor) {
  const sub = await repos.subscriptions.get(id);
  if (!sub) throw new AppError("Abonnement introuvable.", 404);
  if (sub.status === "cancelled") throw new AppError("Déjà annulé.", 409);
  const updated = await repos.subscriptions.update(id, {
    status: "cancelled",
    cancelledAt: new Date(),
    updatedAt: new Date()
  });
  await repos.auditLogs.log({
    adminId: actor && actor.id, adminName: actor && actor.name,
    action: "SUBSCRIPTION_CANCELLED", entity: "Subscription",
    entityId: id, result: "Cancelled"
  });
  return updated;
}

module.exports = { activateForProfessional, list, get, create, update, cancel };
