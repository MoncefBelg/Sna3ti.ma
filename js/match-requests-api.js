/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/match-requests-api.js
   "Demandes de mise en relation" (Sna3ti Match) admin REST endpoints.
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiMatchRequestsApi`.
   WhatsApp is a NOTIFICATION CHANNEL ONLY — a request is always
   saved even if the WhatsApp notification fails; "sent" is never
   required.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before match-requests-api.js");

  global.Sna3tiMatchRequestsApi = {
    adminList: function (params) { return R("GET", "admin/match-requests", { params: params || {} }); },
    adminGet: function (id) { return R("GET", "admin/match-requests/:id", { pathParams: { id: id } }); },
    updateStatus: function (id, status) { return R("PATCH", "admin/match-requests/:id/status", { pathParams: { id: id }, body: { status: status } }); },
    updateArtisan: function (id, data) { return R("PATCH", "admin/match-requests/:id/artisan", { pathParams: { id: id }, body: data }); },
    updatePrices: function (id, data) { return R("PATCH", "admin/match-requests/:id/prices", { pathParams: { id: id }, body: data }); },
    retryWhatsApp: function (id) { return R("POST", "admin/match-requests/:id/whatsapp/retry", { pathParams: { id: id } }); },
    photoUrl: function (id, photoId) { return "admin/match-requests/" + id + "/photo/" + photoId; }
  };

})(window);
