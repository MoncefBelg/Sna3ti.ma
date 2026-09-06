/* ============================================================
   Sna3ti.ma — Public Marketplace professionals data layer.
   js/public-professionals.js
   ============================================================
   Thin adapter that lets the PUBLIC marketplace read real
   professionals from the Sna3ti backend, reusing the existing
   central client (Sna3tiApi from js/api-client.js).

   It is intentionally NOT a second API client: every network
   call goes through Sna3tiApi.request. This module only:
     - maps the backend Professional record to the existing
       frontend shape (one place, once),
     - exposes getAll() / getById() for Hero / Search / Profile,
     - keeps opaque ids (PRO-10295, PRO-AB73X, ...) verbatim —
       nothing here ever parses an id as a number.

   Base URL: resolved through the same configuration mechanism
   as the rest of the app (SNA3TI_API / sna3ti_api / API_BASE_URL).
   A dedicated window.SNA3TI_PROFESSIONALS_API may ALSO be set for
   the public marketplace; when present it becomes the module's
   base URL if no broader SNA3TI_API config exists.

   Exposed as window.Sna3tiPublicProfessionals (browser) or
   module.exports with the pure helpers (Node tests).
   ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory({});
  } else if (typeof window !== "undefined") {
    window.Sna3tiPublicProfessionals = factory(window);
  } else {
    root.Sna3tiPublicProfessionals = factory(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (ctx) {
  "use strict";

  var global = (typeof window !== "undefined") ? window : (ctx || {});
  var api = global.Sna3tiApi || null;

  var LIST_LIMIT = 100;

  function str(v) { return v == null ? "" : String(v); }

  // Base URL for the public professionals source. Precedence:
  //   window.SNA3TI_PROFESSIONALS_API   (dedicated public-PWA override)
  //   SNA3TI_API / sna3ti_api / API_BASE_URL  (shared config, see api-client)
  //   "/api/v1" (same-origin default)
  function resolveBase() {
    if (str(global.SNA3TI_PROFESSIONALS_API || "").trim()) {
      return String(global.SNA3TI_PROFESSIONALS_API).replace(/\/+$/, "");
    }
    if (global.Sna3tiApi && global.Sna3tiApi.baseUrl) {
      return String(global.Sna3tiApi.baseUrl).replace(/\/+$/, "");
    }
    var cfg = global.SNA3TI_API || global.sna3ti_api || {};
    var b = cfg.BASE_URL || cfg.baseUrl || global.API_BASE_URL;
    if (b) return String(b).replace(/\/+$/, "");
    return "/api/v1";
  }

  // True when a dedicated public professionals source is configured.
  function hasApi() {
    return !!String(global.SNA3TI_PROFESSIONALS_API || "").trim();
  }

  // When only SNA3TI_PROFESSIONALS_API is set, point the shared client at it.
  function configureClient() {
    if (!api) return;
    var base = String(global.SNA3TI_PROFESSIONALS_API || "").replace(/\/+$/, "");
    if (!base) return;
    var cfg = global.SNA3TI_API || global.sna3ti_api || {};
    if ((cfg.BASE_URL || cfg.baseUrl || global.API_BASE_URL)) return;
    api.setBaseUrl(base);
  }

  function apiBase() { return resolveBase(); }

  /* ---------- Envelope normalization ---------- */

  function normalizeProfessionPayload(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.professionals)) return data.professionals;
    return null;
  }

  /* ---------- Shape normalization (backend -> existing frontend) ----------
     Single mapping point. The existing UI consumes: id, name, job, category,
     city, area, rating, reviews, price, pricingUnit, verified, available,
     package, image, phone. Fields the backend does not carry (price/image)
     are mapped to null so the UI shows its honest fallbacks, never invented
     values. Ratings/reviews/verification/subscription are taken verbatim
     from the record. */
  function mapPublicProfessional(raw) {
    if (!raw || typeof raw !== "object") return null;

    var media = Array.isArray(raw.media) ? raw.media : [];
    var image = null;
    for (var i = 0; i < media.length; i++) {
      var m = media[i];
      if (typeof m === "string" && m) { image = m; break; }
      if (m && typeof m === "object" && str(m.url)) { image = str(m.url); break; }
    }

    var services = Array.isArray(raw.services)
      ? raw.services.map(function (s) { return str(s); }).filter(Boolean)
      : [];

    var rating = raw.rating;
    if (typeof rating !== "number") {
      rating = raw.rating == null || raw.rating === "" ? null : Number(raw.rating);
    }
    if (rating !== null && !isFinite(rating)) rating = null;

    var reviews = raw.reviewsCount;
    if (typeof reviews !== "number") {
      reviews = raw.reviewsCount == null ? 0 : Number(raw.reviewsCount);
    }
    if (!isFinite(reviews) || reviews < 0) reviews = 0;

    var verificationStatus = str(raw.verificationStatus).toLowerCase();

    return {
      id: str(raw.id),                                     // opaque — preserved verbatim
      name: str(raw.name),
      job: str(raw.job),
      category: services[0] || (str(raw.categoryId) || ""),
      city: str(raw.city),
      cityId: raw.cityId != null ? str(raw.cityId) : null,
      area: str(raw.area),
      neighborhood: str(raw.neighborhood),
      description: str(raw.description),
      experience: str(raw.experience),
      rating: rating,
      reviews: reviews,
      price: null,                                         // backend has no price field
      pricingUnit: null,
      verified: raw.verified === true || verificationStatus === "approved",
      available: typeof raw.available === "boolean" ? raw.available : true,
      package: (str(raw.package) || "free").toLowerCase(),
      subscriptionStatus: (str(raw.subscriptionStatus) || "none").toLowerCase(),
      subscriptionExpiresAt: raw.subscriptionExpiresAt || null,
      image: image,
      phone: str(raw.phone) || str(raw.whatsapp) || "",
      status: str(raw.status).toLowerCase(),
      identityStatus: str(raw.identityStatus),
      professionStatus: str(raw.professionStatus),
      verificationStatus: verificationStatus,
      planEligible: Boolean(raw.planEligible),
      createdAt: raw.createdAt || null
    };
  }

  /* ---------- Data access ---------- */

  var inFlight = null;

  // Returns a Promise of the mapped professional array ([] on an empty
  // dataset). Rejects with the normalized API error when the request fails.
  // Concurrent callers share one in-flight request.
  function getAll() {
    if (!hasApi()) return Promise.resolve(null);
    if (inFlight) return inFlight;
    inFlight = api.__request("GET", "professionals", {
      auth: false,
      params: { limit: String(LIST_LIMIT) }
    })
      .then(function (res) {
        var list = normalizeProfessionPayload(res);
        if (!Array.isArray(list)) list = [];
        return list.map(mapPublicProfessional).filter(Boolean);
      })
      .then(function (out) { inFlight = null; return out; },
        function (err) { inFlight = null; throw err; });
    return inFlight;
  }

  // Prefers the already-loaded collection (existing profile architecture);
  // falls back to GET /professionals/:id. Never resolves to a fake record.
  function getById(id, collection) {
    var want = str(id);
    if (Array.isArray(collection)) {
      for (var i = 0; i < collection.length; i++) {
        if (collection[i] && str(collection[i].id) === want) {
          return Promise.resolve(collection[i]);
        }
      }
    }
    if (!hasApi() || !api) return Promise.resolve(null);
    return api.__request("GET", "professionals/" + want, { auth: false })
      .then(function (res) {
        var d = res && res.data;
        return d ? mapPublicProfessional(d) : null;
      },
      function () { return null; });
  }

  configureClient();

  return {
    getAll: getAll,
    getById: getById,
    mapPublicProfessional: mapPublicProfessional,
    normalizeProfessionPayload: normalizeProfessionPayload,
    resolveBase: resolveBase,
    apiBase: apiBase,
    hasApi: hasApi,
    LIST_LIMIT: LIST_LIMIT
  };
});