// Sna3ti Match repositories — customer match requests (REQ-xxxxx) and their
// privately-stored photos (PH-xxxxx).
//
// A match request is the SINGLE source of truth for a "Trouve-moi un artisan
// de confiance" lead. WhatsApp is only a notification channel layered on top,
// so its status is stored on the request and never blocks request creation.

const { createGenericRepository } = require("./base");

function createMatchPhotoRepo(db) {
  const base = createGenericRepository("matchPhoto", db);
  return {
    ...base,
    async findByRequest(matchRequestId) {
      return base.list({ matchRequestId }, { orderBy: { createdAt: "asc" } });
    },
    async removeByRequest(matchRequestId) {
      return db.matchPhoto.deleteMany({ where: { matchRequestId } });
    }
  };
}

function createMatchRequestRepo(db) {
  const base = createGenericRepository("matchRequest", db);
  return {
    ...base,
    async listByStatus(status) {
      return base.list(status === "all" || !status ? {} : { status }, { orderBy: { createdAt: "desc" } });
    },
    async findPending() {
      return base.list({ status: { in: ["new", "reviewing", "artisan_contacted", "price_received", "price_sent", "customer_accepted"] } }, { orderBy: { createdAt: "desc" } });
    }
  };
}

function createMatchRepo(db) {
  return {
    matchRequests: createMatchRequestRepo(db),
    matchPhotos: createMatchPhotoRepo(db)
  };
}

module.exports = { createMatchRepo, createMatchRequestRepo, createMatchPhotoRepo };
