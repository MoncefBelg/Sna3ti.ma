const { validate, expectValid } = require("./common");

const updateRules = {
  name: { type: "string" },
  job: { type: "string" },
  city: { type: "string" },
  phone: { type: "string" },
  email: { type: "string" },
  description: { type: "string", max: 2000 },
  package: { type: "string" }
};

const createRules = {
  name: { type: "string", required: true, max: 200 },
  job: { type: "string", required: true, max: 120 },
  city: { type: "string", max: 120 },
  phone: { type: "string", max: 30 },
  email: { type: "string", max: 254 },
  description: { type: "string", max: 2000 }
};

function professionalCreate(data) { expectValid(validate(data, createRules)); }
function professionalUpdate(data) { expectValid(validate(data, updateRules)); }

module.exports = { professionalCreate, professionalUpdate };