const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");

function createPaymentController(services) {
  return {
    list: asyncHandler(async (req, res) => {
      const data = await services.payments.list ? await services.payments.list(req.query) : [];
      res.json({ data });
    }),
    get: asyncHandler(async (req, res) => {
      const data = await services.payments.get ? await services.payments.get(req.params.id) : null;
      if (!data) throw new AppError("Paiement introuvable.", 404);
      res.json({ data });
    }),
    confirm: asyncHandler(async (req, res) => {
      const data = await services.payments.confirm(req.params.id, req.admin);
      res.json({ data });
    }),
    reject: asyncHandler(async (req, res) => {
      if (!req.body.reason) throw new AppError("Le motif du rejet est requis.", 400);
      const data = await services.payments.reject(req.params.id, req.body.reason, req.admin);
      res.json({ data });
    }),
    requestInfo: asyncHandler(async (req, res) => {
      if (!req.body.note) throw new AppError("La note est requise.", 400);
      const data = await services.payments.requestInfo(req.params.id, req.body.note, req.admin);
      res.json({ data });
    })
  };
}

module.exports = { createPaymentController };