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
    })
  };
}

module.exports = { createProfessionalController };
