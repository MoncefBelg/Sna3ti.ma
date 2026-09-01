const { Router } = require("express");
const { createAuthRoutes } = require("./auth");
const { createAdminRoutes } = require("./admin");
const { createPublicRoutes } = require("./public");

function createRoutes(services, middleware) {
  const { requireAuth, requirePermission } = middleware;
  const router = Router();

  // ── Auth ────────────────────────────────────────────────────────────────────
  router.use("/auth", createAuthRoutes(
    require("../controllers/authController").createAuthController(services),
    requireAuth
  ));

  // ── Public (no auth required) ───────────────────────────────────────────────
  router.use("/public", createPublicRoutes(
    require("../controllers/catalogController").createCatalogController(services)
  ));

  // ── Admin (auth + permission required) ──────────────────────────────────────
  router.use("/admin", createAdminRoutes(
    require("../controllers/professionalController").createProfessionalController(services),
    require("../controllers/verificationController").createVerificationController(services),
    require("../controllers/paymentController").createPaymentController(services),
    require("../controllers/adminController").createAdminController(services),
    require("../controllers/catalogController").createCatalogController(services),
    requireAuth,
    requirePermission
  ));

  return router;
}

module.exports = { createRoutes };