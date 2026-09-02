const { AppError } = require("../utils/AppError");

// Requires a valid JWT in the Authorization header. Populates req.admin with
// the decoded token (id + role). Token payload is intentionally MINIMAL — we
// never put the password or full profile in the JWT. For admin actors, the
// fresh DB record is fetched so `name` is available for the /admin services.
function createAuthMiddleware(services) {
  return function requireAuth(req, res, next) {
    run(req).then(next, next);
  };

  async function run(req) {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new AppError("Authentification requise.", 401);

    const decoded = services.auth.verifyToken(match[1]);
    if (!decoded) throw new AppError("Session invalide ou expirée.", 401);

    req.admin = { id: decoded.sub, role: decoded.role };

    // Try to attach the admin's name when the subject is an AdminUser (needed
    // by /admin services). If the subject is a platform User, getAdmin returns
    // null and we simply leave `name` unset.
    const admin = await services.auth.getAdmin(decoded.sub);
    if (admin) req.admin.name = admin.name;
  }
}

module.exports = { createAuthMiddleware };
