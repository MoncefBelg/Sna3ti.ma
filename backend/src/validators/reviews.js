const { validate, expectValid } = require("./common");

const createRules = {
  professionalId: { type: "string", required: true, opaqueId: true },
  customer: { type: "string", required: true },
  rating: { type: "number", required: true },
  comment: { type: "string", max: 2000 }
};

function reviewCreate(data) { expectValid(validate(data, createRules)); }

module.exports = { reviewCreate };