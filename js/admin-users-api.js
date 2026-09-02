/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/admin-users-api.js
   Admin-user management REST endpoints (REQ 52).

   GET    /admin/admin-users       -> list
   POST   /admin/admin-users       -> create
   PATCH  /admin/admin-users/:id   -> update

   No DELETE endpoint on the backend.

   Consumes the shared ApiClient.
   Exposes `Sna3tiAdminUsersApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before admin-users-api.js");

  global.Sna3tiAdminUsersApi = {
    list: function () { return R("GET", "admin/admin-users", {}); },
    create: function (payload) { return R("POST", "admin/admin-users", { body: payload }); },
    update: function (id, payload) { return R("PATCH", "admin/admin-users/:id", { pathParams: { id: id }, body: payload }); }
  };

})(window);
