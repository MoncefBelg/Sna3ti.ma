// Assembles the full repositories object from the injected `db`.

const { createCatalogRepo } = require("./catalog");
const { createMarketplaceRepo } = require("./marketplace");
const { createTransactionRepo } = require("./transactions");
const { createSystemRepo } = require("./system");
const { createIdSequenceRepo } = require("./idSequence");
const { createMatchRepo } = require("./match");
const { createProfessionalRequestsRepo } = require("./professionalRequests");

function createRepos(db) {
  const repos = {
    ...createCatalogRepo(db),
    ...createMarketplaceRepo(db),
    ...createTransactionRepo(db),
    ...createMatchRepo(db),
    ...createProfessionalRequestsRepo(db),
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

  // REQ 58-F — atomic financial state transition. Runs `fn` inside a database
  // transaction when the adapter supports it (Prisma interactive tx); otherwise
  // it falls back to the same repos (in-memory adapter still honours its own
  // snapshot/rollback $transaction when present).
  // `fn` is invoked with a FRESH set of repositories bound to the transactional
  // client so every repo call (payment, subscription, billing, audit) executes
  // inside the single DB transaction and commits/rolls back atomically.
  repos.$transaction = async (fn) => {
    if (typeof db.$transaction === "function") {
      return db.$transaction((tx) => fn(createRepos(tx)));
    }
    return fn(repos);
  };

  return repos;
}

module.exports = { createRepos };