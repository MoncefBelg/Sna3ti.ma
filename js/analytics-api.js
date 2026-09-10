/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/analytics-api.js
   Analytics REST endpoint (REQ 61).

   GET /admin/analytics -> { success, data: { totals, revenueByPlan,
     mrrByPlan, months[12], days[90], topServices, topCities, leads, notes } }

   Figures are computed from the live repositories at request time, so the
   page shows real, always-current numbers. Consumes the shared ApiClient.
   Exposes `Sna3tiAnalyticsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before analytics-api.js");

  global.Sna3tiAnalyticsApi = {
    get: function () { return R("GET", "admin/analytics", {}); }
  };

})(window);