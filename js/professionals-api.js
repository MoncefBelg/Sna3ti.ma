/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/professionals-api.js
   Professional & reviews REST endpoints (REQ 46).
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiProfessionalsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before professionals-api.js");

  global.Sna3tiProfessionalsApi = {
    list: function (params) { return R("GET", "professionals", { params: params }); },
    get: function (id) { return R("GET", "professionals/:id", { pathParams: { id: id } }); },
    create: function (payload) { return R("POST", "professionals", { body: payload }); },
    update: function (id, payload) { return R("PATCH", "professionals/:id", { pathParams: { id: id }, body: payload }); },
    remove: function (id) { return R("DELETE", "professionals/:id", { pathParams: { id: id } }); },
    suspend: function (id) { return R("POST", "admin/professionals/:id/suspend", { pathParams: { id: id } }); },
    activate: function (id) { return R("POST", "admin/professionals/:id/activate", { pathParams: { id: id } }); },

    // ---- Admin-scoped reads (REQ 52). Source of truth for the admin panel.
    // These require an authenticated admin JWT and are permission-gated by the
    // backend (professionals.view / edit / suspend). Opaque IDs pass through.
    adminList: function (params) { return R("GET", "admin/professionals", { params: params }); },
    adminGet: function (id) { return R("GET", "admin/professionals/:id", { pathParams: { id: id } }); },
    adminUpdate: function (id, payload) { return R("PATCH", "admin/professionals/:id", { pathParams: { id: id }, body: payload }); },
    adminSuspend: function (id, reason) { return R("POST", "admin/professionals/:id/suspend", { pathParams: { id: id }, body: { reason: reason } }); },
    adminActivate: function (id) { return R("POST", "admin/professionals/:id/activate", { pathParams: { id: id } }); },

    reviews: {
      list: function (professionalId, params) {
        return R("GET", "professionals/:professionalId/reviews", { pathParams: { professionalId: professionalId }, params: params });
      },
      create: function (professionalId, payload) {
        return R("POST", "professionals/:professionalId/reviews", { pathParams: { professionalId: professionalId }, body: payload });
      }
    }
  };

})(window);
