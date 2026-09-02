const { asyncHandler } = require("../utils/asyncHandler");
const { ok, created } = require("../utils/respond");

// Notifications API (req 25). Scoped to the authenticated user (req.admin.id).
function createNotificationController(services) {
  return {
    list: asyncHandler(async (req, res) => {
      const data = await services.notifications.list(req.admin && req.admin.id);
      ok(res, { data });
    }),
    create: asyncHandler(async (req, res) => {
      const data = await services.notifications.create({ ...req.body, userId: req.admin && req.admin.id });
      created(res, { data });
    }),
    markRead: asyncHandler(async (req, res) => {
      const data = await services.notifications.markRead(req.params.id, req.admin && req.admin.id);
      ok(res, { data });
    }),
    markAllRead: asyncHandler(async (req, res) => {
      const data = await services.notifications.markAllRead(req.admin && req.admin.id);
      ok(res, { data });
    })
  };
}

module.exports = { createNotificationController };
