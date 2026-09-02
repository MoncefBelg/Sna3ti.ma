const { Router } = require("express");

function createAuthRoutes(authController, requireAuth) {
  const router = Router();
  router.post("/login", authController.login);
  router.post("/register", authController.register);
  router.post("/refresh", authController.refresh);
  router.post("/logout", authController.logout);
  router.get("/me", requireAuth, authController.me);
  return router;
}

module.exports = { createAuthRoutes };
