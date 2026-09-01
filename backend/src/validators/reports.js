const { validate, expectValid } = require("./common");

const createRules = {
  professionalId: { type: "string", required: true, opaqueId: true },
  reason: { type: "string", required: true, max: 500 },
  description: { type: "string", max: 2000 }
};

function reportCreate(data) { expectValid(validate(data, createRules)); }

module.exports = { reportCreate };