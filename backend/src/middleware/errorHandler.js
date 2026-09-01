const { AppError } = require("../utils/AppError");
const logger = require("../utils/logger");

function errorHandler(err, req, res, _next) {
  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details || undefined });
  }

  // Prisma-specific mapped errors.
  if (err.code === "P2002") {
    return res.status(409).json({ error: "Cet enregistrement existe déjà (contrainte unique violée)." });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Enregistrement introuvable." });
  }

  // Unexpected / programmer errors.
  logger.error("Unhandled error", { err: err.message, stack: err.stack });
  res.status(500).json({ error: "Erreur interne du serveur." });
}

module.exports = { errorHandler };