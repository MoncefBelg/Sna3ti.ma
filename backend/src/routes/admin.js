const { Router } = require("express");

function createAdminRoutes(professionalCtrl, verificationCtrl, paymentCtrl, adminCtrl, catalogCtrl, requireAuth, requirePermission) {
  const router = Router();

  // All admin routes require authentication.
  router.use(requireAuth);

  // ── Professionals ───────────────────────────────────────────────────────────
  router.get("/professionals",        requirePermission("professionals","read"),    professionalCtrl.list);
  router.get("/professionals/:id",    requirePermission("professionals","read"),    professionalCtrl.get);
  router.patch("/professionals/:id/suspend", requirePermission("professionals","suspend"), professionalCtrl.suspend);
  router.patch("/professionals/:id/activate", requirePermission("professionals","edit"), professionalCtrl.activate);
  router.patch("/professionals/:id",  requirePermission("professionals","edit"),    professionalCtrl.update);

  // ── Verification ────────────────────────────────────────────────────────────
  router.get("/verification",               requirePermission("verification","read"),     verificationCtrl.list);
  router.post("/verification/:id/approve",  requirePermission("verification","approve"),  verificationCtrl.approve);
  router.post("/verification/:id/reject",   requirePermission("verification","reject"),   verificationCtrl.reject);
  router.post("/verification/:id/info",     requirePermission("verification","info"),     verificationCtrl.requestInfo);

  // ── Payments ────────────────────────────────────────────────────────────────
  router.get("/payments",                   requirePermission("payments","read"),     paymentCtrl.list);
  router.get("/payments/:id",               requirePermission("payments","read"),     paymentCtrl.get);
  router.post("/payments/:id/confirm",      requirePermission("payments","approve"),  paymentCtrl.confirm);
  router.post("/payments/:id/reject",       requirePermission("payments","reject"),   paymentCtrl.reject);
  router.post("/payments/:id/info",         requirePermission("payments","info"),     paymentCtrl.requestInfo);

  // ── Admin users ─────────────────────────────────────────────────────────────
  router.get("/admin-users",         requirePermission("adminUsers","read"),     adminCtrl.listAdminUsers);
  router.post("/admin-users",        requirePermission("adminUsers","create"),   adminCtrl.createAdminUser);
  router.patch("/admin-users/:id",   requirePermission("adminUsers","edit"),     adminCtrl.updateAdminUser);

  // ── Audit logs ──────────────────────────────────────────────────────────────
  router.get("/audit-logs",          requirePermission("auditLogs","read"),      adminCtrl.listAuditLogs);

  // ── Legal ───────────────────────────────────────────────────────────────────
  router.patch("/legal/:id",         requirePermission("legal","update"),        adminCtrl.updateLegal);

  // ── Notifications ───────────────────────────────────────────────────────────
  router.get("/notifications",               requirePermission("notifications","read"),   adminCtrl.listNotifications);
  router.post("/notifications/read-all",     requirePermission("notifications","edit"),   adminCtrl.markAllNotificationsRead);
  router.post("/notifications/:id/read",     requirePermission("notifications","edit"),   adminCtrl.markNotificationRead);

  // ── Catalog ─────────────────────────────────────────────────────────────────
  router.get("/categories",          requirePermission("categories","read"),     catalogCtrl.listCategories);
  router.post("/categories",         requirePermission("categories","create"),   catalogCtrl.createCategory);
  router.get("/categories/:id",      requirePermission("categories","read"),     catalogCtrl.getCategory);
  router.get("/regions",             requirePermission("regions","read"),        catalogCtrl.listRegions);
  router.get("/plans",               requirePermission("plans","read"),          catalogCtrl.listPlans);

  // ── Settings ────────────────────────────────────────────────────────────────
  router.get("/settings",            adminCtrl.getSettings);

  return router;
}

module.exports = { createAdminRoutes };