const { validate, expectValid } = require("./common");

const createRules = {
  subject: { type: "string", required: true, max: 200 },
  message: { type: "string", required: true, max: 4000 }
};

function ticketCreate(data) { expectValid(validate(data, createRules)); }

module.exports = { ticketCreate };