/* ============================================================
   Sna3ti.ma — Public PWA
   js/public-registration.js
   Public Artisan Onboarding data layer (REQ 53 — account-free).

   Routes ALL account-free artisan application traffic through the
   central shared client (Sna3tiApi from js/api-client.js). The UI
   never touches HTTP, route construction, the response envelope, or
   backend error shapes directly:

       Register form (#regSubmit)
            ↓
       Sna3tiPublicRegistration   <-- this module
            ↓
       Sna3tiApi (auth: false)
            ↓
       POST /professional-requests
            ↓
       Backend (ARQ-xxxxx, status pending, plan resolved server-side)

   Contract (verified against backend/src):
     POST /professional-requests  → public, no auth, per-route rate limit
          request: { firstName, lastName, phone, profession, otherService,
                     city, cityLabel, description, price, priceUnit, plan }
          response: { success:true, data:{ id: "ARQ-xxxxx",
                     reference: "ARQ-xxxxx", status: "pending", ... } }
          status: "pending" is server-authoritative — this layer never
          fabricates a reference, an activation, a verified badge, or a
          marketplace publication.
     GET  /plans                   → public plan catalogue (id/code/name/price)

   This layer normalizes the response exactly once and maps backend errors
   into small, frontend-friendly results so the UI renders honest, translated
   states without duplicating backend business logic.

   UMD: window.Sna3tiPublicRegistration (browser) + module.exports (Node,
   for the mapper sanity-check used by the build/test workflow).
   ============================================================ */

(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = mod;
  }
  if (typeof root !== "undefined") {
    root.Sna3tiPublicRegistration = mod;
  }
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var R = typeof window !== "undefined" && window.Sna3tiApi && window.Sna3tiApi.__request;

  /* -------- Response normalization (done once, centrally) -------- */
  function normalizeCreatedPayload(payload) {
    if (payload && payload.data && payload.data.id) return payload.data;
    if (payload && payload.id) return payload;
    return payload;
  }

  function normalizePlansPayload(payload) {
    var body = payload && payload.data;
    if (Array.isArray(body)) return body;
    if (body && Array.isArray(body.data)) return body.data;
    if (Array.isArray(payload)) return payload;
    return [];
  }

  function mapPlan(raw) {
    if (!raw || typeof raw !== "object") return null;
    return {
      id: String(raw.id || ""),
      code: String(raw.code || "").toLowerCase(),
      name: raw.name,
      price: typeof raw.price === "number" ? raw.price : Number(raw.price) || 0
    };
  }

  /* Submit an account-free artisan onboarding request.
     The plan is a CODE ("free" | "verified" | "gold"); the backend resolves
     the real plan (id/name/price) server-side. Nothing status-bearing is
     sent from here. */
  function submit(data) {
    if (!R) return Promise.reject(baseUnavailableError());
    var body = {
      firstName: data && data.firstName,
      lastName: data && data.lastName,
      phone: data && data.phone,
      profession: data && data.profession,
      city: data && data.city,
      plan: data && data.plan
    };
    if (data && data.otherService) body.otherService = data.otherService;
    if (data && data.cityLabel) body.cityLabel = data.cityLabel;
    if (data && data.description) body.description = data.description;
    if (data && data.price !== undefined && data.price !== null && data.price !== "") body.price = data.price;
    if (data && data.priceUnit) body.priceUnit = data.priceUnit;
    return R("POST", "professional-requests", { auth: false, body: body })
      .then(function (payload) {
        return normalizeCreatedPayload(payload);
      });
  }

  /* Public plan catalogue (used to reflect the plan the artisan chose). */
  function plans() {
    if (!R) return Promise.reject(baseUnavailableError());
    return R("GET", "plans", { auth: false })
      .then(function (payload) {
        return normalizePlansPayload(payload).map(mapPlan).filter(Boolean);
      });
  }

  /* Map backend error responses { success:false, code, message, details }
     into a small, frontend-friendly result. */
  function handleRegistrationError(err) {
    var out = { ok: false, code: "UNKNOWN_ERROR", message: "error", status: null };
    if (!err) return out;
    out.code = String(err.code || "UNKNOWN_ERROR");
    out.status = typeof err.status === "number" ? err.status : null;
    out.message = err.message || out.message;
    if (err.details) out.details = err.details;
    switch (out.code) {
      case "CONFLICT":     return { ok: false, code: "DUPLICATE",     status: 409, message: out.message, details: out.details };
      case "VALIDATION_ERROR":
      case "HTTP_400":
      case "HTTP_422":     return { ok: false, code: "VALIDATION_ERROR", status: 400, message: out.message, details: out.details };
      case "RATE_LIMITED":
      case "HTTP_429":     return { ok: false, code: "RATE_LIMITED",    status: 429, message: out.message, details: out.details };
      case "NETWORK_ERROR": return { ok: false, code: "NETWORK_ERROR",  status: null, message: out.message, details: out.details };
      case "INTERNAL_ERROR":
      case "HTTP_500":
      case "HTTP_502":
      case "HTTP_503":     return { ok: false, code: "SERVER_ERROR",    status: 500, message: out.message, details: out.details };
      case "UNSUPPORTED":  return { ok: false, code: "UNSUPPORTED",     status: null, message: out.message, details: out.details };
      default: return out;
    }
  }

  function baseUnavailableError() {
    return { success: false, code: "UNSUPPORTED", message: "API client indisponible." };
  }

  return {
    submit: submit,
    plans: plans,
    handleRegistrationError: handleRegistrationError,
    normalizeCreatedPayload: normalizeCreatedPayload,
    normalizePlansPayload: normalizePlansPayload,
    mapPlan: mapPlan
  };
});