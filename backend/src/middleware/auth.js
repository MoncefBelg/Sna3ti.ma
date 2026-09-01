const { AppError } = require("../utils/AppError");

// Requires a valid JWT in the Authorization header. Populates req.admin with
// the decoded token (or the fresh DB record if the auth service is available).
function createAuthMiddleware(services) {
  return function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new AppError("Authentification requise.", 401);

    const decoded = services.auth.verifyToken(match[1]);
    if (!decoded) throw new AppError("Session invalide ou expirée.", 401);

    req.admin = { id: decoded.sub, role: decoded.role, name: decoded.name };
    next();
  };
}

module.exports = { createAuthMiddleware };