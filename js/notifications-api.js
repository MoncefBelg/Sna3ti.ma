/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/notifications-api.js
   Notification REST endpoints for the ADMIN centre.
   Loaded only by admin.html (see script tag). Uses the admin
   namespace so the dashboard sees EVERY event notification —
   including broadcast (userId null) notifications raised by the
   backend when professionals register, are approved / activated,
   verified, pay, or are reported. The public per-user
   "notifications" endpoints stay reserved for customer sessions.
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiNotificationsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before notifications-api.js");

  global.Sna3tiNotificationsApi = {
    list: function (params) { return R("GET", "admin/notifications", { params: params }); },
    create: function (payload) { return R("POST", "notifications", { body: payload }); },
    markRead: function (id) { return R("POST", "admin/notifications/:id/read", { pathParams: { id: id } }); },
    markAllRead: function () { return R("POST", "admin/notifications/read-all", {}); }
  };

})(window);
