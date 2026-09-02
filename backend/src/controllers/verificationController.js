const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { ok, created } = require("../utils/respond");

function createVerificationController(services) {
  return {
    list: asyncHandler(async (req, res) => {
      const result = services.verification.list ? await services.verification.list(req.query) : { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } };
      ok(res, result);
    }),
    get: asyncHandler(async (req, res) => {
      const vr = await services.verification.get(req.params.id);
      ok(res, { data: vr });
    }),
    create: asyncHandler(async (req, res) => {
      const vr = await services.verification.create(req.body);
      created(res, { data: vr });
    }),
    approve: asyncHandler(async (req, res) => {
      const data = await services.verification.approve(req.params.id, req.admin);
      ok(res, { data });
    }),
    reject: asyncHandler(async (req, res) => {
      if (!req.body.reason) throw new AppError("Le motif du rejet est requis.", 400);
      const data = await services.verification.reject(req.params.id, req.body.reason, req.admin);
      ok(res, { data });
    }),
    requestInfo: asyncHandler(async (req, res) => {
      if (!req.body.note) throw new AppError("La note est requise.", 400);
      const data = await services.verification.requestInfo(req.params.id, req.body.note, req.admin);
      ok(res, { data });
    })
  };
}

module.exports = { createVerificationController };
