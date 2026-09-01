const { validate, expectValid } = require("./common");

const updateRules = {
  published: { type: "boolean" },
  title: { type: "string", max: 200 },
  content: { type: "string", max: 50000 }
};

function legalUpdate(data) { expectValid(validate(data, updateRules)); }

module.exports = { legalUpdate };