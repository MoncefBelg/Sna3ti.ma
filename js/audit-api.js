/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/audit-api.js
   Audit-log REST endpoint (REQ 52).

   GET /admin/audit-logs -> list (read-only, append-only)
   DELETE /admin/audit-logs/:id -> remove one entry (audit_logs.delete)
   DELETE /admin/audit-logs   -> remove all entries (audit_logs.delete)

   Consumes the shared ApiClient.
   Exposes `Sna3tiAuditApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before audit-api.js");

  global.Sna3tiAuditApi = {
    list: function (params) { return R("GET", "admin/audit-logs", { params: params }); },
    remove: function (id) { return R("DELETE", "admin/audit-logs/" + encodeURIComponent(id)); },
    clear: function () { return R("DELETE", "admin/audit-logs"); }
  };

})(window);
