require("./config/env");
const { connectDB, disconnectDB } = require("./config/database");
const { createApp } = require("./app");
const logger = require("./utils/logger");

async function main() {
  await connectDB();

  // Import the connected PrismaClient instance.
  const { prisma } = require("./config/database");
  const app = createApp({ db: prisma });

  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => {
    logger.info(`Sna3ti API running on :${port}`);
  });

  // Graceful shutdown.
  async function shutdown(signal) {
    logger.info(`\n${signal} received – shutting down…`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-kill after 10s.
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});