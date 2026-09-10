// Professional media policy service (REQ 53 media pipeline).
//
// Shared VALIDATION only — storage/repo concerns stay in the owning services
// (professionalRequestService / professionalService), so requests and
// professionals reuse exactly the same plan gates and size caps:
//
//   * FREE     → 1 profile photo + 3 échantillon PHOTOS (videos NOT allowed)
//   * VÉRIFIÉ  → 1 profile photo + 10 échantillons (photos or ≤ 3 videos)
//   * GOLD     → 1 profile photo + 20 échantillons (photos or ≤ 3 videos)
//
// Media entries stored on the entity's `media` JSON column:
//   { id, kind: "profile"|"echantillon", type: "photo"|"video", label,
//     fileUrl, key, mimeType, size, added }

const { AppError } = require("../utils/AppError");
const { PLANS } = require("../constants/plans");

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;   // 10 Mo per photo
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;  // 200 Mo per video (multipart)
const MAX_UPLOAD_BYTES = MAX_VIDEO_BYTES;   // multer global per-file cap

function mediaLimitsFor(planCode) {
  const code = String(planCode || "free").toLowerCase();
  const plan = PLANS.find((p) => p.code === code);
  return (plan && plan.limits) || PLANS[0].limits;
}

function mediaTypeOf(mimeType) {
  const m = String(mimeType || "").toLowerCase();
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("image/")) return "photo";
  return null;
}

// Validate a file against the plan limits + existing media and return the
// resolved { type }. Throws AppError (4xx) on any gate violation.
function assertMediaAllowed(planCode, file, existingMedia, { kind } = {}) {
  if (!file || !file.buffer) throw new AppError("Fichier manquant.", 400);
  const k = kind === "profile" ? "profile" : "echantillon";
  const type = mediaTypeOf(file.mimetype);
  if (!type) throw new AppError("Seuls les fichiers image (.jpg, .png, .webp...) et vidéo (.mp4...) sont acceptés.", 400);

  const sizeCap = type === "video" ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
  if (file.size > sizeCap) {
    throw new AppError(type === "video"
      ? "Vidéo trop volumineuse (max 200 Mo)."
      : "Photo trop volumineuse (max 10 Mo).", 400);
  }

  const limits = mediaLimitsFor(planCode);
  const list = (arrayLike, pred) => (Array.isArray(arrayLike) ? arrayLike : []).filter(pred);
  const existing = existingMedia || [];

  if (k === "profile") {
    const profiles = list(existing, (m) => m.kind === "profile").length;
    if (profiles >= limits.profile) {
      throw new AppError("Une seule photo de profil est autorisée (retirez l'actuelle avant d'en ajouter une autre).", 400);
    }
    return { kind: k, type: "photo", limits };
  }

  // échantillon — plan gates (photos vs videos) are server-authoritative.
  const total = list(existing, (m) => m.kind === "echantillon").length;
  if (total >= limits.echantillonTotal) {
    throw new AppError(`Quota d'échantillons atteint (${limits.echantillonTotal} maximum pour cette formule).`, 400);
  }
  if (type === "video") {
    if (limits.echantillonVideos <= 0) {
      throw new AppError("La formule GRATUIT n'autorise pas les vidéos d'échantillons. Passez à Vérifié ou GOLD pour les vidéos.", 400);
    }
    const videos = list(existing, (m) => m.kind === "echantillon" && m.type === "video").length;
    if (videos >= limits.echantillonVideos) {
      throw new AppError(`Maximum de ${limits.echantillonVideos} vidéo(s) pour cette formule.`, 400);
    }
  }
  if (type === "photo") {
    const photos = list(existing, (m) => m.kind === "echantillon" && m.type === "photo").length;
    if (photos >= limits.echantillonPhotos) {
      throw new AppError(`Maximum de ${limits.echantillonPhotos} photos d'échantillons pour cette formule.`, 400);
    }
  }
  return { kind: k, type, limits };
}

function stripStorageKey(entry) {
  if (!entry || !entry.key) return entry;
  const { key, ...rest } = entry;
  return rest;
}

module.exports = {
  mediaLimitsFor,
  mediaTypeOf,
  assertMediaAllowed,
  stripStorageKey,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_UPLOAD_BYTES
};