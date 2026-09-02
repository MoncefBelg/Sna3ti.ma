const { Router } = require("express");

function createRoutes(services, middleware) {
  const { requireAuth, requirePermission } = middleware;
  const router = Router();

  const authCtrl             = require("../controllers/authController").createAuthController(services);
  const professionalCtrl     = require("../controllers/professionalController").createProfessionalController(services);
  const verificationCtrl     = require("../controllers/verificationController").createVerificationController(services);
  const paymentCtrl          = require("../controllers/paymentController").createPaymentController(services);
  const subscriptionCtrl     = require("../controllers/subscriptionController").createSubscriptionController(services);
  const catalogCtrl          = require("../controllers/catalogController").createCatalogController(services);
  const searchCtrl           = require("../controllers/searchController").createSearchController(services);
  const adminCtrl            = require("../controllers/adminController").createAdminController(services);
  const reviewCtrl           = require("../controllers/reviewController").createReviewController(services);
  const reportCtrl           = require("../controllers/reportController").createReportController(services);
  const legalCtrl            = require("../controllers/legalController").createLegalController(services);
  const notificationCtrl     = require("../controllers/notificationController").createNotificationController(services);

  // ── Auth ────────────────────────────────────────────────────────────────────
  router.post("/auth/login", authCtrl.login);
  router.post("/auth/register", authCtrl.register);
  router.post("/auth/refresh", authCtrl.refresh);
  router.post("/auth/logout", authCtrl.logout);
  router.get("/auth/me", requireAuth, authCtrl.me);

  // ── Public catalog ─────────────────────────────────────────────────────────
  router.get("/categories", catalogCtrl.listCategories);
  router.get("/categories/:id", catalogCtrl.getCategory);
  router.get("/regions", catalogCtrl.listRegions);
  router.get("/plans", catalogCtrl.listPlans);

  // ── Public search ──────────────────────────────────────────────────────────
  router.get("/search", searchCtrl.search);

  // ── Professionals (req 13) ─────────────────────────────────────────────────
  router.get("/professionals", professionalCtrl.list);
  router.get("/professionals/:id", professionalCtrl.get);
  router.post("/professionals", requireAuth, professionalCtrl.create);
  router.patch("/professionals/:id", requireAuth, professionalCtrl.update);
  router.delete("/professionals/:id", requireAuth, professionalCtrl.remove);

  // ── Reviews (req 21) ───────────────────────────────────────────────────────
router.get("/professionals/:professionalId/reviews", reviewCtrl.list);
router.post("/professionals/:professionalId/reviews", requireAuth, reviewCtrl.create);
  router.patch("/reviews/:id", requireAuth, reviewCtrl.update);

  // ── Reports (req 22) ───────────────────────────────────────────────────────
  router.post("/reports", requireAuth, reportCtrl.create);

  // ── Legal content (req 24) — public, published only ───────────────────────
  router.get("/legal/:type/:language", legalCtrl.getByTypeAndLanguage);

  // ── Notifications (req 25) ─────────────────────────────────────────────────
  router.use("/notifications", requireAuth);
  router.post("/notifications/read-all", notificationCtrl.markAllRead);
  router.get("/notifications", notificationCtrl.list);
  router.post("/notifications", notificationCtrl.create);
  router.post("/notifications/:id/read", notificationCtrl.markRead);

  // ── Subscriptions (req 16) ─────────────────────────────────────────────────
  router.get("/subscriptions", subscriptionCtrl.list);
  router.get("/subscriptions/:id", subscriptionCtrl.get);
  router.post("/subscriptions", requireAuth, subscriptionCtrl.create);
  router.patch("/subscriptions/:id", requireAuth, subscriptionCtrl.update);
  router.post("/subscriptions/:id/cancel", requireAuth, subscriptionCtrl.cancel);

  // ── Verifications (req 17) ─────────────────────────────────────────────────
  router.get("/verifications", verificationCtrl.list);
  router.get("/verifications/:id", verificationCtrl.get);
  router.post("/verifications", requireAuth, verificationCtrl.create);
  router.post("/verifications/:id/approve", requireAuth, requirePermission("verification.approve"), verificationCtrl.approve);
  router.post("/verifications/:id/reject", requireAuth, requirePermission("verification.reject"), verificationCtrl.reject);
  router.post("/verifications/:id/request-information", requireAuth, requirePermission("verification.reject"), verificationCtrl.requestInfo);

  // ── Payments (req 19) ──────────────────────────────────────────────────────
  router.post("/payments", requireAuth, paymentCtrl.create);
  router.get("/payments/:id", paymentCtrl.get);

  // ── Admin namespace ────────────────────────────────────────────────────────
  const admin = Router();
  admin.use(requireAuth);

  // Professionals
  admin.get("/professionals", requirePermission("professionals.view"), professionalCtrl.list);
  admin.get("/professionals/:id", requirePermission("professionals.view"), professionalCtrl.get);
  admin.patch("/professionals/:id", requirePermission("professionals.edit"), professionalCtrl.update);
  admin.post("/professionals/:id/suspend", requirePermission("professionals.suspend"), professionalCtrl.suspend);
  admin.post("/professionals/:id/activate", requirePermission("professionals.edit"), professionalCtrl.activate);

  // Payments
  admin.get("/payments", requirePermission("payments.view"), paymentCtrl.list);
  admin.post("/payments/:id/confirm", requirePermission("payments.confirm"), paymentCtrl.confirm);
  admin.post("/payments/:id/reject", requirePermission("payments.reject"), paymentCtrl.reject);

  // Subscriptions
  admin.get("/subscriptions", requirePermission("subscriptions.view"), subscriptionCtrl.list);

  // Verifications
  admin.get("/verifications", requirePermission("verification.view"), verificationCtrl.list);

  // Reviews (req 21) — moderation
  admin.get("/reviews", requirePermission("reviews.view"), adminCtrl.listReviews);
  admin.post("/reviews/:id/publish", requirePermission("reviews.moderate"), reviewCtrl.publish);
  admin.post("/reviews/:id/flag", requirePermission("reviews.moderate"), reviewCtrl.flag);
  admin.post("/reviews/:id/hide", requirePermission("reviews.moderate"), reviewCtrl.hide);
  admin.post("/reviews/:id/delete", requirePermission("reviews.moderate"), reviewCtrl.remove);

  // Reports (req 22)
  admin.get("/reports", requirePermission("reports.view"), reportCtrl.list);
  admin.post("/reports/:id/resolve", requirePermission("reports.resolve"), reportCtrl.resolve);
  admin.post("/reports/:id/reject", requirePermission("reports.resolve"), reportCtrl.reject);
  admin.post("/reports/:id/warn", requirePermission("reports.resolve"), reportCtrl.warn);
  admin.post("/reports/:id/suspend", requirePermission("reports.resolve"), reportCtrl.suspend);

  // Legal (req 24) — admin management
  admin.get("/legal", requirePermission("settings.manage"), legalCtrl.listAll);
  admin.post("/legal/:type/:language", requirePermission("settings.manage"), legalCtrl.create);
  admin.patch("/legal/:id", requirePermission("settings.manage"), adminCtrl.updateLegal);

  // Dashboard / analytics
  admin.get("/dashboard", requirePermission("analytics.view"), adminCtrl.getDashboard);

  // Settings
  admin.get("/settings", requirePermission("settings.manage"), adminCtrl.getSettings);

  // Admin users
  admin.get("/admin-users", requirePermission("admin_users.manage"), adminCtrl.listAdminUsers);
  admin.post("/admin-users", requirePermission("admin_users.manage"), adminCtrl.createAdminUser);
  admin.patch("/admin-users/:id", requirePermission("admin_users.manage"), adminCtrl.updateAdminUser);

  // Audit logs (req 23) — read-only; append-only, no modify/delete endpoints.
  admin.get("/audit-logs", requirePermission("audit_logs.view"), adminCtrl.listAuditLogs);

  router.use("/admin", admin);

  return router;
}

module.exports = { createRoutes };
