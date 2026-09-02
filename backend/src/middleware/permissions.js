const { AppError } = require("../utils/AppError");
const { can } = require("../constants/roles");

// Server-side RBAC guard. `permission` is a dotted string (e.g.
// "professionals.suspend", "payments.confirm"). The role is ALWAYS read from
// the authenticated session (req.admin, populated from the JWT by
// requireAuth) — never from anything the client sends in the body/query.
function createPermissionMiddleware() {
  return function requirePermission(permission) {
    return function (req, res, next) {
      if (!req.admin || !can(req.admin.role, permission)) {
        throw new AppError("Vous n'avez pas la permission d'accéder à cette ressource.", 403);
      }
      next();
    };
  };
}

module.exports = { createPermissionMiddleware };
