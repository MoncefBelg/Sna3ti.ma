/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/settings-api.js
   Settings REST endpoint (REQ 52).

   GET /admin/settings -> { success, data: { siteName, currency, locale } }

   Note: the backend currently only exposes a read-only settings
   endpoint. No PUT/PATCH exists yet.

   Consumes the shared ApiClient.
   Exposes `Sna3tiSettingsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before settings-api.js");

  global.Sna3tiSettingsApi = {
    get: function () { return R("GET", "admin/settings", {}); }
  };

})(window);
