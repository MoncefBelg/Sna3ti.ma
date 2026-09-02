const { asyncHandler } = require("../utils/asyncHandler");
const { ok, created } = require("../utils/respond");

function createCatalogController(services) {
  return {
    listCategories: asyncHandler(async (_req, res) => {
      const data = await services.categories.list();
      ok(res, { data });
    }),
    getCategory: asyncHandler(async (req, res) => {
      const data = await services.categories.get(req.params.id);
      ok(res, { data });
    }),
    createCategory: asyncHandler(async (req, res) => {
      const data = await services.categories.create(req.body);
      created(res, { data });
    }),
    listRegions: asyncHandler(async (_req, res) => {
      const data = await services.regions.list();
      ok(res, { data });
    }),
    listPlans: asyncHandler(async (_req, res) => {
      const data = services.plans ? await services.plans.list() : [];
      ok(res, { data });
    })
  };
}

module.exports = { createCatalogController };
