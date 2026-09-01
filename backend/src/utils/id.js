const crypto = require("crypto");

const ID_PREFIXES = require("../constants/statuses").ID_PREFIXES;

// Opaque, human-usable ids that mirror the frontend format (PRO-10295,
// PAY-7004, VR-201, ...). They are STRINGS: API consumers must never
// parse them as integers.
function makeId(prefix, existing = []) {
  const base = ID_PREFIXES[prefix] || String(prefix).toUpperCase();
  let id;
  do {
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    id = `${base}-${rand}`;
  } while (existing.includes(id));
  return id;
}

// Legacy-friendly: keep a caller-provided opaque id if it matches our
// format (e.g. when syncing existing frontend data), else generate one.
function ensureId(prefix, id, existing = []) {
  if (typeof id === "string" && /^[A-Z]+-\d+$/.test(id) && !existing.includes(id)) {
    return id;
  }
  return makeId(prefix, existing);
}

// Validate that a route param / body id is a well-formed opaque id.
const OPAGUE_ID_RE = /^[A-Za-z]+-[A-Za-z0-9]+$/;
function isValidOpaqueId(value) {
  return typeof value === "string" && OPAGUE_ID_RE.test(value);
}

module.exports = { makeId, ensureId, isValidOpaqueId };