const { validate, expectValid } = require("./common");

const reasonRules = { reason: { type: "string", required: true, max: 500 } };
const noteRules = { note: { type: "string", required: true, max: 500 } };

function verificationReject(data) { expectValid(validate(data, reasonRules)); }
function verificationInfo(data) { expectValid(validate(data, noteRules)); }

module.exports = { verificationReject, verificationInfo };