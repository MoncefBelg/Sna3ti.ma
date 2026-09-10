/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/billing-api.js
   Billing-history REST endpoints (REQ 58-I/K).
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiBillingApi`.
   ------------------------------------------------
   These endpoints are STRICTLY READ-ONLY: BillingTransaction is an
   immutable paid-period ledger. There are no create/update/delete
   URLs here — it is written only by the internal subscription /
   payment services. RBAC (payments.view) is enforced server-side.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before billing-api.js");

  global.Sna3tiBillingApi = {
    list: function (params) { return R("GET", "admin/billing-transactions", { params: params || {} }); },
    summary: function () { return R("GET", "admin/billing-transactions/summary", {}); }
  };

})(window);