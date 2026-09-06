/* ============================================================
   Sna3ti.ma — Public PWA
   js/public-reviews.js
   Public Reviews data layer (Phase 2 — Public Professional Reviews).

   Routes ALL public review traffic through the central shared client
   (Sna3tiApi from js/api-client.js). The UI never touches HTTP, route
   construction, the response envelope, or backend error shapes directly:

       Public Profile UI
           ↓
       Sna3tiPublicReviews   <-- this module
           ↓
       Sna3tiApi
           ↓
       /professionals/:id/reviews
           ↓
       Backend

   Contract (verified against backend/src):
     GET  /professionals/:professionalId/reviews  → public, no auth
          response: { success:true, data:{ data:[...published reviews],
                                             meta:{ total, average } } }
     POST /professionals/:professionalId/reviews  → auth + eligibility required
          request:  { rating: int 1-5, comment: str<=2000 }
          response: { success:true, data:{ review... } }
          rejected with normalized { success:false, code, message, details }.

   This layer NORMALIZES the response nesting exactly once (data.data →
   plain array). It never fabricates customers, ratings, comments, dates,
   verified badges, counts, or ratings.

   UMD: window.Sna3tiPublicReviews (browser) + module.exports (Node, for the
   mapper sanity-check used by the build/test workflow).
   ============================================================ */

(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = mod;
  }
  if (typeof root !== "undefined") {
    root.Sna3tiPublicReviews = mod;
  }
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  /* Opaque professional ids (e.g. "PRO-10295") are strings and MUST remain
     verbatim. Never coercing to a number anywhere in this layer. */
  var R = typeof window !== "undefined" && window.Sna3tiApi && window.Sna3tiApi.__request;

  /* -------- Response normalization (done once, centrally) --------
     Public listing endpoint returns { data: { data:[...], meta } }.
     Normalize to a plain array of reviews, preserving backend field names. */
  function normalizeReviewsPayload(payload) {
    if (!payload || typeof payload !== "object") return [];
    var body = payload.data;
    if (body && Array.isArray(body.data)) return body.data;
    if (Array.isArray(body)) return body;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  }

  function normalizeSingleReviewPayload(payload) {
    if (payload && payload.data && payload.data.id) return payload.data;
    if (payload && payload.id) return payload;
    return payload;
  }

  /* Fetch published reviews for a professional. Public, no auth required. */
  function getReviews(professionalId) {
    if (!R) return Promise.reject(baseUnavailableError());
    return R("GET", "professionals/:professionalId/reviews", {
      auth: false,
      pathParams: { professionalId: String(professionalId) }
    }).then(function (payload) {
      return { reviews: normalizeReviewsPayload(payload), raw: payload };
    });
  }

  /* Submit a review. Requires an authenticated platform User (JWT via
     Sna3tiApi). Backend remains authoritative for identity, eligibility,
     duplicate prevention, and publication status. We never override it. */
  function createReview(professionalId, payload) {
    if (!R) return Promise.reject(baseUnavailableError());
    var body = {
      rating: payload && payload.rating,
      comment: (payload && payload.comment) || ""
    };
    return R("POST", "professionals/:professionalId/reviews", {
      pathParams: { professionalId: String(professionalId) },
      body: body
    }).then(function (created) {
      return normalizeSingleReviewPayload(created);
    });
  }

  /* Map backend error responses { success:false, code, message, details }
     into a small, frontend-friendly result so the UI renders honest,
     translated states without duplicating backend business logic. */
  function handleReviewError(err) {
    var out = { ok: false, code: "UNKNOWN_ERROR", message: "error", status: null };
    if (!err) return out;
    out.code = String(err.code || "UNKNOWN_ERROR");
    out.status = typeof err.status === "number" ? err.status : null;
    out.message = err.message || out.message;
    if (err.details) out.details = err.details;
    switch (out.code) {
      case "UNAUTHORIZED": return { ok: false, code: "UNAUTHORIZED", status: 401, message: out.message, details: out.details };
      case "FORBIDDEN":    return { ok: false, code: "FORBIDDEN",    status: 403, message: out.message, details: out.details };
      case "CONFLICT":     return { ok: false, code: "CONFLICT",     status: 409, message: out.message, details: out.details };
      case "VALIDATION_ERROR":
      case "HTTP_400":
      case "HTTP_422":     return { ok: false, code: "VALIDATION_ERROR", status: 400, message: out.message, details: out.details };
      case "RATE_LIMITED":
      case "HTTP_429":     return { ok: false, code: "RATE_LIMITED",    status: 429, message: out.message, details: out.details };
      case "NOT_FOUND":    return { ok: false, code: "NOT_FOUND",       status: 404, message: out.message, details: out.details };
      case "NETWORK_ERROR": return { ok: false, code: "NETWORK_ERROR",  status: null, message: out.message, details: out.details };
      case "INTERNAL_ERROR": return { ok: false, code: "INTERNAL_ERROR", status: 500, message: out.message, details: out.details };
      default: return out;
    }
  }

  function baseUnavailableError() {
    return { success: false, code: "UNSUPPORTED", message: "API client indisponible." };
  }

  return {
    getReviews: getReviews,
    createReview: createReview,
    handleReviewError: handleReviewError,
    normalizeReviewsPayload: normalizeReviewsPayload,
    normalizeSingleReviewPayload: normalizeSingleReviewPayload
  };
});