const { validate, expectValid } = require("./common");

const noteRules = { note: { type: "string", required: true, max: 500 } };
const reasonRules = { reason: { type: "string", required: true, max: 500 } };

function paymentReject(data) { expectValid(validate(data, reasonRules)); }
function paymentInfo(data) { expectValid(validate(data, noteRules)); }

module.exports = { paymentReject, paymentInfo };