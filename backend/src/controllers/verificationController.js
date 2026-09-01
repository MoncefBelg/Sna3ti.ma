const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");

function createVerificationController(services) {
  return {
    list: asyncHandler(async (req, res) => {
      const data = await services.verification.list ? await services.verification.list(req.query) : [];
      res.json({ data });
    }),
    approve: asyncHandler(async (req, res) => {
      const data = await services.verification.approve(req.params.id, req.admin);
      res.json({ data });
    }),
    reject: asyncHandler(async (req, res) => {
      if (!req.body.reason) throw new AppError("Le motif du rejet est requis.", 400);
      const data = await services.verification.reject(req.params.id, req.body.reason, req.admin);
      res.json({ data });
    }),
    requestInfo: asyncHandler(async (req, res) => {
      if (!req.body.note) throw new AppError("La note est requise.", 400);
      const data = await services.verification.requestInfo(req.params.id, req.body.note, req.admin);
      res.json({ data });
    })
  };
}

module.exports = { createVerificationController };