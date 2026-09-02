const { asyncHandler } = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");

function createSearchController(services) {
  return {
    search: asyncHandler(async (req, res) => {
      const result = await services.search.search(req.query);
      ok(res, result); // { data, pagination }
    })
  };
}

module.exports = { createSearchController };
