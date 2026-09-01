const { Router } = require("express");

function createAuthRoutes(authController, requireAuth) {
  const router = Router();
  router.post("/login", authController.login);
  router.get("/me", requireAuth, authController.me);
  return router;
}

module.exports = { createAuthRoutes };