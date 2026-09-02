const { asyncHandler } = require("../utils/asyncHandler");
const { ok, created } = require("../utils/respond");

function createSubscriptionController(services) {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await services.subscriptions.list(req.query);
      ok(res, result); // { data, pagination }
    }),
    get: asyncHandler(async (req, res) => {
      const sub = await services.subscriptions.get(req.params.id);
      ok(res, { data: sub });
    }),
    create: asyncHandler(async (req, res) => {
      const sub = await services.subscriptions.create(req.body, req.admin);
      created(res, { data: sub });
    }),
    update: asyncHandler(async (req, res) => {
      const sub = await services.subscriptions.update(req.params.id, req.body, req.admin);
      ok(res, { data: sub });
    }),
    cancel: asyncHandler(async (req, res) => {
      const sub = await services.subscriptions.cancel(req.params.id, req.admin);
      ok(res, { data: sub });
    })
  };
}

module.exports = { createSubscriptionController };
