const { validate, expectValid } = require("./common");
const { ROLE_IDS } = require("../constants/roles");

const createRules = {
  name: { type: "string", required: true, max: 100 },
  email: { type: "string", required: true, max: 200 },
  role: { type: "string", required: true, oneOf: ROLE_IDS },
  password: { type: "string", required: true }
};

const updateRules = {
  name: { type: "string", max: 100 },
  role: { type: "string", oneOf: ROLE_IDS },
  status: { type: "string", oneOf: ["active", "inactive", "suspended"] },
  password: { type: "string" }
};

function adminUserCreate(data) { expectValid(validate(data, createRules)); }
function adminUserUpdate(data) { expectValid(validate(data, updateRules)); }

module.exports = { adminUserCreate, adminUserUpdate };