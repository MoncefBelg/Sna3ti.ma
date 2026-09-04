// Sna3ti Match service — "Trouve-moi un artisan de confiance".
//
// Pipeline: CUSTOMER -> Match Form -> Backend API -> PostgreSQL (REQ-xxxxx)
//           -> Admin Dashboard + WhatsApp notification (channel only).
//
// The match request is ALWAYS persisted to PostgreSQL first (source of truth).
// WhatsApp is a notification channel: its status is stored on the request and
// never blocks or fails request creation. Prices are entered by admins only —
// the backend never auto-generates them.

const { AppError } = require("../utils/AppError");
const { MATCH_STATUSES } = require("../constants/statuses");
const { sendMatchLead } = require("../providers/whatsapp");

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3 MB per photo

// Decode a base64 data-URL (e.g. "data:image/png;base64,...") into a Buffer +
// mimeType, validating size + image mime.
function decodePhoto(dataUrl) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(String(dataUrl || "").trim());
  if (!m) throw new AppError("Photo invalide — format non supporté.", 400);
  const mimeType = m[1];
  const buffer = Buffer.from(m[2], "base64");
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) {
    throw new AppError("Photo trop volumineuse (max 3 Mo).", 400);
  }
  return { buffer, mimeType };
}

function extForMime(mimeType) {
  const map = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/heic": ".heic" };
  return map[mimeType] || ".jpg";
}

async function persistPhotos(storage, requestId, photos = []) {
  const out = [];
  for (const dataUrl of photos) {
    const { buffer, mimeType } = decodePhoto(dataUrl);
    const stored = await storage.put(`match-requests/${requestId}`, {
      originalname: `photo${extForMime(mimeType)}`,
      mimetype: mimeType,
      size: buffer.length,
      buffer
    });
    out.push(stored);
  }
  return out;
}

async function create(reqCtx, data, files = []) {
  const { repos, storage } = reqCtx;
  if (!data || !data.name || !data.phone || !data.city || !data.service) {
    throw new AppError("Nom, téléphone, ville et service sont requis.", 400);
  }
  if (files && files.length > MAX_PHOTOS) {
    throw new AppError(`Maximum ${MAX_PHOTOS} photos par demande.`, 400);
  }

  const id = await repos.ids.nextId("match");

  // Photo persistence is best-effort with a hard 5-photo cap; request creation
  // must never fail because of a storage hiccup, so we catch and continue.
  let storedPhotos = [];
  try {
    storedPhotos = storage ? await persistPhotos(storage, id, files || []) : [];
  } catch (err) {
    storedPhotos = [];
  }

  const notificationStatus = { whatsapp: "pending" };
  const request = await repos.matchRequests.create({
    id,
    name: String(data.name).trim(),
    phone: String(data.phone).replace(/[\s.\-]/g, ""),
    whatsapp: data.whatsapp ? String(data.whatsapp).replace(/[\s.\-]/g, "") : null,
    city: String(data.city).trim(),
    area: data.area ? String(data.area).trim() : null,
    service: String(data.service).trim(),
    otherService: data.otherService ? String(data.otherService).trim() : null,
    description: data.description ? String(data.description).trim() : null,
    preferredContact: data.preferredContact || "both",
    preferredDate: data.preferredDate ? new Date(data.preferredDate) : null,
    status: "new",
    notificationStatus,
    createdAt: new Date()
  });

  for (const p of storedPhotos) {
    const photoId = await repos.ids.nextId("matchPhoto");
    await repos.matchPhotos.create({
      id: photoId,
      matchRequestId: id,
      fileName: p.key.split("/").pop(),
      fileUrl: p.url,
      mimeType: p.mimeType,
      size: p.size,
      createdAt: new Date()
    });
  }

  // WhatsApp = notification channel only; never fails the request.
  let whatsappStatus = "pending";
  try {
    const lead = { ...request, id, preferredDate: request.preferredDate };
    const res = await sendMatchLead(lead);
    whatsappStatus = res.whatsapp;
  } catch (err) {
    whatsappStatus = "failed";
  }
  await repos.matchRequests.update(id, {
    notificationStatus: { whatsapp: whatsappStatus },
    updatedAt: new Date()
  });
  request.notificationStatus = { whatsapp: whatsappStatus };

  return { ...request, photos: storedPhotos };
}

async function list(reqCtx, query = {}) {
  const status = query.status && query.status !== "all" ? query.status : undefined;
  if (status && !MATCH_STATUSES.includes(status)) {
    throw new AppError(`Statut invalide. Valeurs: ${MATCH_STATUSES.join(", ")}`, 400);
  }
  return reqCtx.repos.matchRequests.listByStatus(query.status);
}

async function get(reqCtx, id) {
  const repos = reqCtx.repos;
  const request = await repos.matchRequests.get(id);
  if (!request) throw new AppError("Demande de mise en relation introuvable.", 404);
  const photos = await repos.matchPhotos.findByRequest(id);
  return { ...request, photos: photos ? photos.map((p) => ({ id: p.id, fileName: p.fileName, mimeType: p.mimeType, size: p.size, url: p.fileUrl })) : [] };
}

async function getPhoto(reqCtx, id) {
  const photo = await reqCtx.repos.matchPhotos.get(id);
  if (!photo) throw new AppError("Photo introuvable.", 404);
  // fileUrl is `${baseUrl}/${key}` (e.g. /files/match-requests/<rid>/...).
  // Strip just the leading baseUrl to recover the storage key.
  const key = String(photo.fileUrl).replace(/^\/files\//, "");
  const bytes = reqCtx.storage ? await reqCtx.storage.get(key) : null;
  return { photo, bytes };
}

async function updateStatus(reqCtx, id, status, admin) {
  if (!MATCH_STATUSES.includes(status)) {
    throw new AppError(`Statut invalide. Valeurs: ${MATCH_STATUSES.join(", ")}`, 400);
  }
  const repos = reqCtx.repos;
  const request = await repos.matchRequests.get(id);
  if (!request) throw new AppError("Demande de mise en relation introuvable.", 404);
  await repos.matchRequests.update(id, { status, updatedAt: new Date() });
  await repos.auditLogs.log({
    adminId: admin && admin.id,
    action: "MATCH_REQUEST_STATUS_CHANGED",
    entityType: "MatchRequest",
    entityId: id,
    reason: `status -> ${status}`,
    metadata: { status }
  });
  return repos.matchRequests.get(id);
}

async function updateArtisan(reqCtx, id, data, admin) {
  const repos = reqCtx.repos;
  const request = await repos.matchRequests.get(id);
  if (!request) throw new AppError("Demande de mise en relation introuvable.", 404);
  await repos.matchRequests.update(id, {
    artisanName: data.artisanName !== undefined ? String(data.artisanName).trim() : request.artisanName,
    artisanPhone: data.artisanPhone !== undefined ? String(data.artisanPhone).replace(/[\s.\-]/g, "") : request.artisanPhone,
    updatedAt: new Date()
  });
  await repos.auditLogs.log({
    adminId: admin && admin.id, action: "MATCH_REQUEST_ARTISAN_SET",
    entityType: "MatchRequest", entityId: id
  });
  return repos.matchRequests.get(id);
}

async function updatePrices(reqCtx, id, prices, admin) {
  const repos = reqCtx.repos;
  const request = await repos.matchRequests.get(id);
  if (!request) throw new AppError("Demande de mise en relation introuvable.", 404);

  const artisanPrice = prices.artisanPrice === undefined || prices.artisanPrice === null || prices.artisanPrice === ""
    ? null : toNumber(prices.artisanPrice, "artisanPrice");
  const customerPrice = prices.customerPrice === undefined || prices.customerPrice === null || prices.customerPrice === ""
    ? null : toNumber(prices.customerPrice, "customerPrice");
  const commission = prices.commission === undefined || prices.commission === null || prices.commission === ""
    ? null : toNumber(prices.commission, "commission");

  await repos.matchRequests.update(id, { artisanPrice, customerPrice, commission, updatedAt: new Date() });
  await repos.auditLogs.log({
    adminId: admin && admin.id, action: "MATCH_REQUEST_PRICES_SET",
    entityType: "MatchRequest", entityId: id,
    metadata: { artisanPrice, customerPrice, commission }
  });
  return repos.matchRequests.get(id);
}

function toNumber(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new AppError(`${field} doit être un entier positif.`, 400);
  return n;
}

async function retryWhatsApp(reqCtx, id) {
  const repos = reqCtx.repos;
  const request = await repos.matchRequests.get(id);
  if (!request) throw new AppError("Demande de mise en relation introuvable.", 404);

  let status = "pending";
  try {
    const lead = { ...request, id, preferredDate: request.preferredDate };
    const res = await sendMatchLead(lead);
    status = res.whatsapp;
  } catch (err) {
    status = "failed";
  }
  await repos.matchRequests.update(id, {
    notificationStatus: { whatsapp: status },
    whatsappRetryAt: new Date(),
    updatedAt: new Date()
  });
  return repos.matchRequests.get(id);
}

module.exports = {
  create, list, get, getPhoto, updateStatus, updateArtisan, updatePrices, retryWhatsApp,
  MAX_PHOTOS, MAX_PHOTO_BYTES
};
