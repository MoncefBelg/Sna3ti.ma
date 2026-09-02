/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/notifications-api.js
   Notification REST endpoints (REQ 46).
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiNotificationsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before notifications-api.js");

  global.Sna3tiNotificationsApi = {
    list: function (params) { return R("GET", "notifications", { params: params }); },
    create: function (payload) { return R("POST", "notifications", { body: payload }); },
    markRead: function (id) { return R("POST", "notifications/:id/read", { pathParams: { id: id } }); },
    markAllRead: function () { return R("POST", "notifications/read-all", {}); }
  };

})(window);
