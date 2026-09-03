// Server-side RBAC permission matrix.
//
// Authorization is enforced HERE, server-side, from the authenticated session
// only. The client never sends `role`/`permissions`/`userId` that is trusted —
// the middleware resolves the actor from the JWT (sub + role) and checks a
// permission string below.
//
// Permissions use dotted notation, e.g. "professionals.suspend".

const ALL_PERMISSIONS = [
  "professionals.view",
  "professionals.edit",
  "professionals.suspend",
  "verification.view",
  "verification.approve",
  "verification.reject",
  "payments.view",
  "payments.confirm",
  "payments.reject",
  "subscriptions.view",
  "subscriptions.manage",
  "reviews.view",
  "reviews.moderate",
  "reports.view",
  "reports.resolve",
  "analytics.view",
  "settings.manage",
  "admin_users.manage",
  "audit_logs.view",
  "notifications.read",
  "notifications.edit"
];

// role -> allowed permission set.
const ROLE_PERMISSIONS = {
  super_admin: new Set(ALL_PERMISSIONS),
  admin: new Set([
    "professionals.view",
    "professionals.edit",
    "professionals.suspend",
    "verification.view",
    "verification.approve",
    "verification.reject",
    "payments.view",
    "payments.confirm",
    "payments.reject",
    "subscriptions.view",
    "subscriptions.manage",
    "reviews.view",
    "reviews.moderate",
    "reports.view",
    "reports.resolve",
    "analytics.view",
    "settings.manage",
    "admin_users.manage",
    "audit_logs.view",
    "notifications.read",
    "notifications.edit"
  ]),
  moderator: new Set([
    "professionals.view",
    "professionals.edit",
    "verification.view",
    "verification.approve",
    "verification.reject",
    "reviews.view",
    "reviews.moderate",
    "reports.view",
    "reports.resolve",
    "analytics.view",
    "notifications.read"
  ]),
  support: new Set([
    "professionals.view",
    "reviews.view",
    "reports.view",
    "reports.resolve",
    "subscriptions.view",
    "audit_logs.view",
    "notifications.read"
  ]),
  finance: new Set([
    "payments.view",
    "payments.confirm",
    "payments.reject",
    "subscriptions.view",
    "subscriptions.manage",
    "analytics.view",
    "audit_logs.view",
    "notifications.read"
  ])
};

// Returns true if `role` is allowed to perform `permission` (e.g. "payments.confirm").
function can(role, permission) {
  const set = ROLE_PERMISSIONS[role];
  return !!(set && set.has(permission));
}

function permissionsOf(role) {
  const set = ROLE_PERMISSIONS[role];
  return set ? [...set] : [];
}

const ROLE_IDS = Object.keys(ROLE_PERMISSIONS);

module.exports = { ROLES: ROLE_PERMISSIONS, ROLE_IDS, can, permissionsOf, ALL_PERMISSIONS };
