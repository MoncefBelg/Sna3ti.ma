const { Router } = require("express");

function createPublicRoutes(catalogCtrl) {
  const router = Router();
  router.get("/categories", catalogCtrl.listCategories);
  router.get("/categories/:id", catalogCtrl.getCategory);
  router.get("/regions", catalogCtrl.listRegions);
  router.get("/plans", catalogCtrl.listPlans);
  return router;
}

module.exports = { createPublicRoutes };