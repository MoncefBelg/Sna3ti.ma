const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { createRepos } = require("./repositories");
const { createServices } = require("./services");
const { createRoutes } = require("./routes");
const { createAuthMiddleware } = require("./middleware/auth");
const { createPermissionMiddleware } = require("./middleware/permissions");
const { errorHandler } = require("./middleware/errorHandler");
const { notFound } = require("./middleware/notFound");
const { createStorageService } = require("./storage");
const env = require("./config/env");

// Basic production hardening (req 29): helmet headers, CORS allow-list,
// per-route rate limiting, JSON body size limit, safe error responses.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 300 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Trop de requêtes. Réessayez plus tard." } }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 20 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Trop de tentatives de connexion. Réessayez plus tard." } }
});

/**
 * Creates the Express app. Accepts an optional `db` adapter so tests inject
 * InMemoryDb while production uses Prisma.
 */
function createApp({ db }) {
  const app = express();
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors({
    origin: env.corsOrigins.length ? env.corsOrigins : true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  const repos = createRepos(db);
  const services = createServices(repos);
  // File storage is injected here (req 26) — controllers/services only ever
  // depend on the abstract StorageService.
  services.storage = createStorageService(env.storage);

  const requireAuth = createAuthMiddleware(services);
  const requirePermission = createPermissionMiddleware();

  // Rate limiting on authenticated/mutating surfaces.
  app.use("/api/v1/auth/login", authLimiter);
  app.use("/api/v1", apiLimiter);

  // Mount versioned routes. All API routes live under /api/v1 (req 12).
  app.use("/api/v1", createRoutes(services, { requireAuth, requirePermission }));

  // 404 catch-all.
  app.use(notFound);

  // Central error handler (must come last).
  app.use(errorHandler);

  app.locals.services = services;
  app.locals.repos = repos;

  return app;
}

module.exports = { createApp };
