/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/payments-api.js
   Payment REST endpoints (REQ 46).
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiPaymentsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before payments-api.js");

  global.Sna3tiPaymentsApi = {
    list: function () { return R("GET", "admin/payments", {}); },
    get: function (id) { return R("GET", "payments/:id", { pathParams: { id: id } }); },
    create: function (payload) { return R("POST", "payments", { body: payload }); },
    confirm: function (id) { return R("POST", "admin/payments/:id/confirm", { pathParams: { id: id } }); },
    reject: function (id, reason) { return R("POST", "admin/payments/:id/reject", { pathParams: { id: id }, body: { reason: reason } }); }
  };

})(window);
