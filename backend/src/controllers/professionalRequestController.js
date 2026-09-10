const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { ok, created } = require("../utils/respond");
const { professionalRequestCreate } = require("../validators/professionalRequest");

// Account-free artisan onboarding controller — public create + admin review
// (list / detail / approve / reject).
function createProfessionalRequestController(services) {
  return {
    // Public — artisan submits an onboarding / subscription request.
    create: asyncHandler(async (req, res) => {
      const clean = professionalRequestCreate(req.body);
      const data = await services.professionalRequests.create(clean);
      created(res, { data });
    }),
    // Admin — list requests with search + filters (status / plan / city) +
    // server-side pagination/sort, plus global counts (REQ 55). Envelope:
    // { data, pagination, counts } — `data` stays an array (REQ 54 compat).
    list: asyncHandler(async (req, res) => {
      const result = await services.professionalRequests.list(req.query);
      ok(res, result);
    }),
    // Admin — request detail.
    get: asyncHandler(async (req, res) => {
      const data = await services.professionalRequests.get(req.params.id);
      ok(res, { data });
    }),
    // Admin — approve a pending registration (pending -> approved).
    approve: asyncHandler(async (req, res) => {
      const data = await services.professionalRequests.approve(req.params.id, req.admin);
      ok(res, { data });
    }),
    // Admin — reject a pending registration (pending -> rejected); reason required.
    reject: asyncHandler(async (req, res) => {
      if (!req.body || !req.body.reason || !String(req.body.reason).trim()) {
        throw new AppError("Le motif du rejet est requis.", 400);
      }
      const data = await services.professionalRequests.reject(req.params.id, req.body.reason, req.admin);
      ok(res, { data });
    }),
    // Public — multipart media upload (the wizard attaches photos/videos to a
    // just-created request). Fields: file (single), kind (profile|echantillon),
    // label. Plan gates + size caps are enforced server-side.
    uploadMedia: asyncHandler(async (req, res) => {
      if (!req.file) throw new AppError("Fichier requis.", 400);
      const data = await services.professionalRequests.uploadMedia(req.params.id, req.file, {
        kind: req.body.kind,
        label: req.body.label
      });
      created(res, { data });
    }),
    // Admin — serve a guarded request media file.
    getMedia: asyncHandler(async (req, res) => {
      const { entry, bytes } = await services.professionalRequests.getMedia(req.params.id, req.params.mediaId);
      if (!bytes || !bytes.buffer) throw new AppError("Fichier introuvable dans le stockage.", 404);
      res.set("Content-Type", entry.mimeType || "application/octet-stream");
      res.set("Content-Disposition", `inline; filename="${entry.id}${entry.type === "video" ? ".mp4" : ".jpg"}"`);
      res.send(bytes.buffer);
    }),
    // Admin — remove a single media entry from a request.
    removeMedia: asyncHandler(async (req, res) => {
      const data = await services.professionalRequests.removeMedia(req.params.id, req.params.mediaId, req.admin);
      ok(res, { data });
    })
  };
}

module.exports = { createProfessionalRequestController };