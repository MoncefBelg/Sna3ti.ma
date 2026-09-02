/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/audit-api.js
   Audit-log REST endpoint (REQ 52).

   GET /admin/audit-logs -> list (read-only, append-only)

   Consumes the shared ApiClient.
   Exposes `Sna3tiAuditApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before audit-api.js");

  global.Sna3tiAuditApi = {
    list: function (params) { return R("GET", "admin/audit-logs", { params: params }); }
  };

})(window);
