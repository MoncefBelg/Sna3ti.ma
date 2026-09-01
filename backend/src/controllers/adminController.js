const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");

function createAdminController(services) {
  return {
    // ── Admin users ─────────────────────────────────────────────────────
    listAdminUsers: asyncHandler(async (_req, res) => {
      const data = await services.adminUsers.list();
      res.json({ data });
    }),
    createAdminUser: asyncHandler(async (req, res) => {
      const data = await services.adminUsers.create(req.body);
      res.status(201).json({ data });
    }),
    updateAdminUser: asyncHandler(async (req, res) => {
      const data = await services.adminUsers.update(req.params.id, req.body);
      res.json({ data });
    }),

    // ── Audit logs ──────────────────────────────────────────────────────
    listAuditLogs: asyncHandler(async (_req, res) => {
      const data = await services.auditLogs.list();
      res.json({ data });
    }),

    // ── Legal documents ─────────────────────────────────────────────────
    updateLegal: asyncHandler(async (req, res) => {
      const data = await services.legal.update(req.params.id, req.body, req.admin);
      res.json({ data });
    }),

    // ── Notifications ───────────────────────────────────────────────────
    listNotifications: asyncHandler(async (req, res) => {
      const data = await services.notifications.list(req.query.filter);
      res.json({ data });
    }),
    markAllNotificationsRead: asyncHandler(async (_req, res) => {
      await services.notifications.markAllRead();
      res.json({ ok: true });
    }),
    markNotificationRead: asyncHandler(async (req, res) => {
      await services.notifications.markRead(req.params.id);
      res.json({ ok: true });
    }),

    // ── Settings (lightweight config proxy) ──────────────────────────────
    getSettings: asyncHandler(async (_req, res) => {
      res.json({ data: { siteName: "Sna3ti.ma", currency: "MAD", locale: "fr-MA" } });
    })
  };
}

module.exports = { createAdminController };