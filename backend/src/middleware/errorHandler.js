const { AppError } = require("../utils/AppError");
const logger = require("../utils/logger");

// Map an HTTP status to a stable machine-readable error code (req 28).
function codeFor(status, details) {
  if (status === 400) return details && Array.isArray(details) ? "VALIDATION_ERROR" : "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  return "INTERNAL_ERROR";
}

function render(res, status, code, message, details) {
  const body = { success: false, error: { code, message } };
  if (details !== undefined && details !== null) body.error.details = details;
  return res.status(status).json(body);
}

function errorHandler(err, req, res, _next) {
  if (err.isOperational) {
    const code = err.code && !err.statusCode ? err.code : codeFor(err.statusCode, err.details);
    return render(res, err.statusCode, code, err.message, err.details);
  }

  // Prisma-specific mapped errors.
  if (err.code === "P2002") {
    return render(res, 409, "CONFLICT", "Cet enregistrement existe déjà (contrainte unique violée).");
  }
  if (err.code === "P2025") {
    return render(res, 404, "NOT_FOUND", "Enregistrement introuvable.");
  }

  // Unexpected / programmer errors — never leak internals to the client.
  logger.error("Unhandled error", { err: err.message, stack: err.stack });
  render(res, 500, "INTERNAL_ERROR", "Erreur interne du serveur.");
}

module.exports = { errorHandler, codeFor };
