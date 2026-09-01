const { PrismaClient } = require("@prisma/client");
const env = require("./env");
const logger = require("../utils/logger");

// Single shared Prisma client for the whole process (hot-reload safe guard).
const prisma = global.__sna3tiPrisma || new PrismaClient({ datasources: { db: { url: env.databaseUrl } } });

if (!global.__sna3tiPrisma) {
  global.__sna3tiPrisma = prisma;
  prisma.$connect().then(
    () => logger.info("PostgreSQL connected"),
    (err) => logger.error("PostgreSQL connection failed", { err: err.message })
  );
}

async function disconnectDb() {
  try { await prisma.$disconnect(); } catch (e) { /* already closed */ }
}

module.exports = { prisma, disconnectDb };