/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/payment-flow.js
   Moroccan bank-transfer payment workflow (REQ 50).

   Preserves the existing payment workflow. Initial method:
   `bank_transfer` (MOROCCAN_BANK_TRANSFER), enforced server-side.

   Workflow:
     User chooses paid plan
       -> create subscription (price from DB plan)
       -> create payment (method: bank_transfer, amount from DB plan)
       -> user submits transfer receipt / bank details
       -> admin reviews
       -> admin confirms / rejects

   Confirmation (POST /admin/payments/:id/confirm):
     Payment = confirmed
     Subscription = active
     Verification = UNCHANGED   (a payment never grants a verification badge)

   Rejection (POST /admin/payments/:id/reject, reason required).

   Consumes the shared ApiClient + payments-api + subscriptions-api.
   Exposes `Sna3tiPaymentFlow`.
   ============================================================ */

(function (global) {
  "use strict";

  var Api = global.Sna3tiApi || null;
  var PayApi = global.Sna3tiPaymentsApi || null;
  var SubApi = global.Sna3tiSubscriptionsApi || null;

  function guard() {
    if (!Api || !PayApi || !SubApi) return { ok:false, err: { success:false, code:"UNSUPPORTED", message:"Modules API non chargés." } };
    return { ok:true };
  }

  /**
   * Full bank-transfer purchase:
   *   purchase({
   *     professionalId, planId,
   *     bankRef?, receiptUrl?,    // transfer details the user submits
   *   }) -> { subscription, payment }
   * Creates the subscription (pending + bank_transfer payment). Amount comes
   * from the DB plan, never from the client.
   */
  function purchase(input) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    input = input || {};
    if (!input.professionalId) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"professionalId requis." });
    if (!input.planId) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"planId requis." });

    return SubApi.create({ professionalId: input.professionalId, planId: input.planId, status: "pending", paymentStatus: "pending" })
      .then(function (subRes) {
        var sub = subRes && subRes.data ? subRes.data : subRes;

        return PayApi.create({
          professionalId: input.professionalId,
          planId: input.planId,
          bankReference: input.bankRef || undefined,
          receiptUrl: input.receiptUrl || undefined
        }).then(function (payRes) {
          var pay = payRes && payRes.data ? payRes.data : payRes;
          return { success:true, subscription: sub, payment: pay };
        });
      });
  }

  /** Submit/attach bank transfer receipt details to an existing payment.
   *  The backend derives `bankRef`/`receipt` from these on create; for an
   *  existing pending payment, a re-create isn't needed — callers may store
   *  the receipt URL and reference on creation. This helper records the
   *  intent for the admin review step. */
  function submitReceipt(input) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    input = input || {};
    if (!input.professionalId) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"professionalId requis." });
    return PayApi.create({
      professionalId: input.professionalId,
      planId: input.planId,
      bankReference: input.bankRef,
      receiptUrl: input.receiptUrl
    }).then(function (res) {
      return { success:true, payment: res && res.data ? res.data : res };
    });
  }

  /** Admin confirms a payment (bank_transfer receipt verified). */
  function confirm(paymentId) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    if (!paymentId) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"paymentId requis." });
    return PayApi.confirm(paymentId).then(function (res) {
      return { success:true, payment: res && res.data ? res.data : res };
    });
  }

  /** Admin rejects a payment (requires a reason). */
  function reject(paymentId, reason) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    if (!paymentId) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"paymentId requis." });
    if (!reason || !String(reason).trim()) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"Le motif du rejet est requis." });
    return PayApi.reject(paymentId, reason).then(function (res) {
      return { success:true, payment: res && res.data ? res.data : res };
    });
  }

  /** List payments for admin review. */
  function list() {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    return PayApi.list().then(function (res) { return { success:true, data: res.data || [] }; });
  }

  /** Result-status semantics (mirrors the backend contract, UI-facing). */
  var STATES = {
    PAYMENT_PENDING: "pending",
    PAYMENT_CONFIRMED: "confirmed",
    PAYMENT_REJECTED: "rejected",
    SUBSCRIPTION_ACTIVE: "active",
    VERIFICATION_UNCHANGED: "unchanged"
  };

  global.Sna3tiPaymentFlow = {
    purchase: purchase,
    submitReceipt: submitReceipt,
    confirm: confirm,
    reject: reject,
    list: list,
    METHOD: "bank_transfer",
    STATES: STATES
  };

})(window);
