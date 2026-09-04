const { asyncHandler } = require("../utils/asyncHandler");
const { ok, created } = require("../utils/respond");
const { matchCreate } = require("../validators/match");

// Sna3ti Match controller — public create + admin-only management.
function createMatchController(services) {
  return {
    // Public — customer submits a "Trouve-moi un artisan" request.
    create: asyncHandler(async (req, res) => {
      matchCreate(req.body);
      const data = await services.match.create(req.body, req.body.photos);
      created(res, { data });
    }),
    // Admin — list requests.
    list: asyncHandler(async (req, res) => {
      const data = await services.match.list(req.query);
      ok(res, { data });
    }),
    // Admin — request detail (including photo metadata).
    get: asyncHandler(async (req, res) => {
      const data = await services.match.get(req.params.id);
      ok(res, { data });
    }),
    // Admin — serve a private request photo (guarded).
    getPhoto: asyncHandler(async (req, res) => {
      const { photo, bytes } = await services.match.getPhoto(req.params.photoId);
      if (!bytes || !bytes.buffer) throw new Error("Fichier introuvable dans le stockage.");
      res.set("Content-Type", photo.mimeType || "application/octet-stream");
      res.set("Content-Disposition", `inline; filename="${photo.fileName}"`);
      res.send(bytes.buffer);
    }),
    // Admin — update request status.
    updateStatus: asyncHandler(async (req, res) => {
      const data = await services.match.updateStatus(req.params.id, req.body.status, req.admin);
      ok(res, { data });
    }),
    // Admin — set the matched artisan (name / phone).
    updateArtisan: asyncHandler(async (req, res) => {
      const data = await services.match.updateArtisan(req.params.id, req.body, req.admin);
      ok(res, { data });
    }),
    // Admin — enter prices (never auto-generated).
    updatePrices: asyncHandler(async (req, res) => {
      const data = await services.match.updatePrices(req.params.id, req.body, req.admin);
      ok(res, { data });
    }),
    // Admin — retry the WhatsApp notification.
    retryWhatsApp: asyncHandler(async (req, res) => {
      const data = await services.match.retryWhatsApp(req.params.id);
      ok(res, { data });
    })
  };
}

module.exports = { createMatchController };
