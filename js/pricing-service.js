/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/pricing-service.js
   Plans + subscriptions service (REQ 49).

   - Reads plans from the backend: GET /plans (source of truth).
   - NEVER hardcodes prices when backend plan data is available.
   - Fallback plan catalogue (FREE / VERIFIED 99 MAD / GOLD 199 MAD)
     is used ONLY when the backend is unreachable AND the environment
     explicitly permits mock fallback (development). Production never
     shows the fake catalogue — it yields an offline/error state instead.
   - Subscriptions: create / list / get / update / cancel.

   Consumes the shared ApiClient + subscriptions-api.
   Exposes `Sna3tiPricing`.
   ============================================================ */

(function (global) {
  "use strict";

  var Api = global.Sna3tiApi || null;
  var SubApi = global.Sna3tiSubscriptionsApi || null;
  var Fallback = global.Sna3tiFallback || null;

  // Offline fallback catalogue used ONLY when GET /plans is unreachable AND
  // the environment explicitly permits mock fallback (development only).
  // Prices mirror the DB seed; they are NOT the source of truth.
  var FALLBACK_PLANS = [
    { id: "PLAN-FREE",    code: "free",     name: "GRATUIT",  price: 0,   currency: "MAD", active: true },
    { id: "PLAN-VERIFIED",code: "verified", name: "VERIFIE",  price: 99,  currency: "MAD", active: true },
    { id: "PLAN-GOLD",    code: "gold",     name: "GOLD",     price: 199, currency: "MAD", active: true }
  ];

  // Centralized safe-fallback decision (REQ 57.x). Production NEVER falls back
  // to the fake catalogue; an API failure becomes an error/offline state.
  function canUseMockFallback() {
    return Fallback ? Fallback.canUseMockFallback() : false;
  }

  function guard() {
    if (!Api || !SubApi) return { ok:false, err: { success:false, code:"UNSUPPORTED", message:"Modules API non chargés." } };
    return { ok:true };
  }

  // Known plan codes (for lookups / helpers).
  var PLAN_BY_CODE = { free:"PLAN-FREE", verified:"PLAN-VERIFIED", gold:"PLAN-GOLD" };

  /** Fetch plans from the backend (source of truth). Falls back to the local
   *  catalogue ONLY in an explicitly-enabled development mode, flagged with
   *  `fromBackend:false`. In production an API failure returns an offline/
   *  error state — fake pricing is never shown. */
  function getPlans() {
    var g = guard();
    if (!g.ok) return Promise.resolve(canUseMockFallback() ? { success:true, fromBackend:false, data: FALLBACK_PLANS } : { success:false, fromBackend:false, code:"UNSUPPORTED", data: [] });
    return SubApi.plans.list()
      .then(function (res) {
        var plans = res && res.data ? res.data : [];
        return { success:true, fromBackend:true, data: plans };
      })
      .catch(function () {
        // Backend unreachable.
        if (canUseMockFallback()) {
          // development + explicit fallback -> flagged demo catalogue.
          return { success:true, fromBackend:false, data: FALLBACK_PLANS };
        }
        // production / dev-disabled -> error/offline, no fabricated pricing.
        return { success:false, fromBackend:false, code:"NETWORK_ERROR", message:"Impossible de joindre le serveur.", data: [] };
      });
  }

  /** Get a plan by code ('free'|'verified'|'gold') or by id ('PLAN-*'). */
  function getPlan(ref) {
    return getPlans().then(function (res) {
      var refLower = String(ref || "").toLowerCase();
      var found = (res.data || []).find(function (p) {
        return p.code === refLower || p.id === ref || (p.id||"").toLowerCase() === refLower;
      });
      return found || null;
    });
  }

  /** Create a subscription. price always comes from the DB plan server-side. */
  function createSubscription(professionalId, planId, opts) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    if (!professionalId || !planId) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"professionalId et planId requis." });
    return SubApi.create({ professionalId: professionalId, planId: planId, status: (opts && opts.status) || undefined, paymentStatus: (opts && opts.paymentStatus) || undefined })
      .then(function (res) { return { success:true, subscription: res && res.data ? res.data : res }; });
  }

  function listSubscriptions(params) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    return SubApi.list(params).then(function (res) { return { success:true, data: res.data || [], pagination: res.pagination || null }; });
  }

  function getSubscription(id) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    return SubApi.get(id).then(function (res) { return { success:true, subscription: res && res.data ? res.data : res }; });
  }

  function updateSubscription(id, data) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    if (!id) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"Identifiant d'abonnement requis." });
    return SubApi.update(id, data).then(function (res) { return { success:true, subscription: res && res.data ? res.data : res }; });
  }

  function cancelSubscription(id) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    if (!id) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"Identifiant d'abonnement requis." });
    return SubApi.cancel(id).then(function (res) { return { success:true, subscription: res && res.data ? res.data : res }; });
  }

  global.Sna3tiPricing = {
    getPlans: getPlans,
    getPlan: getPlan,
    planByCode: function (code) { return PLAN_BY_CODE[code] || null; },
    createSubscription: createSubscription,
    listSubscriptions: listSubscriptions,
    getSubscription: getSubscription,
    updateSubscription: updateSubscription,
    cancelSubscription: cancelSubscription,
    FALLBACK_PLANS: FALLBACK_PLANS
  };

})(window);
