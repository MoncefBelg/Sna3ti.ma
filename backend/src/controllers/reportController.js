const { asyncHandler } = require("../utils/asyncHandler");
const { ok, created } = require("../utils/respond");

// Reports API (req 22). Users create; admins resolve/reject/warn/suspend.
function createReportController(services) {
  return {
    create: asyncHandler(async (req, res) => {
      const data = await services.reports.create(req.body, req.admin);
      created(res, { data });
    }),
    list: asyncHandler(async (req, res) => {
      const data = await services.reports.list(req.query);
      ok(res, { data });
    }),
    resolve: asyncHandler(async (req, res) => {
      const data = await services.reports.resolve(req.params.id, req.admin, req.body.note);
      ok(res, { data });
    }),
    reject: asyncHandler(async (req, res) => {
      const data = await services.reports.reject(req.params.id, req.admin, req.body.note);
      ok(res, { data });
    }),
    warn: asyncHandler(async (req, res) => {
      const data = await services.reports.warn(req.params.id, req.admin, req.body.note);
      ok(res, { data });
    }),
    suspend: asyncHandler(async (req, res) => {
      const data = await services.reports.suspend(req.params.id, req.admin, req.body.reason);
      ok(res, { data });
    })
  };
}

module.exports = { createReportController };
