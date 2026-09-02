const { AppError } = require("../utils/AppError");
const { isValidOpaqueId } = require("../utils/id");

// Minimal, dependency-free validator. Rules shape:
//   { field: { required, type: "string"|"number"|"boolean", max, pattern, oneOf } }
function validate(data, rules) {
  const errors = [];
  for (const [field, rule] of Object.entries(rules || {})) {
    const value = data ? data[field] : undefined;
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push(`${field} est requis`);
      continue;
    }
    if (value === undefined || value === null) continue;

    if (rule.type === "string" && typeof value !== "string") { errors.push(`${field} doit être une chaîne`); continue; }
    if (rule.type === "number") { const n = Number(value); if (!Number.isFinite(n)) { errors.push(`${field} doit être un nombre`); continue; } }
    if (rule.type === "boolean" && typeof value !== "boolean") { errors.push(`${field} doit être un booléen`); continue; }

    if (rule.max && typeof value === "string" && value.length > rule.max) { errors.push(`${field} trop long`); }
    if (rule.pattern instanceof RegExp && !rule.pattern.test(value)) { errors.push(`${field} a un format invalide`); }
    if (rule.oneOf && !rule.oneOf.includes(value)) { errors.push(`${field} doit être l'une des valeurs: ${rule.oneOf.join(", ")}`); }
    if (rule.opaqueId && !isValidOpaqueId(value)) { errors.push(`${field} doit être un identifiant opaque (ex: PRO-10295)`); }
  }
  return errors;
}

function expectValid(errors) {
  if (errors.length) {
    throw new AppError(errors.join("; "), 400, errors.map((m) => ({ message: m })));
  }
}

function str(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

// Positive integer with optional bounds — used for page/limit/prices.
function intInRange(value, min, max, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > (max || Infinity)) {
    throw new AppError(`${field || "valeur"} doit être un entier entre ${min} et ${(max || "∞")}.`, 400);
  }
  return n;
}

// Query-string pagination (req 27): page ≥ 1, limit 1..100.
function pagination(query) {
  const page = query.page === undefined ? 1 : intInRange(query.page, 1, 1000000, "page");
  const limit = query.limit === undefined ? 20 : intInRange(query.limit, 1, 100, "limit");
  return { page, limit };
}

// RFC-5322-ish email shape + length guard.
function email(value) {
  const v = str(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v.length > 254) {
    throw new AppError("Adresse email invalide.", 400);
  }
  return v.toLowerCase();
}

// Moroccan phone: allow +212, 0 leading, 9 digits (e.g. 0612345678).
function phone(value) {
  const v = str(value).replace(/[\s.\-]/g, "");
  if (!/^(\+212|0)[5-7]\d{8}$/.test(v)) {
    throw new AppError("Numéro de téléphone marocain invalide (ex: 0612345678).", 400);
  }
  return v;
}

function password(value) {
  const v = String(value || "");
  if (v.length < 8 || v.length > 128) {
    throw new AppError("Le mot de passe doit faire entre 8 et 128 caractères.", 400);
  }
  return v;
}

module.exports = { validate, expectValid, str, bool, intInRange, pagination, email, phone, password };
