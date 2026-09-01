// Catalog repositories — categories, regions, cities, plans.

const { createGenericRepository } = require("./base");

function createCategoryRepo(db) {
  const base = createGenericRepository("category", db);
  return {
    ...base,
    findByCode(code) { return base.find({ code }); },
    async listActive() { return base.list({ active: true }, { orderBy: { order: "asc" } }); }
  };
}

function createRegionRepo(db) {
  const base = createGenericRepository("region", db);
  return { ...base };
}

function createCityRepo(db) {
  const base = createGenericRepository("city", db);
  return { ...base };
}

function createPlanRepo(db) {
  const base = createGenericRepository("plan", db);
  return {
    ...base,
    findByCode(code) { return base.find({ code }); },
    findActive() { return base.list({ active: true }); }
  };
}

function createCatalogRepo(db) {
  return {
    categories: createCategoryRepo(db),
    regions: createRegionRepo(db),
    cities: createCityRepo(db),
    plans: createPlanRepo(db)
  };
}

module.exports = { createCatalogRepo };