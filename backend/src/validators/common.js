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
  if (errors.length) throw new AppError(errors.join("; "), 400, { errors });
}

function str(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

module.exports = { validate, expectValid, str, bool };