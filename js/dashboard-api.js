/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/dashboard-api.js
   Dashboard REST endpoint (REQ 52).

   GET /admin/dashboard -> { success, data: { counts: {...} } }

   Consumes the shared ApiClient.
   Exposes `Sna3tiDashboardApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before dashboard-api.js");

  global.Sna3tiDashboardApi = {
    get: function () { return R("GET", "admin/dashboard", {}); }
  };

})(window);
