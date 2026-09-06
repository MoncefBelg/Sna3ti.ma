/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/professional-requests-api.js
   Registration approval REST endpoints (REQ 54).
   Consumes the shared ApiClient (global.Sna3tiApi) * after
   api-client.js. Backend is the single source of truth for
   registration state: list/search/filter via GET
   /admin/professional-requests ("professionalRequests.view");
   approve/reject via POST .../:id/approve|reject
   ("professionalRequests.approve" / "professionalRequests.reject").
   Exposes `Sna3tiProfessionalRequestsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before professional-requests-api.js");

  global.Sna3tiProfessionalRequestsApi = {
    // REQ 54: admin-scoped read. filter params (q / status / plan / city) are
    // sent to the backend; the backend is authoritative for the result set.
    adminList: function (params) { return R("GET", "admin/professional-requests", { params: params }); },
    adminGet: function (id) { return R("GET", "admin/professional-requests/:id", { pathParams: { id: id } }); },
    approve: function (id) { return R("POST", "admin/professional-requests/:id/approve", { pathParams: { id: id } }); },
    reject: function (id, reason) {
      return R("POST", "admin/professional-requests/:id/reject", { pathParams: { id: id }, body: { reason: reason } });
    }
  };

})(window);