const { asyncHandler } = require("../utils/asyncHandler");
const { ok, created } = require("../utils/respond");

// Reviews API (req 21). Public list + auth create/edit; moderation under /admin.
function createReviewController(services) {
  return {
    list: asyncHandler(async (req, res) => {
      const data = await services.reviews.list(req.params.professionalId, {});
      ok(res, { data });
    }),
    create: asyncHandler(async (req, res) => {
      const data = await services.reviews.create(req.params.professionalId, req.body, req.admin);
      created(res, { data });
    }),
    update: asyncHandler(async (req, res) => {
      const data = await services.reviews.update(req.params.id, req.body, req.admin);
      ok(res, { data });
    }),
    // Admin moderation
    publish: asyncHandler(async (req, res) => {
      const data = await services.reviews.moderate(req.params.id, "publish", req.admin, req.body.reason);
      ok(res, { data });
    }),
    flag: asyncHandler(async (req, res) => {
      const data = await services.reviews.moderate(req.params.id, "flag", req.admin, req.body.reason);
      ok(res, { data });
    }),
    hide: asyncHandler(async (req, res) => {
      const data = await services.reviews.moderate(req.params.id, "hide", req.admin, req.body.reason);
      ok(res, { data });
    }),
    remove: asyncHandler(async (req, res) => {
      const data = await services.reviews.moderate(req.params.id, "delete", req.admin, req.body.reason);
      ok(res, { data });
    })
  };
}

module.exports = { createReviewController };
