const { ROLES, can } = require("../constants/roles");

function canDo(role, resource, action) {
  return can(role, resource, action);
}

module.exports = { canDo, can, ROLES };