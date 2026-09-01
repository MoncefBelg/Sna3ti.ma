// Assembles the full repositories object from the injected `db`.

const { createCatalogRepo } = require("./catalog");
const { createMarketplaceRepo } = require("./marketplace");
const { createTransactionRepo } = require("./transactions");
const { createSystemRepo } = require("./system");

function createRepos(db) {
  return {
    ...createCatalogRepo(db),
    ...createMarketplaceRepo(db),
    ...createTransactionRepo(db),
    ...createSystemRepo(db),
    // Convenience aliases used by service layer without nesting.
    roles: createSystemRepo(db).roles,
    adminUsers: createSystemRepo(db).adminUsers,
    notifications: createSystemRepo(db).notifications,
    auditLogs: createSystemRepo(db).auditLogs,
    legalDocs: createSystemRepo(db).legalDocs
  };
}

module.exports = { createRepos };