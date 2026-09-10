// REQ 58-I/K — server-driven billing history + lightweight financial reporting.
//
// BillingTransaction is the immutable paid-period ledger. This service exposes
// read-only access (no update/delete anywhere) and server-side aggregation.
//
// Access control reuses the existing billing helpers: staff members (with the
// admin `payments.view` gate applied at the route) may read the whole ledger; a
// platform user who OWNS a professional record may only ever see their OWN
// billing history — never another professional's. Anonymous callers are denied.

const { AppError } = require("../utils/AppError");
const { listScope } = require("./billingAccess");

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const TYPES = ["activation", "renewal"];
const STATUSES = ["active", "expired", "cancelled"];
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function alpha(value) {
  return value !== undefined && value !== null && String(value).trim() !== ""
    ? String(value).trim()
    : undefined;
}

// Server-side list with bounded pagination and lightweight (JS) filtering,
// mirroring the existing subscription/professional list conventions so the
// in-memory adapter and Prisma both behave identically.
async function list(repos, query = {}, actor) {
  const scope = await listScope(repos, actor);
  if (!scope) throw new AppError("Accès non autorisé.", 403);

  const professionalId = alpha(query.professionalId);
  const plan = alpha(query.plan);
  const type = alpha(query.type);
  const status = alpha(query.status);
  const from = alpha(query.from);
  const to = alpha(query.to);
  const search = alpha(query.search);
  const pageSize = toInt(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(pageSize, MAX_LIMIT);

  if (type && !TYPES.includes(type)) throw new AppError(`Type invalide. Valeurs: ${TYPES.join(", ")}`, 400);
  if (status && !STATUSES.includes(status)) throw new AppError(`Statut invalide. Valeurs: ${STATUSES.join(", ")}`, 400);

  let rows = await repos.billingTransactions.list({}, { orderBy: { createdAt: "desc" } });
  rows = rows.filter((t) => {
    // A non-staff actor (professional owner) sees only their own rows.
    if (scope.professionalId && t.professionalId !== scope.professionalId) return false;
    if (professionalId && t.professionalId !== professionalId) return false;
    if (plan) {
      const needle = plan.toLowerCase();
      if (!String(t.planName || "").toLowerCase().includes(needle) && !String(t.planId || "").toLowerCase().includes(needle)) return false;
    }
    if (type && t.type !== type) return false;
    if (status && t.status !== status) return false;
    if (from || to) {
      const ts = t.createdAt ? new Date(t.createdAt).getTime() : null;
      if (ts != null) {
        if (from && ts < new Date(from).getTime()) return false;
        if (to && ts > new Date(to).getTime()) return false;
      }
    }
    if (search) {
      const needle = search.toLowerCase();
      const hay = [t.id, t.paymentId, t.planName, t.planId, t.professionalId].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(toInt(query.page, 1), pages);
  const data = rows.slice((page - 1) * limit, page * limit);
  return { data, pagination: { page, limit, total, pages, filters: { professionalId: professionalId || null, plan: plan || null, type: type || null, status: status || null } } };
}

// REQ 58-K — lightweight server-side reporting. NOT accounting/tax software.
// Aggregates confirmed paid revenue from the immutable ledger, plus pending /
// rejected figures from the payment workflow.
async function summary(repos, actor) {
  const scope = await listScope(repos, actor);
  if (!scope) throw new AppError("Accès non autorisé.", 403);

  let txns = await repos.billingTransactions.list({}, { orderBy: { createdAt: "desc" } });
  if (scope.professionalId) txns = txns.filter((t) => t.professionalId === scope.professionalId);

  const confirmedCount = txns.filter((t) => t.status === "active").length;
  const confirmedAmount = txns
    .filter((t) => t.status === "active")
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const byPlan = {};
  for (const t of txns) {
    if (t.status !== "active") continue;
    const key = t.planName || "Unknown";
    byPlan[key] = byPlan[key] || { planName: key, count: 0, amount: 0, currency: t.currency || "MAD" };
    byPlan[key].count += 1;
    byPlan[key].amount += t.amount || 0;
  }

  // Pending / rejected figures come from the payment workflow records.
  let payments = await repos.payments.list({});
  if (scope.professionalId) payments = payments.filter((p) => p.professionalId === scope.professionalId);
  let pendingAmount = 0;
  let rejectedCount = 0;
  let rejectedAmount = 0;
  for (const p of payments) {
    if (p.status === "pending") pendingAmount += p.amount || 0;
    else if (p.status === "rejected") { rejectedCount += 1; rejectedAmount += p.amount || 0; }
  }

  return {
    confirmedCount,
    confirmedAmount,
    pendingAmount,
    rejectedCount,
    rejectedAmount,
    revenueByPlan: Object.values(byPlan).sort((a, b) => b.amount - a.amount),
    resolvedCurrencies: Array.from(new Set(txns.map((t) => t.currency || "MAD")))
  };
}

module.exports = { list, summary };
