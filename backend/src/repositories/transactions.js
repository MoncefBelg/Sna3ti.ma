// Transaction repositories — payments, verifications, reviews, reports, support.

const { createGenericRepository } = require("./base");

function createPaymentRepo(db) {
  const base = createGenericRepository("payment", db);
  return {
    ...base,
    findByReference(reference) { return base.find({ reference }); },
    async findPending() { return base.list({ status: "pending" }, { orderBy: { createdAt: "desc" } }); },
    async findByProfessional(professionalId) { return base.list({ professionalId }); }
  };
}

function createVerificationRepo(db) {
  const base = createGenericRepository("verificationRequest", db);
  return {
    ...base,
    async findByProfessionalId(professionalId) { return base.list({ professionalId }); },
    async findPendingByProfessional(professionalId) { return base.find({ professionalId, status: "pending" }); },
    async findPlanRequestByPaymentId(paymentId) { return base.find({ paymentId, level: "plan" }); },
    async findActiveByProfessional(professionalId) {
      return base.list(
        { professionalId, status: { in: ["pending", "needs_info"] } },
        { orderBy: { submitted: "desc" } }
      );
    },
    async listByStatus(status) {
      return base.list(status === "all" ? {} : { status }, { orderBy: { submitted: "desc" } });
    }
  };
}

function createVerificationDocumentRepo(db) {
  const base = createGenericRepository("verificationDocument", db);
  return {
    ...base,
    async findByRequest(verificationRequestId) { return base.list({ verificationRequestId }); },
    async findByProfessional(professionalId) { return base.list({ professionalId }); }
  };
}

function createReviewRepo(db) {
  const base = createGenericRepository("review", db);
  return {
    ...base,
    async findByProfessional(professionalId) { return base.list({ professionalId }); },
    async listFlagged() { return base.list({ status: "flagged" }); }
  };
}

function createReportRepo(db) {
  const base = createGenericRepository("report", db);
  return {
    ...base,
    async findOpen() {
      return base.list({ status: { in: ["new", "under_review"] } }, { orderBy: { createdAt: "desc" } });
    }
  };
}

function createSupportRepo(db) {
  const base = createGenericRepository("supportTicket", db);
  return {
    ...base,
    async findOpen() {
      return base.list({ status: { in: ["open", "pending"] } }, { orderBy: { createdAt: "desc" } });
    }
  };
}

function createTransactionRepo(db) {
  return {
    payments: createPaymentRepo(db),
    verification: createVerificationRepo(db),
    verificationDocuments: createVerificationDocumentRepo(db),
    reviews: createReviewRepo(db),
    reports: createReportRepo(db),
    support: createSupportRepo(db)
  };
}

module.exports = { createTransactionRepo };