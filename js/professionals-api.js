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

    // ---- Media (REQ 53) ----
    // Portfolio/échantillon media lives on the professional. Upload and access
    // control differ by consumer:
    //   mediaUrl / getMediaAdmin / admin*  -> admin-guarded (Bearera admin JWT)
    //   publicMediaUrl / publicGet         -> public portfolio serving
    mediaUrl: function (id, mediaId) { return "admin/professionals/" + id + "/media/" + mediaId; },
    publicMediaUrl: function (id, mediaId) { return "professionals/" + id + "/media/" + mediaId; },

    uploadMedia: function (id, file, kind, label) {
      var base = String(global.Sna3tiApi.baseUrl || "").replace(/\/+$/, "");
      var token = global.Sna3tiApi && global.Sna3tiApi.getToken ? (global.Sna3tiApi.getToken() || "") : "";
      var fd = new FormData();
      fd.append("file", file, file.name || "fichier");
      fd.append("kind", kind || "echantillon");
      if (label) fd.append("label", label);
      var init = { method: "POST", body: fd };
      if (token) init.headers = { "Authorization": "Bearer " + token };
      return global.fetch(base + "/admin/professionals/" + encodeURIComponent(id) + "/media", init)
        .then(function (res) {
          return res.text().then(function (text) {
            var data = null;
            try { data = text ? JSON.parse(text) : {}; } catch (e) { data = null; }
            if (res.ok) return data;
            var err = (data && data.error) ? data.error : {};
            throw { success: false, code: err.code || "UPLOAD_FAILED", message: err.message || "Téléversement impossible." };
          });
        });
    },

    removeMedia: function (id, mediaId) {
      return R("DELETE", "admin/professionals/:id/media/:mediaId", { pathParams: { id: id, mediaId: mediaId } });
    },

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
