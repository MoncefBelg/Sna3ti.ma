const { validate, expectValid, str, intInRange, phone } = require("./common");

// Morocco accepts both "+212612345678" and "0612345678". Canonicalizing to
// "+212" + 9 digits means duplicate detection and storage are format-independent.
function maPhone(value) {
  const v = phone(value);
  return v.startsWith("0") ? "+212" + v.slice(1) : v;
}

// Account-free artisan onboarding request (REQ 53) — intake validation.
//
// The client NEVER controls subscription/profile authority here: it sends the
// pack choice as a plan code, the backend resolves the plan (id/name/price)
// server-side, and ALL status-bearing fields (status, verified,
// subscriptionStatus, ...) are simply not accepted — they are dropped by the
// whitelist below and never persist.

const createRules = {
  firstName: { type: "string", required: true, max: 80 },
  lastName: { type: "string", required: true, max: 80 },
  phone: { type: "string", required: true, max: 20 },
  profession: { type: "string", required: true, max: 80 },
  otherService: { type: "string", max: 200 },
  city: { type: "string", required: true, max: 120 },
  cityLabel: { type: "string", max: 120 },
  description: { type: "string", max: 200 },
  price: { type: "number" },
  priceUnit: { type: "string", max: 20 },
  plan: { type: "string", required: true, oneOf: ["free", "verified", "gold"] }
};

// Validate and return a WHITELISTED, normalized object — the only thing the
// service may persist. Anything not listed above (status, verified, role,
// subscriptionStatus, planId, planPrice, ...) is intentionally discarded.
function professionalRequestCreate(data) {
  expectValid(validate(data, createRules));
  const out = {
    firstName: str(data.firstName),
    lastName: str(data.lastName),
    phone: maPhone(data.phone),
    profession: str(data.profession),
    city: str(data.city),
    plan: String(data.plan)
  };
  if (data.otherService !== undefined && data.otherService !== null && data.otherService !== "") {
    out.otherService = str(data.otherService);
  }
  if (data.cityLabel !== undefined && data.cityLabel !== null && data.cityLabel !== "") {
    out.cityLabel = str(data.cityLabel);
  }
  if (data.description !== undefined && data.description !== null && data.description !== "") {
    out.description = str(data.description);
  }
  if (data.price !== undefined && data.price !== null && data.price !== "") {
    out.price = intInRange(data.price, 0, 100000000, "price");
  }
  if (data.priceUnit !== undefined && data.priceUnit !== null && data.priceUnit !== "") {
    out.priceUnit = str(data.priceUnit, "DH");
  }
  return out;
}

module.exports = { professionalRequestCreate, createRules };