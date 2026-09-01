// Operational errors controlled by the application. The errorHandler
// middleware renders these with the expected HTTP status; anything else
// falls through to a 500.

class AppError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { AppError };