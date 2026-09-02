const { validate, expectValid } = require("./common");

const LEGAL_TYPES = ["terms", "privacy", "about"];
const LEGAL_LANGUAGES = ["en", "fr", "ar"];

const createRules = {
  title: { type: "string", required: true, max: 200 },
  content: { type: "string", required: true, max: 50000 },
  published: { type: "boolean" }
};

const updateRules = {
  title: { type: "string", max: 200 },
  content: { type: "string", max: 50000 },
  published: { type: "boolean" }
};

function legalCreate(data) { expectValid(validate(data, createRules)); }
function legalUpdate(data) { expectValid(validate(data, updateRules)); }

module.exports = { legalCreate, legalUpdate, LEGAL_TYPES, LEGAL_LANGUAGES };
