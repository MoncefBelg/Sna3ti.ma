// REQ 58-I/K — admin billing-history + lightweight reporting. Read-only: there
// is no create/update/delete exposed here because BillingTransaction is
// immutable (it is written only by the internal subscription/payment services).

const { asyncHandler } = require("../utils/asyncHandler");
const { ok } = require("../utils/respond");

function createBillingTransactionController(services) {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await services.billingTransactions.list(req.query, req.admin);
      ok(res, result); // { data, pagination }
    }),
    summary: asyncHandler(async (req, res) => {
      const data = await services.billingTransactions.summary(req.admin);
      ok(res, { data });
    })
  };
}

module.exports = { createBillingTransactionController };
