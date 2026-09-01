const express = require("express");
const cors = require("cors");
const { createRepos } = require("./repositories");
const { createServices } = require("./services");
const { createRoutes } = require("./routes");
const { createAuthMiddleware } = require("./middleware/auth");
const { createPermissionMiddleware } = require("./middleware/permissions");
const { errorHandler } = require("./middleware/errorHandler");
const { notFound } = require("./middleware/notFound");
const logger = require("./utils/logger");

/**
 * Creates the Express app. Accepts an optional `db` adapter so that
 * tests can pass an InMemoryDb while production uses Prisma.
 */
function createApp({ db }) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Build the service graph from the injected db.
  const repos   = createRepos(db);
  const services = createServices(repos);

  const requireAuth     = createAuthMiddleware(services);
  const requirePermission = createPermissionMiddleware();

  // Mount routes.
  app.use(createRoutes(services, { requireAuth, requirePermission }));

  // 404 catch-all.
  app.use(notFound);

  // Central error handler (must come last).
  app.use(errorHandler);

  // Expose internals for integration tests.
  app.locals.services = services;
  app.locals.repos    = repos;

  return app;
}

module.exports = { createApp };