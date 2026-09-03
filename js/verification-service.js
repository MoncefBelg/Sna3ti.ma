/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/verification-service.js
   Verification service (REQ 51).

   Connects verification pages/forms to the backend:

     Professional -> POST /verifications   (submit request)
     Admin review  -> POST /:id/approve | /reject | /request-information
     Read          -> GET /verifications, GET /verifications/:id

   BUSINESS RULE:
   - Approval controls verification status (the badge).
   - A payment does NOT, and a subscription does NOT.
   - No verification badge is ever granted because a payment/subscription
     was confirmed. (Confirmed at the backend; this client never maps
     payment/subscription events to a badge.)

   Consumes the shared ApiClient + verifications-api.
   Exposes `Sna3tiVerification`.
   ============================================================ */

(function (global) {
  "use strict";

  var Api = global.Sna3tiApi || null;
  var VerApi = global.Sna3tiVerificationsApi || null;

  function guard() {
    if (!Api || !VerApi) return { ok:false, err: { success:false, code:"UNSUPPORTED", message:"Modules API non chargés." } };
    return { ok:true };
  }

  function unwrap(res) { return res && res.data !== undefined ? res.data : res; }

  /** Submit a verification request: { professionalId, level, planId?, requestedPlan?, priority? } */
  function submit(input) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    input = input || {};
    if (!input.professionalId) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"professionalId requis." });
    if (!input.level) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"Niveau de vérification requis." });

    var body = { professionalId: input.professionalId, level: input.level };
    if (input.planId) body.planId = input.planId;
    if (input.requestedPlan) body.requestedPlan = input.requestedPlan;
    if (input.priority) body.priority = input.priority;

    return VerApi.create(body).then(function (res) {
      return { success:true, request: unwrap(res) };
    });
  }

  function list(params) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    return VerApi.list(params).then(function (res) {
      return { success:true, data: res.data || [], pagination: res.pagination || null };
    });
  }

  /** Admin-scoped read (permission "verification.view"). Source = GET /admin/verifications. */
  function adminList(params) {
    var g = guard();
    if (!g.ok || !VerApi.adminList) return Promise.reject({ success:false, code:"UNSUPPORTED", message:"Module API vérifications non chargé." });
    return VerApi.adminList(params || {}).then(function (res) {
      return { success:true, data: res.data || [], pagination: res.pagination || null };
    });
  }

  function get(id) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    if (!id) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"Identifiant requis." });
    return VerApi.get(id).then(function (res) {
      return { success:true, request: unwrap(res) };
    });
  }

  /** Admin approves a verification request -> sets verification status (badge). */
  function approve(id) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    if (!id) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"Identifiant requis." });
    return VerApi.approve(id).then(function (res) {
      return { success:true, request: unwrap(res) };
    });
  }

  /** Admin rejects a verification request (reason required). */
  function reject(id, reason) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    if (!id) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"Identifiant requis." });
    if (!reason || !String(reason).trim()) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"Le motif du rejet est requis." });
    return VerApi.reject(id, reason).then(function (res) {
      return { success:true, request: unwrap(res) };
    });
  }

  /** Admin requests more information (note required). */
  function requestInfo(id, note) {
    var g = guard();
    if (!g.ok) return Promise.reject(g.err);
    if (!id) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"Identifiant requis." });
    if (!note || !String(note).trim()) return Promise.reject({ success:false, code:"BAD_REQUEST", message:"La note est requise." });
    return VerApi.requestInfo(id, note).then(function (res) {
      return { success:true, request: unwrap(res) };
    });
  }

  // Business-rule guardrail exposed for UI use: tells which events may change
  // a verification badge. Only explicit verification approval may.
  function canGrantBadge(event) {
    return event === "approve";
  }

  global.Sna3tiVerification = {
    submit: submit,
    list: list,
    adminList: adminList,
    get: get,
    approve: approve,
    reject: reject,
    requestInfo: requestInfo,
    canGrantBadge: canGrantBadge
  };

})(window);
