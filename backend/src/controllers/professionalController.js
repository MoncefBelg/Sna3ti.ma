const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { ok, created } = require("../utils/respond");
const { professionalCreate } = require("../validators/professionals");

function createProfessionalController(services) {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await services.professionals.list(req.query);
      ok(res, result); // { data, pagination }
    }),
    adminList: asyncHandler(async (req, res) => {
      const result = await services.professionals.adminList(req.query);
      ok(res, result); // all statuses — pending accounts are visible & actionable
    }),
    get: asyncHandler(async (req, res) => {
      const pro = await services.professionals.get(req.params.id);
      if (!pro) throw new AppError("Professionnel introuvable.", 404);
      ok(res, { data: pro });
    }),
    create: asyncHandler(async (req, res) => {
      professionalCreate(req.body);
      const pro = await services.professionals.create(req.body, req.admin);
      created(res, { data: pro });
    }),
    remove: asyncHandler(async (req, res) => {
      const result = await services.professionals.remove(req.params.id, req.admin);
      ok(res, { data: result });
    }),
    suspend: asyncHandler(async (req, res) => {
      const pro = await services.professionals.suspend(req.params.id, req.admin, req.body.reason);
      ok(res, { data: pro });
    }),
    activate: asyncHandler(async (req, res) => {
      const pro = await services.professionals.activate(req.params.id, req.admin);
      ok(res, { data: pro });
    }),
    update: asyncHandler(async (req, res) => {
      const pro = await services.professionals.update(req.params.id, req.body, req.admin);
      ok(res, { data: pro });
    }),
    // Public — serve a professional portfolio media file (no auth; portfolio
    // items are meant to be public once a professional is published).
    getMedia: asyncHandler(async (req, res) => {
      const { entry, bytes } = await services.professionals.getMedia(req.params.id, req.params.mediaId);
      if (!bytes || !bytes.buffer) throw new AppError("Fichier introuvable dans le stockage.", 404);
      res.set("Content-Type", entry.mimeType || "application/octet-stream");
      res.set("Content-Disposition", `inline; filename="${entry.id}${entry.type === "video" ? ".mp4" : ".jpg"}"`);
      if (entry.type === "video") res.set("Accept-Ranges", "bytes");
      res.send(bytes.buffer);
    }),
    // Admin — add media to a professional (multipart), plan-gated.
    uploadMedia: asyncHandler(async (req, res) => {
      if (!req.file) throw new AppError("Fichier requis.", 400);
      const data = await services.professionals.uploadMedia(req.params.id, req.file, {
        kind: req.body.kind,
        label: req.body.label
      });
      created(res, { data });
    }),
    // Admin — serve a guarded professional media file.
    getMediaAdmin: asyncHandler(async (req, res) => {
      const { entry, bytes } = await services.professionals.getMedia(req.params.id, req.params.mediaId);
      if (!bytes || !bytes.buffer) throw new AppError("Fichier introuvable dans le stockage.", 404);
      res.set("Content-Type", entry.mimeType || "application/octet-stream");
      res.set("Content-Disposition", `inline; filename="${entry.id}${entry.type === "video" ? ".mp4" : ".jpg"}"`);
      res.send(bytes.buffer);
    }),
    // Admin — remove a single media entry from a professional.
    removeMedia: asyncHandler(async (req, res) => {
      const data = await services.professionals.removeMedia(req.params.id, req.params.mediaId, req.admin);
      ok(res, { data });
    })
  };
}

module.exports = { createProfessionalController };
