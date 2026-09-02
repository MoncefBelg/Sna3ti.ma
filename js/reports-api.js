/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/reports-api.js
   Report moderation REST endpoints (REQ 46).
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiReportsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before reports-api.js");

  global.Sna3tiReportsApi = {
    list: function () { return R("GET", "admin/reports", {}); },
    create: function (payload) { return R("POST", "reports", { body: payload }); },
    resolve: function (id) { return R("POST", "admin/reports/:id/resolve", { pathParams: { id: id } }); },
    reject: function (id, reason) { return R("POST", "admin/reports/:id/reject", { pathParams: { id: id }, body: { reason: reason } }); },
    warn: function (id, reason) { return R("POST", "admin/reports/:id/warn", { pathParams: { id: id }, body: { reason: reason } }); },
    suspend: function (id) { return R("POST", "admin/reports/:id/suspend", { pathParams: { id: id } }); }
  };

})(window);
