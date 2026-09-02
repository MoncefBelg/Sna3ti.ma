const { asyncHandler } = require("../utils/asyncHandler");
const { ok, created } = require("../utils/respond");

function createAdminController(services) {
  return {
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
      const data = await services.auditLogs.list();
      ok(res, { data });
    }),

    // ── Legal documents ─────────────────────────────────────────────────
    updateLegal: asyncHandler(async (req, res) => {
      const data = await services.legal.update(req.params.id, req.body, req.admin);
      ok(res, { data });
    }),

    // ── Reviews / Reports ────────────────────────────────────────────────
    listReviews: asyncHandler(async (_req, res) => {
      const { data } = await services.reviews.listAll();
      ok(res, { data });
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

    // ── Settings (lightweight config proxy) ──────────────────────────────
    getSettings: asyncHandler(async (_req, res) => {
      ok(res, { data: { siteName: "Sna3ti.ma", currency: "MAD", locale: "fr-MA" } });
    })
  };
}

module.exports = { createAdminController };
