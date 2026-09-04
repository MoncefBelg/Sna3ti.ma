const dotenv = require("dotenv");

dotenv.config();

const isTest = process.env.NODE_ENV === "test";

function required(name, allowEmptyInTest = false) {
  const value = process.env[name];
  if (!value || (!isTest && !allowEmptyInTest && value.trim() === "")) {
    if (isTest && allowEmptyInTest) return value || "";
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest,
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl: isTest ? (process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/sna3ti") : required("DATABASE_URL"),
  jwtSecret: isTest ? (process.env.JWT_SECRET || "test-secret-not-for-prod") : required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  corsOrigins: (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  // StorageService config (req 26). Default to local disk; swap the driver per
  // env (s3 / cloudinary / r2) without touching controllers.
  storage: {
    driver: process.env.STORAGE_DRIVER || "local",
    root: process.env.STORAGE_ROOT || "storage",
    baseUrl: process.env.STORAGE_BASE_URL || "/files"
  },
  // WhatsApp Business API (NOTIFICATION CHANNEL ONLY — never the source of
  // truth). Optional: if unset, match-lead notifications are stored as
  // "pending" and can be retried from the admin dashboard.
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || "",
    apiToken: process.env.WHATSAPP_API_TOKEN || "",
    businessPhone: process.env.WHATSAPP_BUSINESS_PHONE || "",
    defaultRecipient: process.env.WHATSAPP_DEFAULT_RECIPIENT || ""
  }
};

// Guards against a sample secret slipping into production.
if (env.isProduction && env.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production.");
}

module.exports = env;