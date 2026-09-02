// System repositories — audit logs, notifications, legal docs, admin users, roles.
//
// AUDIT LOGS (req 23): append-only. The repo exposes `log()` but NOT update
// or delete, so normal admin users can never modify or remove audit entries.

const { createGenericRepository } = require("./base");
const { ID_PREFIXES } = require("../constants/statuses");

// Generates an opaque, monotonic id (AL-xxxxx) from the sequence table.
async function nextAuditId(db) {
  const base = ID_PREFIXES.audit || "AL";
  const seq = await db.idSequence.upsert({
    where: { prefix: base },
    create: { prefix: base, value: 10001 },
    update: { value: { increment: 1 } }
  });
  return `${base}-${seq.value}`;
}

function createAuditRepo(db) {
  const base = createGenericRepository("auditLog", db);
  return {
    ...base,
    async log({ id, adminId, adminName, action, entity, entityId, note, reason, result, metadata }) {
      return base.create({
        id: id || (await nextAuditId(db)),
        adminId,
        action,
        entityType: entity || "System",
        entityId,
        reason: reason || note || result || null,
        metadata: metadata || null,
        createdAt: new Date()
      });
    }
  };
}

function createNotificationRepo(db) {
  const base = createGenericRepository("notification", db);
  return {
    ...base,
    async listUnread(userId) {
      return base.list(userId ? { userId, readAt: null } : { readAt: null }, { orderBy: { createdAt: "desc" } });
    },
    async listForUser(userId) {
      return base.list({ userId }, { orderBy: { createdAt: "desc" } });
    },
    async markAllRead(userId) {
      const where = { readAt: null };
      if (userId) where.userId = userId;
      return db.notification.updateMany({ where, data: { readAt: new Date() } });
    },
    async markRead(id, userId) {
      const where = { id };
      if (userId) where.userId = userId;
      return db.notification.update({ where, data: { readAt: new Date() } });
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
    async findPublished() { return base.list({ published: true }); },
    async findByTypeAndLanguage(type, language) { return base.find({ type, language }); }
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
