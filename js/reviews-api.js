/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/reviews-api.js
   Review moderation REST endpoints (REQ 46).
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiReviewsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before reviews-api.js");

  global.Sna3tiReviewsApi = {
    list: function () { return R("GET", "admin/reviews", {}); },
    // Admin moderation (publish / flag / hide / delete).
    publish: function (id) { return R("POST", "admin/reviews/:id/publish", { pathParams: { id: id } }); },
    flag: function (id) { return R("POST", "admin/reviews/:id/flag", { pathParams: { id: id } }); },
    hide: function (id) { return R("POST", "admin/reviews/:id/hide", { pathParams: { id: id } }); },
    remove: function (id) { return R("POST", "admin/reviews/:id/delete", { pathParams: { id: id } }); }
  };

})(window);
