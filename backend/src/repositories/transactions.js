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
    async listFlagged() { return base.list({ status: "flagged" }); },
    async countByCustomer(customerId) { return base.count({ userId: customerId }); }
  };
}

// Professional contact interactions (req contact-trust). Rows record when an
// authenticated (or anonymous) customer reached an artisan; they are the only
// proof that can unlock review eligibility.
function createInteractionRepo(db) {
  const base = createGenericRepository("professionalContactInteraction", db);
  return {
    ...base,
    async findByCustomerAndProfessional(customerId, professionalId) {
      if (!customerId) return base.find({ professionalId, customerId: null });
      return base.find({ customerId, professionalId });
    },
    async findByProfessional(professionalId) { return base.list({ professionalId }); },
    async findByCustomer(customerId) {
      if (!customerId) return base.list({ customerId: null });
      return base.list({ customerId });
    },
    async countContactsInWindow(customerId, since) {
      if (!customerId) return 0;
      const rows = await base.list({ customerId });
      return rows.filter((r) => r.createdAt && new Date(r.createdAt) >= since).length;
    },
    async listReviewsByCustomer(customerId) {
      if (!customerId) return [];
      // Reviews belong to a different store; reuse the generic repo so both
      // the in-memory adapter and Prisma expose the same `list` surface.
      return createGenericRepository("review", db).list({ userId: customerId });
    }
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

// REQ 58-D — append-only financial history. Exposes ONLY create/read/count so
// a BillingTransaction can never be updated or deleted through any repository
// path. Immutability is guaranteed at the data layer, not just the API.
function createBillingTransactionRepo(db) {
  const base = createGenericRepository("billingTransaction", db);
  const UPDATEABLE_STATUSES = ["active", "expired", "cancelled"];
  return {
    model: base.model,
    // Append-only write — no generic update/remove are exposed.
    async insert(data) { return base.create(data); },
    list: base.list,
    findMany: base.findMany,
    get: base.get,
    count: base.count,
    async findByPayment(paymentId) { return base.find({ paymentId }); },
    async listByProfessional(professionalId) {
      return base.list({ professionalId }, { orderBy: { createdAt: "desc" } });
    },
    // REQ 58-H — lifecycle-only status transition. This is NOT an edit of the
    // financial record: it re-labels an historical period's status (active ->
    // expired / cancelled) when the entitlement ends. Amounts, periods, plan and
    // references remain immutable. Calling this throws for any other change.
    async updateStatus(id, status) {
      if (!UPDATEABLE_STATUSES.includes(status)) {
        throw new Error(`BillingTransaction status not allowed: ${status}`);
      }
      return db.billingTransaction.update({ where: { id }, data: { status } });
    }
  };
}

function createTransactionRepo(db) {
  return {
    payments: createPaymentRepo(db),
    verification: createVerificationRepo(db),
    verificationDocuments: createVerificationDocumentRepo(db),
    reviews: createReviewRepo(db),
    interactions: createInteractionRepo(db),
    reports: createReportRepo(db),
    support: createSupportRepo(db),
    billingTransactions: createBillingTransactionRepo(db)
  };
}

module.exports = { createTransactionRepo };