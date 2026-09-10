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
    },

    // ---- Media (REQ 53) ----
    // Upload runs against the PUBLIC route (account-free onboarding); the
    // request's own reference is its only credential. removeMedia uses the
    // admin-guarded DELETE.
    mediaUrl: function (id, mediaId) { return "admin/professional-requests/" + id + "/media/" + mediaId; },

    uploadMedia: function (id, file, kind, label) {
      var base = String(global.Sna3tiApi.baseUrl || "").replace(/\/+$/, "");
      var token = global.Sna3tiApi && global.Sna3tiApi.getToken ? (global.Sna3tiApi.getToken() || "") : "";
      var fd = new FormData();
      fd.append("file", file, file.name || "fichier");
      fd.append("kind", kind || "echantillon");
      if (label) fd.append("label", label);
      var init = { method: "POST", body: fd };
      if (token) init.headers = { "Authorization": "Bearer " + token };
      return global.fetch(base + "/professional-requests/" + encodeURIComponent(id) + "/media", init)
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
      return R("DELETE", "admin/professional-requests/:id/media/:mediaId", { pathParams: { id: id, mediaId: mediaId } });
    }
  };

})(window);