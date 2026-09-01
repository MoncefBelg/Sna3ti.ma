const { asyncHandler } = require("../utils/asyncHandler");

function createCatalogController(services) {
  return {
    listCategories: asyncHandler(async (_req, res) => {
      const data = await services.categories.list();
      res.json({ data });
    }),
    getCategory: asyncHandler(async (req, res) => {
      const data = await services.categories.get(req.params.id);
      res.json({ data });
    }),
    createCategory: asyncHandler(async (req, res) => {
      const data = await services.categories.create(req.body);
      res.status(201).json({ data });
    }),
    listRegions: asyncHandler(async (_req, res) => {
      const data = await services.regions.list();
      res.json({ data });
    }),
    listPlans: asyncHandler(async (_req, res) => {
      const data = await services.plans ? await services.plans.list() : [];
      res.json({ data });
    })
  };
}

module.exports = { createCatalogController };