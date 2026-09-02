/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/subscriptions-api.js
   Subscription & plan REST endpoints (REQ 46).
   Consumes the shared ApiClient (global.Sna3tiApi).
   Exposes `Sna3tiSubscriptionsApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var R = global.Sna3tiApi && global.Sna3tiApi.__request;
  if (!R) throw new Error("api-client.js must load before subscriptions-api.js");

  global.Sna3tiSubscriptionsApi = {
    list: function (params) { return R("GET", "subscriptions", { params: params }); },
    get: function (id) { return R("GET", "subscriptions/:id", { pathParams: { id: id } }); },
    create: function (payload) { return R("POST", "subscriptions", { body: payload }); },
    update: function (id, payload) { return R("PATCH", "subscriptions/:id", { pathParams: { id: id }, body: payload }); },
    cancel: function (id) { return R("POST", "subscriptions/:id/cancel", { pathParams: { id: id } }); },

    plans: { list: function () { return R("GET", "plans", {}); } }
  };

})(window);
