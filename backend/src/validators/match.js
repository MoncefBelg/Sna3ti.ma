const { validate, expectValid } = require("./common");
const { AppError } = require("../utils/AppError");

const createRules = {
  name: { type: "string", required: true, max: 120 },
  phone: { type: "string", required: true, max: 20 },
  whatsapp: { type: "string", max: 20 },
  city: { type: "string", required: true, max: 120 },
  area: { type: "string", max: 160 },
  service: { type: "string", required: true, max: 80 },
  otherService: { type: "string", max: 160 },
  description: { type: "string", max: 3000 },
  preferredContact: { type: "string", oneOf: ["phone", "whatsapp", "both"] }
};

// Phone/WhatsApp must be digits only (an optional leading '+' is tolerated,
// then stripped). The frontend already enforces numeric input; this is the
// server-side backstop so no free-form strings persist.
function digitsOnly(value, field) {
  const v = String(value || "").replace(/[\s.\-]/g, "");
  if (!/^(?:\+)?\d{6,16}$/.test(v)) {
    throw new AppError(`${field} doit contenir uniquement des chiffres.`, 400);
  }
  return v.replace("+", "");
}

function matchCreate(data) {
  expectValid(validate(data, createRules));
  if (data) {
    const phoneN = digitsOnly(data.phone, "phone");
    if (data.whatsapp !== undefined && data.whatsapp !== null && data.whatsapp !== "") {
      digitsOnly(data.whatsapp, "whatsapp");
    }
    void phoneN;
  }
}

module.exports = { matchCreate, digitsOnly };
