/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/verifications-api.js
   Verification request REST endpoints (REQ 46).
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiVerificationsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before verifications-api.js");

  global.Sna3tiVerificationsApi = {
    list: function (params) { return R("GET", "verifications", { params: params }); },
    // REQ 52: admin-scoped read. Source of truth = GET /admin/verifications
    // (permission "verification.view"). A successful empty response is an empty
    // state; a network / server / 401 / 403 / 429 / 500 failure rejects so the
    // UI renders an error/offline state — never demo data. Opaque IDs pass
    // through verbatim — never coerced.
    adminList: function (params) { return R("GET", "admin/verifications", { params: params }); },
    get: function (id) { return R("GET", "verifications/:id", { pathParams: { id: id } }); },
    create: function (payload) { return R("POST", "verifications", { body: payload }); },
    approve: function (id) { return R("POST", "verifications/:id/approve", { pathParams: { id: id } }); },
    reject: function (id, reason) { return R("POST", "verifications/:id/reject", { pathParams: { id: id }, body: { reason: reason } }); },
    requestInfo: function (id, note) { return R("POST", "verifications/:id/request-information", { pathParams: { id: id }, body: { note: note } }); }
  };

})(window);
