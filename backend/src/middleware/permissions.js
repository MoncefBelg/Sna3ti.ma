const { AppError } = require("../utils/AppError");
const { can } = require("../constants/roles");

function createPermissionMiddleware() {
  return function requirePermission(resource, action) {
    return function(req, res, next) {
      if (!req.admin || !can(req.admin.role, resource, action)) {
        throw new AppError("Vous n'avez pas la permission d'accéder à cette ressource.", 403);
      }
      next();
    };
  };
}

module.exports = { createPermissionMiddleware };