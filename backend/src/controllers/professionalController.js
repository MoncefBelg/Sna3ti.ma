const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");

function createProfessionalController(services) {
  return {
    list: asyncHandler(async (req, res) => {
      const data = await services.professionals.list(req.query);
      res.json({ data });
    }),
    get: asyncHandler(async (req, res) => {
      const pro = await services.professionals.get(req.params.id);
      if (!pro) throw new AppError("Professionnel introuvable.", 404);
      res.json({ data: pro });
    }),
    suspend: asyncHandler(async (req, res) => {
      const pro = await services.professionals.suspend(req.params.id, req.admin, req.body.reason);
      res.json({ data: pro });
    }),
    activate: asyncHandler(async (req, res) => {
      const pro = await services.professionals.activate(req.params.id, req.admin);
      res.json({ data: pro });
    }),
    update: asyncHandler(async (req, res) => {
      const pro = await services.professionals.update(req.params.id, req.body, req.admin);
      res.json({ data: pro });
    })
  };
}

module.exports = { createProfessionalController };