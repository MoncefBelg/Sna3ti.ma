// REQ 57-D — authorization guard for billing/privacy records.
//
// Access to subscription, payment and verification records is enforced
// SERVER-SIDE from the authenticated session (req.admin), never from anything
// the client sends. Rules:
//   * anonymous callers are always denied;
//   * staff members (AdminUser) may read module records per their RBAC
//     permission set and list the module rows they are allowed to manage;
//   * a platform user who owns a Professional record may only read their own
//     payment / subscription / verification records.

const { can } = require("../constants/roles");

async function isStaff(repos, actor) {
  if (!actor) return false;
  try {
    const admin = await repos.adminUsers.get(actor.id);
    return !!admin;
  } catch (e) {
    return false;
  }
}

async function professionalIdForActor(repos, actor) {
  if (!actor) return null;
  try {
    const pro = await repos.professionals.findByUserId(actor.id);
    return pro ? pro.id : null;
  } catch (e) {
    return null;
  }
}

// LIST access: returns null (denied), { staff: true } (full list) or
// { professionalId } (scope the list to the owning professional).
async function listScope(repos, actor) {
  if (!actor) return null;
  if (await isStaff(repos, actor)) return { staff: true };
  const professionalId = await professionalIdForActor(repos, actor);
  return professionalId ? { professionalId } : null;
}

// SINGLE-RECORD access: staff with the module permission, or the owning
// professional.
async function canReadRecord(repos, actor, permission, professionalId) {
  if (!actor) return false;
  if (await isStaff(repos, actor)) return can(actor.role, permission);
  const ownerId = await professionalIdForActor(repos, actor);
  return !!(ownerId && professionalId && ownerId === professionalId);
}

module.exports = { isStaff, listScope, canReadRecord };