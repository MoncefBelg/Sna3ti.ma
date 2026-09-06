// Account-free artisan onboarding service (REQ 53 — intake).
//
// Pipeline: ARTISAN -> Register form -> Backend API -> PostgreSQL (ARQ-xxxxx)
//           -> Admin dashboard (read) + WhatsApp notification (channel only).
//
// The request is ALWAYS persisted first (source of truth) with status
// "pending". It NEVER activates a subscription and NEVER auto-publishes to the
// marketplace (the marketplace only lists status: "active" professionals). The
// plan is resolved server-side from the active plan catalogue — the client
// only sends a plan code (free|verified|gold), never a planId/price.
//
// REQ 56 — approval materialises the account as a PENDING Professional (never
// published), links it via professionalId (ARQ→PRO) and leaves the explicit
// admin "activate/publish" action to promote it to the marketplace.

const { AppError } = require("../utils/AppError");
const { PROFESSIONAL_REQUEST_STATUSES } = require("../constants/statuses");
const { sendApplicationLead } = require("../providers/whatsapp");
const professionalSvc = require("./professionalService");

// Admin approves/rejects a PENDING request. Decide metadata is stored on the
// request (reason / reviewer / reviewedAt / history / professionalId) and
// mirrored to the append-only audit log. Approval (REQ 56) creates exactly one
// PENDING Professional (never published, never subscribed) — the marketplace
// listing happens only via the explicit admin activate action.
const REQUEST_PLAN_CODES = ["free", "verified", "gold"];

// Resolve the requested plan against the active catalogue. Server-authoritative:
// the stored planId/planName/planPrice always come from the plan table.
async function resolvePlan(repos, code) {
  const active = (repos.plans && typeof repos.plans.findActive === "function")
    ? await repos.plans.findActive()
    : await repos.plans.list();
  const plan = (active || []).find((p) => String(p.code).toLowerCase() === String(code).toLowerCase());
  if (!plan) {
    throw new AppError("Formule introuvable. Choisissez une formule valide.", 400);
  }
  return plan;
}

async function create(repos, data) {
  const existing = await repos.professionalRequests.findPendingByPhone(data.phone);
  if (existing) {
    throw new AppError("Une demande est déjà en attente pour ce numéro.", 409);
  }

  const plan = await resolvePlan(repos, data.plan);
  const id = await repos.ids.nextId("professionalRequest");

  const request = await repos.professionalRequests.create({
    id,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    profession: data.profession,
    otherService: data.otherService || null,
    city: data.city,
    cityLabel: data.cityLabel || null,
    description: data.description || null,
    price: data.price !== undefined && data.price !== null ? data.price : null,
    priceUnit: data.priceUnit || null,
    planId: plan.id,
    planCode: String(plan.code).toLowerCase(),
    planName: plan.name,
    planPrice: plan.price,
    status: "pending",
    notificationStatus: { whatsapp: "pending" },
    createdAt: new Date()
  });

  // WhatsApp = notification channel only; never fails the request.
  let whatsappStatus = "pending";
  try {
    const lead = { ...request, id };
    const res = await sendApplicationLead(lead);
    whatsappStatus = res.whatsapp;
  } catch (err) {
    whatsappStatus = "failed";
  }
  await repos.professionalRequests.update(id, {
    notificationStatus: { whatsapp: whatsappStatus },
    updatedAt: new Date()
  });
  request.notificationStatus = { whatsapp: whatsappStatus };

  return { ...request, reference: request.id };
}

// ─── Server-side list: search/filters + pagination + sort + counts (REQ 55) ─
// The admin registrations list is backend-authoritative. `data` remains an
// ARRAY (backward compatible with REQ 54); `pagination` describes the filtered
// result set (page/limit/total/pages) and `counts` carries global aggregates
// (total/pending/approved/rejected) so the dashboard counters are real backend
// numbers, never derived from a filtered page.
const SORT_FIELD_MAP = { createdat: "createdAt", name: "name", status: "status" };
const SORT_DIR_MAP = { asc: "asc", desc: "desc" };
const MAX_PAGE_SIZE = 500;
const DEFAULT_PAGE_SIZE = 25;

function parsePage(query) {
  const raw = query.page;
  if (raw === undefined || raw === null || raw === "") return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError("Paramètre page invalide. Entier ≥ 1 requis.", 400);
  }
  return n;
}

function parsePageSize(query) {
  const raw = query.pageSize;
  if (raw === undefined || raw === null || raw === "") return DEFAULT_PAGE_SIZE;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_SIZE) {
    throw new AppError(`Paramètre pageSize invalide. Entier entre 1 et ${MAX_PAGE_SIZE} requis.`, 400);
  }
  return n;
}

function sortRows(rows, sort, dir) {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let va, vb;
    if (sort === "name") {
      va = `${a.lastName || ""} ${a.firstName || ""}`.trim().toLowerCase();
      vb = `${b.lastName || ""} ${b.firstName || ""}`.trim().toLowerCase();
    } else if (sort === "createdAt") {
      va = new Date(a.createdAt).getTime() || 0;
      vb = new Date(b.createdAt).getTime() || 0;
    } else if (sort === "status") {
      va = String(a.status || "").toLowerCase();
      vb = String(b.status || "").toLowerCase();
    } else {
      va = a[sort];
      vb = b[sort];
    }
    if (typeof va === "string") return sign * va.localeCompare(vb);
    return sign * (va > vb ? 1 : va < vb ? -1 : 0);
  });
}

async function list(repos, query = {}) {
  const status = query.status && query.status !== "all" ? query.status : undefined;
  if (status && !PROFESSIONAL_REQUEST_STATUSES.includes(status)) {
    throw new AppError(`Statut invalide. Valeurs: ${PROFESSIONAL_REQUEST_STATUSES.join(", ")}`, 400);
  }
  const plan = query.plan && query.plan !== "all" ? String(query.plan).toLowerCase() : undefined;
  if (plan && !REQUEST_PLAN_CODES.includes(plan)) {
    throw new AppError(`Formule invalide. Valeurs: ${REQUEST_PLAN_CODES.join(", ")}`, 400);
  }
  const city = query.city !== undefined && query.city !== null && query.city !== ""
    ? String(query.city).trim().slice(0, 120)
    : undefined;
  const q = query.q !== undefined && query.q !== null && query.q !== ""
    ? String(query.q).trim().slice(0, 120)
    : undefined;

  const page = parsePage(query);
  const pageSize = parsePageSize(query);

  const rawSort = query.sort !== undefined && query.sort !== null && String(query.sort).trim() !== ""
    ? String(query.sort).trim()
    : "createdAt";
  const rawDir = query.dir !== undefined && query.dir !== null && String(query.dir).trim() !== ""
    ? String(query.dir).trim()
    : "desc";
  const sort = SORT_FIELD_MAP[rawSort.toLowerCase()];
  const dir = SORT_DIR_MAP[rawDir.toLowerCase()];
  if (!sort) {
    throw new AppError(`Tri invalide. Valeurs: ${Array.from(new Set(Object.values(SORT_FIELD_MAP))).join(", ")}`, 400);
  }
  if (!dir) {
    throw new AppError(`Direction invalide. Valeurs: ${Object.keys(SORT_DIR_MAP).join(", ")}`, 400);
  }

  // Global (unfiltered) aggregates — dashboard counters are backend numbers.
  const [total, pending, approved, rejected] = await Promise.all([
    repos.professionalRequests.count({}),
    repos.professionalRequests.count({ status: "pending" }),
    repos.professionalRequests.count({ status: "approved" }),
    repos.professionalRequests.count({ status: "rejected" })
  ]);

  const rows = await repos.professionalRequests.listFiltered({ status, planCode: plan, city, q });
  const sorted = sortRows(rows, sort, dir);
  const totalFiltered = sorted.length;
  const pages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, pages);
  const data = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return {
    data,
    pagination: { page: currentPage, limit: pageSize, total: totalFiltered, pages },
    counts: { total, pending, approved, rejected }
  };
}

async function get(repos, id) {
  const request = await repos.professionalRequests.get(id);
  if (!request) throw new AppError("Demande d'inscription introuvable.", 404);
  return { ...request, reference: request.id };
}

// ─── Admin approve (pending → approved) ─────────────────────────────────────
// Server-authoritative: the request must currently be "pending", otherwise the
// transition is rejected with 409.
//
// REQ 56 — approval materialises the artisan's account:
//   * creates EXACTLY ONE Professional with status "pending" (never published
//     automatically — the marketplace only lists "active"),
//   * does NOT activate any subscription and does NOT grant any badge,
//   * persists the ARQ → PRO link (professionalId) on the request for
//     end-to-end traceability.
// Idempotency: a request that already carries a professionalId returns the
// previously created Professional as-is, so double-submitting an approval can
// never create duplicates (a second approve also hits the 409 status gate).
async function approve(repos, requestId, admin) {
  const request = await repos.professionalRequests.get(requestId);
  if (!request) throw new AppError("Demande d'inscription introuvable.", 404);
  if (request.status !== "pending") {
    throw new AppError("Seule une demande en attente peut être approuvée.", 409);
  }

  // Idempotency guard: the professional already exists for this request.
  if (request.professionalId) {
    const existing = await repos.professionals.get(request.professionalId);
    if (existing) {
      return { ...request, professionalId: request.professionalId, reference: requestId };
    }
  }

  // Materialise the account as PENDING. Explicit status — professionalService
  // defaults to "active" only when no status is passed.
  const pro = await professionalSvc.create(repos, {
    name: [request.firstName, request.lastName].filter(Boolean).map((s) => String(s).trim()).join(" ").trim(),
    job: request.profession,
    city: request.city,
    area: (request.cityLabel && String(request.cityLabel).trim()
      && String(request.cityLabel).trim().toLowerCase() !== String(request.city).trim().toLowerCase())
      ? String(request.cityLabel).trim()
      : null,
    phone: request.phone,
    description: request.description || null,
    package: request.planCode || "free",
    status: "pending"
  }, admin);

  const now = new Date();
  const updated = await repos.professionalRequests.update(requestId, {
    status: "approved",
    professionalId: pro.id,
    reviewedAt: now,
    reviewerId: admin && admin.id ? admin.id : null,
    reviewerName: admin && admin.name ? admin.name : null,
    history: [...(request.history || []), { date: now.toISOString(), text: `Approuvée par ${admin ? admin.name : "—"}` }],
    updatedAt: now
  });

  await repos.auditLogs.log({
    adminId: admin && admin.id ? admin.id : null,
    adminName: admin && admin.name ? admin.name : null,
    action: "REGISTRATION_APPROVED",
    entity: "ProfessionalRequest",
    entityId: requestId,
    result: "Approved",
    metadata: { professionalId: pro.id }
  });

  return { ...updated, professionalId: pro.id, reference: requestId };
}

// ─── Admin reject (pending → rejected) ──────────────────────────────────────
// A reason is required (400 when missing). The transition is validated: only a
// "pending" request may be rejected (409 otherwise). Rejection never touches
// the marketplace.
async function reject(repos, requestId, reason, admin) {
  const cleanReason = reason && String(reason).trim() ? String(reason).trim().slice(0, 500) : "";
  if (!cleanReason) throw new AppError("Le motif du rejet est requis.", 400);

  const request = await repos.professionalRequests.get(requestId);
  if (!request) throw new AppError("Demande d'inscription introuvable.", 404);
  if (request.status !== "pending") {
    throw new AppError("Seule une demande en attente peut être rejetée.", 409);
  }

  const now = new Date();
  const updated = await repos.professionalRequests.update(requestId, {
    status: "rejected",
    reason: cleanReason,
    reviewedAt: now,
    reviewerId: admin && admin.id ? admin.id : null,
    reviewerName: admin && admin.name ? admin.name : null,
    history: [...(request.history || []), { date: now.toISOString(), text: `Rejetée par ${admin ? admin.name : "—"} — ${cleanReason}` }],
    updatedAt: now
  });

  await repos.auditLogs.log({
    adminId: admin && admin.id ? admin.id : null,
    adminName: admin && admin.name ? admin.name : null,
    action: "REGISTRATION_REJECTED",
    entity: "ProfessionalRequest",
    entityId: requestId,
    result: "Rejected",
    note: cleanReason
  });

  return { ...updated, reference: requestId };
}

module.exports = { create, list, get, approve, reject, resolvePlan };