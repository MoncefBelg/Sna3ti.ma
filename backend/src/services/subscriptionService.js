// Subscription lifecycle — Scenario A (verification) & Scenario B (payment).
//
// CRITICAL BUSINESS RULES (REQ payments+subscriptions):
// - A paid plan (VÉRIFIÉ / GOLD) is activated for EXACTLY ONE MONTH and stores
//   a proper `startedAt` and `expiresAt`.
// - The professional's commercial badge (plan.package) reflects the active paid
//   plan (VÉRIFIÉ -> verified, GOLD -> gold). Verification (identity /
//   professionnel badge) stays INDEPENDENT and is never auto-approved by a
//   payment or subscription.
// - After `expiresAt` the subscription is EFFECTIVELY FREE: the professional is
//   reverted to package=free at read time. Historical subscription/payment
//   records are NEVER deleted.
// - Renewal extends the paid period by one month (from the current expiry if
//   still active, or from today if already expired) and never creates a
//   duplicate active subscription row.
// - "Back to Free Account" downgrades to FREE per the existing business rules
//   and is audit-logged.
// - Prices always come from the database plan — never from the frontend.

const { AppError } = require("../utils/AppError");
const { listScope, canReadRecord } = require("./billingAccess");

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Add a calendar month to a date, clamping the day to the target month length.
function addMonths(date, n) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const daysInTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInTarget));
  return d;
}

function oneMonthFrom(date) { return addMonths(date, 1); }

// REQ 58-D/E/G — append an immutable BillingTransaction for a PAID period.
// Only ever called for paid plans (price > 0). Free-plan activations (join)
// do NOT create a financial record. `type` is activation | renewal. This is
// append-only: each call inserts a NEW row and never touches a previous one.
async function _appendBillingTransaction(repos, { type, professionalId, paymentId, subscriptionId, plan, periodStartAt, periodEndAt, actorId, actorName }) {
  if (!plan || !(plan.price > 0)) return null; // free plans are not financial events
  const id = await repos.ids.nextId("billingTransaction");
  const txn = await repos.billingTransactions.insert({
    id,
    type,
    professionalId,
    paymentId: paymentId || null,
    subscriptionId,
    planId: plan.id || null,
    planName: plan.name,
    amount: plan.price,
    currency: plan.currency || "MAD",
    periodStartAt,
    periodEndAt,
    actorId: actorId || null,
    actorName: actorName || null,
    status: "active",
    createdAt: new Date()
  });
  return txn;
}

// REQ 58-H — expiry/downgrade NEVER create a new financial event. They only
// re-label the historical `active` paid period(s) whose entitlement has ended
// as `expired`, keeping the immutable rows permanently available and never
// deleting / mutating their amounts or periods.
async function _expireBillingForProfessional(repos, professionalId) {
  const rows = await repos.billingTransactions.list({ professionalId, status: "active" });
  const now = new Date();
  for (const t of rows) {
    if (t.periodEndAt && new Date(t.periodEndAt) <= now) {
      await repos.billingTransactions.updateStatus(t.id, "expired");
    }
  }
}

// Revert a professional to an EFFECTIVE FREE account. Keeps history.
async function _revertProfessionalToFree(repos, professionalId) {
  const active = await repos.subscriptions.findActiveByProfessional(professionalId);
  if (active) return; // still covered by another active subscription
  await repos.professionals.update(professionalId, {
    package: "free",
    subscriptionStatus: "none",
    subscriptionPlanId: null,
    subscriptionExpiresAt: null
  });
}

// Activate (or renew-extend) the requested plan for a professional.
// A fresh purchase activates for exactly one month from now. If the
// professional already holds an ACTIVE paid subscription (not yet expired),
// the period is EXTENDED from the current `expiresAt` — remaining paid time is
// never reset and no duplicate active subscription is created.
async function activateForProfessional(repos, professionalId, plan, opts = {}) {
  const now = new Date();
  const sub = await repos.subscriptions.findLatestByProfessional(professionalId);
  const stillActive = !!(sub && sub.status === "active" && sub.expiresAt && new Date(sub.expiresAt) > now);
  const baseStart = stillActive ? new Date(sub.expiresAt) : now;
  const expiresAt = oneMonthFrom(baseStart);

  const subData = {
    planId: plan.id,
    planName: plan.name,
    status: "active",
    paymentStatus: "confirmed",
    price: plan.price,
    currency: plan.currency || "MAD",
    startedAt: (sub && sub.startedAt) ? new Date(sub.startedAt) : baseStart,
    expiresAt,
    activeAt: now,
    renewalAt: stillActive ? now : null,
    cancelledAt: null
  };

  let subId;
  if (sub) {
    await repos.subscriptions.update(sub.id, subData);
    subId = sub.id;
  } else {
    const id = await repos.ids.nextId("subscription");
    await repos.subscriptions.create({ ...subData, id, professionalId, since: now, createdAt: now });
    subId = id;
  }

  await repos.professionals.update(professionalId, {
    subscriptionPlanId: plan.id,
    package: plan.code,
    subscriptionStatus: "active",
    subscriptionExpiresAt: expiresAt
  });

  // REQ 58-E/G — preserve the paid period permanently. Exactly one append-only
  // BillingTransaction per paid activation/renewal (idempotent per payment via
  // the DB-unique paymentId). Free plans produce no financial record.
  const billingTxn = await _appendBillingTransaction(repos, {
    type: stillActive ? "renewal" : "activation",
    professionalId,
    paymentId: opts.paymentId || null,
    subscriptionId: subId,
    plan,
    periodStartAt: baseStart,
    periodEndAt: expiresAt,
    actorId: (opts.admin && opts.admin.id) || (opts.actorId || null),
    actorName: (opts.admin && opts.admin.name) || (opts.actorName || null)
  });

  // Subscription activation must always be recorded (audit).
  if (opts.audit) {
    await repos.auditLogs.log({
      adminId: opts.admin ? opts.admin.id : null,
      adminName: opts.admin ? opts.admin.name : null,
      action: stillActive ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_ACTIVATED",
      entity: "Subscription",
      entityId: subId,
      result: "Activated",
      note: `${plan.code} -> ${expiresAt.toISOString()}`,
      metadata: {
        professionalId,
        subscriptionId: subId,
        billingTransactionId: billingTxn ? billingTxn.id : null,
        planId: plan.id,
        planName: plan.name,
        amount: plan.price,
        currency: plan.currency || "MAD",
        periodStartAt: baseStart.toISOString(),
        periodEndAt: expiresAt.toISOString()
      }
    });
  }
  return { plan, billingTransactionId: billingTxn ? billingTxn.id : null };
}

// Mark any active subscription whose period has elapsed as expired and revert
// the owning professional to an effective FREE account. Keeps history rows.
async function reconcileExpiredForProfessional(repos, professionalId) {
  const rows = await repos.subscriptions.list({ professionalId });
  const now = new Date();
  let changed = false;
  for (const s of rows) {
    if (s.status === "active" && s.expiresAt && new Date(s.expiresAt) <= now) {
      await repos.subscriptions.update(s.id, { status: "expired" });
      changed = true;
    }
  }
  if (changed) {
    await _expireBillingForProfessional(repos, professionalId);
    await _revertProfessionalToFree(repos, professionalId);
  }
  return changed;
}

async function reconcileExpiredAcross(repos) {
  const rows = await repos.subscriptions.list({ status: "active" });
  const now = new Date();
  for (const s of rows) {
    if (s.expiresAt && new Date(s.expiresAt) <= now) {
      await repos.subscriptions.update(s.id, { status: "expired" });
      await _expireBillingForProfessional(repos, s.professionalId);
      await _revertProfessionalToFree(repos, s.professionalId);
    }
  }
}

// ── API methods (req 16) ─────────────────────────────────────────────────────

async function list(repos, query = {}, actor) {
  await reconcileExpiredAcross(repos);
  // REQ 57-D: staff may list all subscriptions; a professional owner sees only
  // their own rows; anonymous/unrelated callers are denied.
  const scope = await listScope(repos, actor);
  if (!scope) throw new AppError("Accès non autorisé.", 403);
  const where = scope.professionalId ? { professionalId: scope.professionalId } : {};
  const rows = await repos.subscriptions.list(where, { orderBy: { createdAt: "desc" } });
  const total = rows.length;
  const page = toInt(query.page, 1);
  const limit = Math.min(toInt(query.limit, 20), 100);
  const pages = Math.max(1, Math.ceil(total / limit));
  const data = rows.slice((page - 1) * limit, page * limit);
  return { data, pagination: { page, limit, total, pages } };
}

async function get(repos, id, actor) {
  const sub = await repos.subscriptions.get(id);
  if (!sub) throw new AppError("Abonnement introuvable.", 404);
  // REQ 57-D: staff with subscriptions.view, or the owning professional.
  const allowed = await canReadRecord(repos, actor, "subscriptions.view", sub.professionalId);
  if (!allowed) throw new AppError("Accès non autorisé.", 403);
  await reconcileExpiredForProfessional(repos, sub.professionalId);
  return repos.subscriptions.get(id);
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
      action: "SUBSCRIPTION_CREATED", entity: "Subscription",
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

// Renew: extend the paid period by exactly one month.
//   - If still active: new expiry = current expiresAt + 1 month (paid time
//     already paid is preserved — never reset).
//   - If already expired / no expiresAt: new expiry = today + 1 month.
// Operates on the SINGLE existing subscription row (professionalId is unique)
// so it can never create a duplicate active subscription.
async function renew(repos, subscriptionId, admin) {
  const sub = await repos.subscriptions.get(subscriptionId);
  if (!sub) throw new AppError("Abonnement introuvable.", 404);
  if (sub.status === "cancelled") throw new AppError("Cet abonnement est annulé.", 409);

  const now = new Date();
  const currentExpiry = sub.expiresAt ? new Date(sub.expiresAt) : null;
  const stillActive = sub.status === "active" && currentExpiry && currentExpiry > now;
  const baseStart = stillActive ? currentExpiry : now;
  const expiresAt = oneMonthFrom(baseStart);

  const plan = sub.planId ? await repos.plans.get(sub.planId) : null;

  await repos.subscriptions.update(subscriptionId, {
    status: "active",
    paymentStatus: "confirmed",
    startedAt: sub.startedAt || now,
    expiresAt,
    activeAt: now,
    renewalAt: now,
    cancelledAt: null
  });

  if (plan) {
    await repos.professionals.update(sub.professionalId, {
      subscriptionPlanId: plan.id,
      package: plan.code,
      subscriptionStatus: "active",
      subscriptionExpiresAt: expiresAt
    });
  }

  // REQ 58-G — every paid renewal APPENDS a new BillingTransaction; the previous
  // historical periods are never overwritten. Free plans produce no record.
  const billingTxn = await _appendBillingTransaction(repos, {
    type: "renewal",
    professionalId: sub.professionalId,
    paymentId: null,
    subscriptionId,
    plan,
    periodStartAt: baseStart,
    periodEndAt: expiresAt,
    actorId: admin.id,
    actorName: admin.name
  });

  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "SUBSCRIPTION_RENEWED", entity: "Subscription",
    entityId: subscriptionId, result: "Renewed", note: expiresAt.toISOString(),
    metadata: {
      professionalId: sub.professionalId,
      subscriptionId,
      billingTransactionId: billingTxn ? billingTxn.id : null,
      planId: plan ? plan.id : null,
      planName: plan ? plan.name : null,
      amount: plan ? plan.price : 0,
      currency: plan ? (plan.currency || "MAD") : "MAD",
      periodStartAt: baseStart.toISOString(),
      periodEndAt: expiresAt.toISOString()
    }
  });
  return repos.subscriptions.get(subscriptionId);
}

// "Back to Free Account": downgrade the professional to FREE per the existing
// business rules. The historical subscription row is kept (never deleted); only
// the live status/period-end and the professional's commercial badge revert.
async function downgradeToFree(repos, subscriptionId, admin) {
  const sub = await repos.subscriptions.get(subscriptionId);
  if (!sub) throw new AppError("Abonnement introuvable.", 404);
  const now = new Date();
  await repos.subscriptions.update(subscriptionId, {
    status: "expired",
    expiresAt: sub.expiresAt && new Date(sub.expiresAt) > now ? new Date(sub.expiresAt) : now,
    cancelledAt: now
  });
  // REQ 58-H — downgrade re-labels the current active paid period as cancelled
  // (revoked early). It NEVER deletes or creates a new financial record.
  const activeTxns = await repos.billingTransactions.list({ professionalId: sub.professionalId, status: "active" });
  for (const t of activeTxns) {
    await repos.billingTransactions.updateStatus(t.id, "cancelled");
  }
  await repos.professionals.update(sub.professionalId, {
    package: "free",
    subscriptionStatus: "none",
    subscriptionPlanId: null,
    subscriptionExpiresAt: null
  });
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "SUBSCRIPTION_DOWNGRADED_TO_FREE", entity: "Subscription",
    entityId: subscriptionId, result: "Downgraded to free", note: "Back to free account"
  });
  return repos.subscriptions.get(subscriptionId);
}

module.exports = {
  activateForProfessional, list, get, create, update, cancel,
  renew, downgradeToFree, reconcileExpiredForProfessional, reconcileExpiredAcross
};
