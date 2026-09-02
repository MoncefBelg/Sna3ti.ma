const { asyncHandler } = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { ok, created } = require("../utils/respond");

// Legal content (req 24). Public reads (published only) + admin write.
function createLegalController(services) {
  return {
    listPublished: asyncHandler(async (_req, res) => {
      const data = await services.legal.list({ published: true });
      ok(res, { data });
    }),
    getByTypeAndLanguage: asyncHandler(async (req, res) => {
      const { type, language } = req.params;
      const doc = await services.legal.getByTypeAndLanguage(type, language, { publishedOnly: true });
      if (!doc) throw new AppError("Document légal introuvable ou non publié.", 404);
      ok(res, { data: doc });
    }),
    listAll: asyncHandler(async (_req, res) => {
      const data = await services.legal.list({});
      ok(res, { data });
    }),
    create: asyncHandler(async (req, res) => {
      const { type, language } = req.params;
      const data = await services.legal.create({ type, language, ...req.body }, req.admin);
      created(res, { data });
    }),
    update: asyncHandler(async (req, res) => {
      const data = await services.legal.update(req.params.id, req.body, req.admin);
      ok(res, { data });
    })
  };
}

module.exports = { createLegalController };
