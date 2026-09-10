const { asyncHandler } = require("../utils/asyncHandler");
const { ok, created } = require("../utils/respond");

function createAdminController(services) {
  return {
    // ── Analytics (real figures from live repositories) ───────────────────
    getAnalytics: asyncHandler(async (_req, res) => {
      const data = await services.analytics.get();
      ok(res, { data });
    }),

    // ── Admin users ─────────────────────────────────────────────────────
    listAdminUsers: asyncHandler(async (_req, res) => {
      const data = await services.adminUsers.list();
      ok(res, { data });
    }),
    createAdminUser: asyncHandler(async (req, res) => {
      const data = await services.adminUsers.create(req.body);
      created(res, { data });
    }),
    updateAdminUser: asyncHandler(async (req, res) => {
      const data = await services.adminUsers.update(req.params.id, req.body);
      ok(res, { data });
    }),

    // ── Audit logs ──────────────────────────────────────────────────────
    listAuditLogs: asyncHandler(async (_req, res) => {
      const rows = await services.auditLogs.list();
      // Enrich with admin display names and map to the shape the admin UI
      // expects (timestamp/admin/entity/entityId/result/note).
      let adminMap = {};
      try {
        const admins = await services.adminUsers.list();
        (admins && admins.data ? admins.data : admins || []).forEach(function (a) { adminMap[a.id] = a.name; });
      } catch (_) { /* names fall back to ids */ }
      const data = rows.map(function (l) {
        return {
          id: l.id,
          timestamp: l.createdAt ? new Date(l.createdAt).toLocaleString("fr-MA") : "",
          admin: l.adminName || adminMap[l.adminId] || l.adminId || "System",
          action: l.action || "",
          entity: l.entityType || "System",
          entityId: l.entityId || "",
          result: l.reason || "",
          note: l.metadata && typeof l.metadata === "object" ? JSON.stringify(l.metadata) : (l.metadata || ""),
          createdAt: l.createdAt
        };
      });
      ok(res, { data });
    }),
    deleteAuditLog: asyncHandler(async (req, res) => {
      const data = await services.auditLogs.remove(req.params.id);
      ok(res, { data, deleted: true });
    }),
    clearAuditLogs: asyncHandler(async (_req, res) => {
      const data = await services.auditLogs.clear();
      ok(res, { data, deleted: true });
    }),

    // ── Legal documents ─────────────────────────────────────────────────
    updateLegal: asyncHandler(async (req, res) => {
      const data = await services.legal.update(req.params.id, req.body, req.admin);
      ok(res, { data });
    }),

    // ── Reviews / Reports ────────────────────────────────────────────────
    listReviews: asyncHandler(async (_req, res) => {
      const { data } = await services.reviews.listAll();
      // Enrich with professional names so the admin UI never falls back
      // to demo-store lookups (admin only, small overhead).
      let proMap = {};
      try {
        const pros = await services.professionals.list({});
        (pros && pros.data ? pros.data : []).forEach(function (p) { proMap[p.id] = p.name; });
      } catch (_) { /* ignore — names will fall back to id */ }
      const enriched = data.map(function (r) {
        return Object.assign({}, r, { professionalName: proMap[r.professionalId] || r.professionalId });
      });
      ok(res, { data: enriched });
    }),
    listReports: asyncHandler(async (_req, res) => {
      const data = await services.reports.list({});
      ok(res, { data });
    }),

    // ── Dashboard / Analytics ────────────────────────────────────────────
    getDashboard: asyncHandler(async (_req, res) => {
      const [professionals, users, payments, subscriptions, verifications, reviews, reports, support] = await Promise.all([
        services.professionals.list({ limit: 1 }),
        services.users.list(),
        services.payments.list({}),
        services.subscriptions.list({ limit: 1 }),
        services.verification.list({ limit: 1 }),
        services.reviews.listAll(),
        services.reports.list({}),
        services.support.list()
      ]);
      ok(res, {
        data: {
          counts: {
            professionals: Array.isArray(professionals.data) ? professionals.data.length : 0,
            users: Array.isArray(users) ? users.length : 0,
            payments: Array.isArray(payments) ? payments.length : (payments.data ? payments.data.length : 0),
            subscriptions: Array.isArray(subscriptions.data) ? subscriptions.data.length : 0,
            verifications: Array.isArray(verifications.data) ? verifications.data.length : 0,
            reviews: Array.isArray(reviews.data) ? reviews.data.length : 0,
            reports: Array.isArray(reports) ? reports.length : 0,
            support: Array.isArray(support) ? support.length : 0
          }
        }
      });
    }),

    // ── Notifications (admin centre) ─────────────────────────────────────
    listNotifications: asyncHandler(async (_req, res) => {
      const feed = await services.notifications.list();
      ok(res, { data: feed.rows, unreadCount: feed.unreadCount });
    }),
    markAllNotificationsRead: asyncHandler(async (_req, res) => {
      const data = await services.notifications.markAllRead();
      ok(res, { data });
    }),
    markNotificationRead: asyncHandler(async (req, res) => {
      const data = await services.notifications.markRead(req.params.id);
      ok(res, { data });
    }),

    // ── Settings (lightweight config proxy) ──────────────────────────────
    getSettings: asyncHandler(async (_req, res) => {
      ok(res, { data: { siteName: "Sna3ti.ma", currency: "MAD", locale: "fr-MA" } });
    })
  };
}

module.exports = { createAdminController };
