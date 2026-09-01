const { validate, expectValid } = require("./common");

const updateRules = {
  name: { type: "string" },
  job: { type: "string" },
  city: { type: "string" },
  phone: { type: "string" },
  description: { type: "string", max: 2000 },
  package: { type: "string" }
};

function professionalUpdate(data) { expectValid(validate(data, updateRules)); }

module.exports = { professionalUpdate };