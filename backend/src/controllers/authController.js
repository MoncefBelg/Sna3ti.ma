const { asyncHandler } = require("../utils/asyncHandler");
const { ok, created } = require("../utils/respond");

function createAuthController(services) {
  return {
    login: asyncHandler(async (req, res) => {
      const result = await services.auth.login(req.body);
      ok(res, result);
    }),
    register: asyncHandler(async (req, res) => {
      const result = await services.auth.register(req.body);
      created(res, result);
    }),
    refresh: asyncHandler(async (req, res) => {
      const result = await services.auth.refresh(req.body);
      ok(res, result);
    }),
    logout: asyncHandler(async (_req, res) => {
      const result = await services.auth.logout();
      ok(res, result);
    }),
    me: asyncHandler(async (req, res) => {
      const user = await services.auth.getMe(req.admin);
      ok(res, { data: user });
    })
  };
}

module.exports = { createAuthController };
