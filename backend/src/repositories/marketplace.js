// Marketplace repositories — users, professionals, subscriptions.

const { createGenericRepository } = require("./base");

function createUserRepo(db) {
  const base = createGenericRepository("user", db);
  return {
    ...base,
    findByPhone(phone) { return base.find({ phone }); },
    findByEmail(email) { return base.find({ email: email && email.toLowerCase() }); },
    async listActive() { return base.list({ status: "active" }); }
  };
}

function createProfessionalRepo(db) {
  const base = createGenericRepository("professional", db);
  return {
    ...base,
    findByUserId(userId) { return base.find({ userId }); },
    async findByStatus(status) { return base.list({ status }); },
    async search(query = {}) {
      const where = {};
      if (query.status) where.status = query.status;
      if (query.categoryId) where.categoryId = query.categoryId;
      if (query.cityId) where.cityId = query.cityId;
      if (query.city) where.city = query.city;
      if (query.verificationStatus) where.verificationStatus = query.verificationStatus;
      return base.list(where, { orderBy: { createdAt: "desc" } });
    },
    async suspend(id) { return base.update(id, { status: "suspended" }); },
    async activate(id) { return base.update(id, { status: "active" }); }
  };
}

function createSubscriptionRepo(db) {
  const base = createGenericRepository("subscription", db);
  return {
    ...base,
    async findActiveByProfessional(professionalId) {
      return base.find({ professionalId, status: "active" });
    },
    async findPendingByProfessional(professionalId) {
      return base.find({ professionalId, status: "pending" });
    },
    async findLatestByProfessional(professionalId) {
      const rows = await base.list({ professionalId }, { orderBy: { createdAt: "desc" } });
      return rows[0] || null;
    }
  };
}

function createMarketplaceRepo(db) {
  return {
    users: createUserRepo(db),
    professionals: createProfessionalRepo(db),
    subscriptions: createSubscriptionRepo(db)
  };
}

module.exports = { createMarketplaceRepo };