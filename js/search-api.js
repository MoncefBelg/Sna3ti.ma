/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/search-api.js
   Public search REST endpoint (REQ 54).

   GET /search?service=...&city=...&query=...

   Returns backend-ranked results (GOLD > VERIFIED > FREE).
   Backend excludes deleted/suspended professionals.

   Consumes the shared ApiClient.
   Exposes `Sna3tiSearchApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before search-api.js");

  global.Sna3tiSearchApi = {
    search: function (params) { return R("GET", "search", { params: params, auth: false }); }
  };

})(window);
