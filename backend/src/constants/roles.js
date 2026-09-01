// Roles & permission matrix — mirrors js/admin-data.js ROLES exactly so the
// backend enforces the SAME rules the admin UI already displays.
// NOTE (security): production authorization is enforced here, server-side.
// The browser copy in Sna3tiData is presentational only.

const ROLES = {
  super_admin: {
    label: "Super Admin",
    color: "purple",
    permissions: {
      dashboard: ["read"],
      users: ["read", "update", "suspend", "delete"],
      professionals: ["read", "update", "verify", "suspend", "activate", "delete"],
      verification: ["read", "approve", "reject", "info"],
      reviews: ["read", "moderate", "delete"],
      reports: ["read", "resolve", "warn", "suspend"],
      support: ["read", "update", "assign"],
      categories: ["read", "update"],
      cities: ["read", "update"],
      subscriptions: ["read", "update"],
      payments: ["read", "approve", "reject", "info"],
      analytics: ["read"],
      ai: ["read"],
      notifications: ["read", "send"],
      settings: ["read", "update"],
      legal: ["read", "update"],
      adminUsers: ["read", "update"],
      auditLogs: ["read", "export"]
    }
  },
  admin: {
    label: "Admin",
    color: "teal",
    permissions: {
      dashboard: ["read"],
      users: ["read", "update", "suspend"],
      professionals: ["read", "update", "verify", "suspend", "activate"],
      verification: ["read", "approve", "reject", "info"],
      reviews: ["read", "moderate", "delete"],
      reports: ["read", "resolve"],
      support: ["read", "update", "assign"],
      categories: ["read", "update"],
      cities: ["read", "update"],
      subscriptions: ["read", "update"],
      payments: ["read", "approve", "reject", "info"],
      analytics: ["read"],
      ai: ["read"],
      notifications: ["read", "send"],
      settings: ["read", "update"],
      legal: ["read", "update"],
      adminUsers: ["read"],
      auditLogs: ["read"]
    }
  },
  moderator: {
    label: "Moderator",
    color: "blue",
    permissions: {
      dashboard: ["read"],
      users: ["read"],
      professionals: ["read", "update", "verify"],
      verification: ["read", "approve", "reject", "info"],
      reviews: ["read", "moderate", "delete"],
      reports: ["read", "resolve", "warn", "suspend"],
      analytics: ["read"],
      notifications: ["read", "send"],
      auditLogs: ["read"]
    }
  },
  support: {
    label: "Support",
    color: "orange",
    permissions: {
      dashboard: ["read"],
      users: ["read", "update", "suspend"],
      professionals: ["read", "update"],
      reviews: ["read"],
      reports: ["read", "resolve"],
      support: ["read", "update", "assign"],
      notifications: ["read", "send"],
      auditLogs: ["read"]
    }
  },
  finance: {
    label: "Finance",
    color: "amber",
    permissions: {
      dashboard: ["read"],
      subscriptions: ["read", "update"],
      payments: ["read", "approve", "reject"],
      analytics: ["read"],
      auditLogs: ["read", "export"]
    }
  }
};

// Seed order for the database plus simple validation helper.
const ROLE_IDS = Object.keys(ROLES);

function can(role, resource, action) {
  const perms = ROLES[role] && ROLES[role].permissions[resource];
  return !!(perms && (perms.includes("*") || perms.includes(action)));
}

module.exports = { ROLES, ROLE_IDS, can };