// System repositories — notifications, audit logs, admin users, legal docs, roles.

const { createGenericRepository } = require("./base");

function createNotificationRepo(db) {
  const base = createGenericRepository("notification", db);
  return {
    ...base,
    async listUnread() { return base.list({ unread: true }, { orderBy: { createdAt: "desc" } }); },
    async markAllRead() { return db.notification.updateMany({ where: { unread: true }, data: { unread: false } }); },
    async markRead(id) { return db.notification.update({ where: { id }, data: { unread: false } }); }
  };
}

function createAuditRepo(db) {
  const base = createGenericRepository("auditLog", db);
  return {
    ...base,
    async log(entry) {
      return base.create({ ...entry, timestamp: new Date() });
    }
  };
}

function createAdminUserRepo(db) {
  const base = createGenericRepository("adminUser", db);
  return {
    ...base,
    async findByEmail(email) { return base.find({ email: email.toLowerCase() }); },
    async listActive() { return base.list({ status: "active" }); }
  };
}

function createLegalRepo(db) {
  const base = createGenericRepository("legalDocument", db);
  return {
    ...base,
    async findPublished() { return base.list({ published: true }); }
  };
}

function createRoleRepo(db) {
  const base = createGenericRepository("role", db);
  return { ...base };
}

function createSystemRepo(db) {
  return {
    notifications: createNotificationRepo(db),
    auditLogs: createAuditRepo(db),
    adminUsers: createAdminUserRepo(db),
    legalDocs: createLegalRepo(db),
    roles: createRoleRepo(db)
  };
}

module.exports = { createSystemRepo };