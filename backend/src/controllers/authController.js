const { asyncHandler } = require("../utils/asyncHandler");

function createAuthController(services) {
  return {
    login: asyncHandler(async (req, res) => {
      const result = await services.auth.login(req.body);
      res.json(result);
    }),
    me: asyncHandler(async (req, res) => {
      const user = await services.auth.getMe(req.admin.id);
      res.json({ data: user });
    })
  };
}

module.exports = { createAuthController };