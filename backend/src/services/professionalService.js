// Professional management — Scenario D: suspend / activate + full CRUD API.

const { AppError } = require("../utils/AppError");
const searchSvc = require("./searchService");
const subscriptionSvc = require("./subscriptionService");

// Public, paginated, searchable list (envelope from searchService).
async function list(repos, query) {
  // Lazy-expire any paid subscriptions whose period has elapsed so the badge
  // reflects an EFFECTIVE FREE account at read time.
  await subscriptionSvc.reconcileExpiredAcross(repos);
  return searchSvc.search(repos, query);
}

async function get(repos, professionalId) {
  await subscriptionSvc.reconcileExpiredForProfessional(repos, professionalId);
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  return pro;
}

async function create(repos, data, actor) {
  const id = await repos.ids.nextId("professional");
  const professional = await repos.professionals.create({
    ...data,
    id,
    status: data.status || "active",
    createdAt: new Date()
  });
  if (actor) {
    await repos.auditLogs.log({
      adminId: actor.id, adminName: actor.name,
      action: "CREATE_PROFESSIONAL", entity: "Professional",
      entityId: id, result: "Created", metadata: { name: data.name }
    });
  }
  return professional;
}

async function remove(repos, professionalId, actor) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  await repos.professionals.remove(professionalId);
  await repos.auditLogs.log({
    adminId: actor && actor.id, adminName: actor && actor.name,
    action: "DELETE_PROFESSIONAL", entity: "Professional",
    entityId: professionalId, result: "Deleted"
  });
  return { id: professionalId, deleted: true };
}

async function suspend(repos, professionalId, admin, reason) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  if (pro.status === "suspended") throw new AppError("Déjà suspendu.", 409);
  await repos.professionals.update(professionalId, { status: "suspended" });
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "PROFESSIONAL_SUSPENDED", entity: "Professional",
    entityId: professionalId, result: "Suspended", note: reason || null
  });
  return repos.professionals.get(professionalId);
}

async function activate(repos, professionalId, admin) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  // REQ 56 — activation promotes a PENDING (approved-but-not-published)
  // account to the marketplace, or reactivates a suspended one.
  if (pro.status !== "pending" && pro.status !== "suspended") {
    throw new AppError("Le compte doit être en attente ou suspendu pour être activé.", 409);
  }
  await repos.professionals.update(professionalId, { status: "active" });
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "PROFESSIONAL_ACTIVATED", entity: "Professional",
    entityId: professionalId, result: "Activated"
  });
  return repos.professionals.get(professionalId);
}

async function update(repos, professionalId, data, admin) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  await repos.professionals.update(professionalId, data);
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "UPDATE_PROFESSIONAL", entity: "Professional",
    entityId: professionalId, result: "Updated"
  });
  return repos.professionals.get(professionalId);
}

// ─── Admin-scoped list (REQ 56 — dashboard professional list) ──────────────
// The public marketplace only ever lists status "active" (see searchService).
// The ADMIN dashboard must ALSO surface pending / suspended / rejected accounts
// so an approved-but-not-published registration is visible and actionable.
// Filters, sort and pagination are applied server-side, mirroring the
// professional-request list conventions (REQ 55).
const PRO_STATUSES = ["pending", "active", "suspended", "rejected"];
const PRO_SORT_FIELD_MAP = { name: "name", status: "status", created: "createdAt", rating: "rating", reviewscount: "reviewsCount" };
const PRO_SORT_DIR_MAP = { asc: "asc", desc: "desc" };
const PRO_MAX_PAGE_SIZE = 500;
const PRO_DEFAULT_PAGE_SIZE = 100;

async function adminList(repos, query = {}) {
  await subscriptionSvc.reconcileExpiredAcross(repos);

  const status = query.status && query.status !== "all" && String(query.status).trim() !== ""
    ? String(query.status).trim()
    : undefined;
  if (status && !PRO_STATUSES.includes(status)) {
    throw new AppError(`Statut invalide. Valeurs: ${PRO_STATUSES.join(", ")}`, 400);
  }
  const city = query.city !== undefined && query.city !== null && String(query.city).trim() !== ""
    ? String(query.city).trim().slice(0, 120)
    : undefined;
  const plan = query.plan !== undefined && query.plan !== null && String(query.plan).trim() !== ""
    ? String(query.plan).trim().toLowerCase()
    : undefined;
  const q = query.q !== undefined && query.q !== null && String(query.q).trim() !== ""
    ? String(query.q).trim().slice(0, 120).toLowerCase()
    : undefined;

  const rows = (await repos.professionals.list({})).filter((p) => {
    if (status && p.status !== status) return false;
    if (city) {
      const haystack = [p.city, p.cityId, p.area].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(city.toLowerCase())) return false;
    }
    if (plan) {
      const pkg = String(p.package || p.subscriptionStatus || "free").toLowerCase();
      if (!pkg.includes(plan)) return false;
    }
    if (q) {
      const haystack = [p.id, p.name, p.job, p.description, p.phone, p.city, p.area].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const rawSort = query.sort !== undefined && query.sort !== null && String(query.sort).trim() !== ""
    ? String(query.sort).trim().toLowerCase()
    : "created";
  const rawDir = query.dir !== undefined && query.dir !== null && String(query.dir).trim() !== ""
    ? String(query.dir).trim().toLowerCase()
    : "desc";
  const sort = PRO_SORT_FIELD_MAP[rawSort];
  const dir = PRO_SORT_DIR_MAP[rawDir];
  if (!sort) throw new AppError(`Tri invalide. Valeurs: ${Object.values(PRO_SORT_FIELD_MAP).join(", ")}`, 400);
  if (!dir) throw new AppError(`Direction invalide. Valeurs: ${Object.keys(PRO_SORT_DIR_MAP).join(", ")}`, 400);
  const sign = dir === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    let va, vb;
    if (sort === "name") {
      va = String(a.name || "").toLowerCase();
      vb = String(b.name || "").toLowerCase();
    } else if (sort === "createdAt") {
      va = new Date(a.createdAt).getTime() || 0;
      vb = new Date(b.createdAt).getTime() || 0;
    } else {
      va = a[sort];
      vb = b[sort];
    }
    if (typeof va === "string") return sign * va.localeCompare(String(vb));
    const na = va == null ? 0 : Number(va);
    const nb = vb == null ? 0 : Number(vb);
    return sign * (na > nb ? 1 : na < nb ? -1 : 0);
  });

  const rawPage = query.page;
  const page = rawPage === undefined || rawPage === null || rawPage === ""
    ? 1
    : (Number.isInteger(Number(rawPage)) && Number(rawPage) > 0 ? Number(rawPage) : 1);
  const rawLimit = query.limit !== undefined && query.limit !== null && query.limit !== ""
    ? query.limit
    : query.pageSize;
  const limit = rawLimit === undefined
    ? PRO_DEFAULT_PAGE_SIZE
    : (Number.isInteger(Number(rawLimit)) && Number(rawLimit) >= 1 ? Math.min(Number(rawLimit), PRO_MAX_PAGE_SIZE) : PRO_DEFAULT_PAGE_SIZE);
  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, pages);
  const data = sorted.slice((currentPage - 1) * limit, currentPage * limit);

  return { data, pagination: { page: currentPage, limit, total, pages } };
}

module.exports = { suspend, activate, update, list, create, remove, get, adminList };