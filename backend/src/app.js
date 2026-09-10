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

// Dedicated limiters for the WhatsApp-trust surfaces (record/confirm contact,
// review submission). Keeping spam specific to these endpoints away from the
// general API budget.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 60 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Trop de requêtes de contact. Réessayez plus tard." } }
});

const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 20 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Trop d'avis soumis. Réessayez plus tard." } }
});

// Account-free artisan onboarding submissions (REQ 53): individually budgeted
// so one abusive source can't flood the admin's application queue.
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 20 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Trop de demandes d'inscription. Réessayez plus tard." } }
});

/**
 * Creates the Express app. Accepts an optional `db` adapter so tests inject
 * InMemoryDb while production uses Prisma.
 */
function createApp({ db }) {
  const app = express();
  app.disable("x-powered-by");

  app.use(helmet());

  // Helmet defaults to `Cross-Origin-Resource-Policy: same-origin`. That is
  // fine for API JSON, but it makes browsers BLOCK cross-origin renderings of
  // our media — the admin SPA (localhost:8080, marketplace, etc.) displays
  // these files with plain <img>/<video> tags that cannot send CORS headers.
  // Relax CORP (and X-Frame-Options, so the same file may open in a new tab
  // for the admin "Voir" action) only for byte-serving media endpoints.
  app.use(function (req, res, next) {
    if (/(^|\/)media\/[^/]+$/.test(req.path) || /(^|\/)photo\/[^/]+$/.test(req.path)) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.removeHeader("X-Frame-Options");
    }
    next();
  });
  app.use(cors({
    origin: env.corsOrigins.length ? env.corsOrigins : true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }));
  // 30 MB JSON cap: Sna3ti Match photos arrive as base64 data-URLs (up to
  // 5 photos x 3 MB each per matchService), which inflates ~33% in JSON.
  // 1 MB rejected real customer photos with an unhandled 413 -> request 500.
  app.use(express.json({ limit: "30mb" }));
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
  app.use("/api/v1", createRoutes(services, { requireAuth, requirePermission, contactLimiter, reviewLimiter, requestLimiter }));

  // 404 catch-all.
  app.use(notFound);

  // Central error handler (must come last).
  app.use(errorHandler);

  app.locals.services = services;
  app.locals.repos = repos;

  return app;
}

module.exports = { createApp };
