// Assembles the full repositories object from the injected `db`.

const { createCatalogRepo } = require("./catalog");
const { createMarketplaceRepo } = require("./marketplace");
const { createTransactionRepo } = require("./transactions");
const { createSystemRepo } = require("./system");
const { createIdSequenceRepo } = require("./idSequence");
const { createMatchRepo } = require("./match");

function createRepos(db) {
  return {
    ...createCatalogRepo(db),
    ...createMarketplaceRepo(db),
    ...createTransactionRepo(db),
    ...createMatchRepo(db),
    ...createSystemRepo(db),
    // Sequence-backed opaque ID generation for newly-created entities.
    ids: createIdSequenceRepo(db),
    // Convenience aliases used by service layer without nesting.
    roles: createSystemRepo(db).roles,
    adminUsers: createSystemRepo(db).adminUsers,
    notifications: createSystemRepo(db).notifications,
    auditLogs: createSystemRepo(db).auditLogs,
    legalDocs: createSystemRepo(db).legalDocs
  };
}

module.exports = { createRepos };