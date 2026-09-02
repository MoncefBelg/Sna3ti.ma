/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/auth-api.js
   Auth REST endpoints (REQ 46).
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiAuthApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before auth-api.js");

  global.Sna3tiAuthApi = {
    login: function (email, password) {
      return R("POST", "auth/login", { auth: false, body: { email: email, password: password } })
        .then(function (res) {
          // Persist JWT for subsequent authorized requests.
          if (res && res.token) global.Sna3tiApi.setTokens(res.token, res.refreshToken || null);
          return res;
        });
    },
    register: function (payload) {
      return R("POST", "auth/register", { auth: false, body: payload });
    },
    refresh: function () {
      var rt = global.Sna3tiApi.getRefreshToken();
      if (!rt) return Promise.reject(global.Sna3tiApi.normalizeError("UNAUTHORIZED", "Session expirée."));
      return R("POST", "auth/refresh", { auth: false, body: { refreshToken: rt } })
        .then(function (res) {
          if (res && res.token) global.Sna3tiApi.setTokens(res.token, global.Sna3tiApi.getRefreshToken());
          return res;
        });
    },
    me: function () { return R("GET", "auth/me", {}); },
    logout: function () {
      return R("POST", "auth/logout", {}).then(function (res) {
        global.Sna3tiApi.clearTokens();
        return res;
      }).catch(function (err) {
        global.Sna3tiApi.clearTokens();
        return Promise.reject(err);
      });
    }
  };

})(window);
