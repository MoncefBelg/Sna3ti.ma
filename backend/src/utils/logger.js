// Tiny logger with level filtering (no external dependency).
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = LEVELS[process.env.LOG_LEVEL] || LEVELS.info;

function log(level, msg, meta) {
  if (LEVELS[level] < threshold) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}`;
  const payload = meta ? JSON.stringify(meta) : "";
  const out = LEVELS[level] >= LEVELS.warn ? console.error : console.log;
  out(line + (payload ? " " + payload : ""));
}

module.exports = {
  debug: (m, meta) => log("debug", m, meta),
  info: (m, meta) => log("info", m, meta),
  warn: (m, meta) => log("warn", m, meta),
  error: (m, meta) => log("error", m, meta)
};