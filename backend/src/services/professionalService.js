// Professional management — Scenario D: suspend / activate + full CRUD API.

const { AppError } = require("../utils/AppError");
const searchSvc = require("./searchService");
const subscriptionSvc = require("./subscriptionService");
const notificationSvc = require("./notificationService");
const { assertMediaAllowed } = require("./mediaService");

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
  await notificationSvc.notifyAdmin(repos, {
    type: "system",
    title: "Artisan suspendu",
    message: `${professionalId} ${pro.name || ""} suspendu de la place de marché.${reason ? " Motif : " + reason : ""}`,
    entityType: "Professional",
    entityId: professionalId
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
  await notificationSvc.notifyAdmin(repos, {
    type: "system",
    title: "Artisan activé",
    message: `${professionalId} ${pro.name || ""} activé sur la place de marché.`,
    entityType: "Professional",
    entityId: professionalId
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

// ─── Professional media (portfolio / profile photo) ────────────────────────
// Mirrors the request media pipeline: bytes live in StorageService
// (professionals/<proId>/...), metadata on the Professional.media JSON column.
// Plan gates follow the professional's effective package (free/verified/gold):
// FREE = photos only, Vérifié/GOLD = photos or ≤ 3 videos.

async function findMedia(professional, mediaId) {
  const list = Array.isArray(professional.media) ? professional.media : [];
  return list.find((m) => m && m.id === mediaId) || null;
}

function effectivePlanCode(pro) {
  const pkg = String(pro.package || pro.subscriptionStatus || "free").toLowerCase();
  if (pkg === "gold" || pkg.indexOf("gold") !== -1) return "gold";
  if (pkg === "verified" || pkg === "vérifié" || pkg === "verifie" || pkg.indexOf("verifie") !== -1) return "verified";
  return "free";
}

async function uploadMedia(reqCtx, professionalId, meta = {}) {
  const repos = reqCtx.repos;
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);

  const kind = meta.kind === "profile" ? "profile" : "echantillon";
  const allowed = assertMediaAllowed(effectivePlanCode(pro), meta.file, pro.media, { kind });

  const stored = await reqCtx.storage.put(`professionals/${professionalId}`, {
    originalname: String(meta.file.originalname || (allowed.type === "video" ? "video.mp4" : "photo.jpg")),
    mimetype: meta.file.mimetype,
    size: meta.file.size,
    buffer: meta.file.buffer
  });

  const mediaId = await repos.ids.nextId("professionalMedia");
  const entry = {
    id: mediaId,
    kind: allowed.kind,
    type: allowed.type,
    label: meta.label && String(meta.label).trim() ? String(meta.label).slice(0, 120) : "",
    fileUrl: stored.url,
    key: stored.key,
    mimeType: stored.mimeType,
    size: stored.size,
    added: new Date().toISOString()
  };

  const next = [...(Array.isArray(pro.media) ? pro.media : []), entry];
  await repos.professionals.update(professionalId, { media: next });
  return { ...entry, quotas: { used: next.length, limits: allowed.limits } };
}

async function getMedia(reqCtx, professionalId, mediaId) {
  const repos = reqCtx.repos;
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  const entry = await findMedia(pro, mediaId);
  if (!entry) throw new AppError("Média introuvable.", 404);
  const key = String(entry.fileUrl).replace(/^\/files\//, "");
  const bytes = reqCtx.storage ? await reqCtx.storage.get(key) : null;
  return { entry, bytes };
}

async function removeMedia(reqCtx, professionalId, mediaId) {
  const repos = reqCtx.repos;
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  const entry = await findMedia(pro, mediaId);
  if (!entry) throw new AppError("Média introuvable.", 404);

  const next = (pro.media || []).filter((m) => m.id !== mediaId);
  await repos.professionals.update(professionalId, { media: next });
  if (reqCtx.storage && entry.fileUrl) {
    try { await reqCtx.storage.delete(String(entry.fileUrl).replace(/^\/files\//, "")); } catch (err) { /* best-effort */ }
  }
  return { id: mediaId, removed: true };
}

// Carry media from an approved request onto the professional. Bytes stay in
// storage (keys are bucket-agnostic for the guarded GET endpoints), so this is
// a pure metadata copy — used by approve in professionalRequestService.
async function setMedia(repos, professionalId, entries, admin) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  const next = (Array.isArray(entries) ? entries : []).map((e) => ({ ...e }));
  await repos.professionals.update(professionalId, { media: next });
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

module.exports = { suspend, activate, update, list, create, remove, get, adminList, uploadMedia, getMedia, removeMedia, setMedia };