/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/legal-api.js
   Legal content REST endpoints (REQ 46).
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiLegalApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before legal-api.js");

  global.Sna3tiLegalApi = {
    // Public: { type, language } in ("terms"|"privacy"|"about") x ("en"|"fr"|"ar")
    get: function (type, language) {
      return R("GET", "legal/:type/:language", { auth: false, pathParams: { type: type, language: language } });
    },
    listAll: function () { return R("GET", "admin/legal", {}); },
    create: function (type, language, payload) {
      return R("POST", "admin/legal/:type/:language", { pathParams: { type: type, language: language }, body: payload });
    },
    update: function (id, payload) { return R("PATCH", "admin/legal/:id", { pathParams: { id: id }, body: payload }); }
  };

})(window);
