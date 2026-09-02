/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/api-client.js
   Shared HTTP client for the Sna3ti REST API (Express, JWT).

   This is the low-level "API Client" used by every domain API
   module (auth-api, professionals-api, ...):

       UI -> Sna3tiData -> *-api modules -> ApiClient -> REST /api/v1

   Responsibilities (REQ 46):
   - HTTP verbs: GET, POST, PATCH, DELETE.
   - Base URL from configuration (never hardcoded localhost in prod).
   - Headers: Authorization: Bearer <JWT>, Content-Type: application/json.
   - Handles 2xx, 400, 401, 403, 404, 409, 429, 500, and network failures.
   - Normalizes every error to a consistent frontend shape:
         { success: false, message, code, details }
   - NEVER exposes backend internals (no stack traces / secrets / raw bodies).

   Global API exposed as `Sna3tiApi`.
   ============================================================ */

(function (global) {
  "use strict";

  /* ---------- Configuration ---------- */

  // Base URL resolution, in order of precedence:
  //   1. window.SNA3TI_API.BASE_URL
  //   2. window.sna3ti_api.baseUrl   (legacy config object)
  //   3. window.API_BASE_URL          (req 46 example key)
  //   4. same-origin default "/api/v1"
  function resolveBaseUrl() {
    var cfg = global.SNA3TI_API || global.sna3ti_api || {};
    var b = cfg.BASE_URL || cfg.baseUrl || global.API_BASE_URL;
    if (b) return String(b);
    return "/api/v1";
  }

  var BASE_URL = resolveBaseUrl().replace(/\/+$/, "");

  var TOKEN_KEY = "sna3ti_api_token";
  var REFRESH_KEY = "sna3ti_api_refresh";
  var DEFAULT_TIMEOUT_MS = 15000;

  /* ---------- Token store (client-side only, never persisted server-side) ---------- */

  function storage() { try { return global.localStorage; } catch (e) { return null; } }

  function getToken() { try { return storage() && storage().getItem(TOKEN_KEY); } catch (e) { return null; } }
  function getRefreshToken() { try { return storage() && storage().getItem(REFRESH_KEY); } catch (e) { return null; } }
  function setTokens(token, refreshToken) {
    try {
      var s = storage();
      if (!s) return;
      if (token) s.setItem(TOKEN_KEY, token); else s.removeItem(TOKEN_KEY);
      if (refreshToken) s.setItem(REFRESH_KEY, refreshToken); else s.removeItem(REFRESH_KEY);
    } catch (e) { /* storage is best-effort */ }
  }
  function clearTokens() { setTokens(null, null); }

  /* ---------- Status -> code mapping (req 46) ---------- */

  function codeForStatus(status, serverCode) {
    if (serverCode) return serverCode;
    switch (status) {
      case 400: return "VALIDATION_ERROR";
      case 401: return "UNAUTHORIZED";
      case 403: return "FORBIDDEN";
      case 404: return "NOT_FOUND";
      case 409: return "CONFLICT";
      case 429: return "RATE_LIMITED";
      case 500: return "INTERNAL_ERROR";
      default:  return status >= 500 ? "INTERNAL_ERROR" : "HTTP_" + status;
    }
  }

  // Normalize ANY resolved/rejected outcome into the consistent frontend
  // error shape. Never passes raw backend internals out of this module.
  function normalizeError(code, message, details) {
    return {
      success: false,
      code: code || "UNKNOWN_ERROR",
      message: message || "Une erreur est survenue.",
      details: details !== undefined ? details : undefined
    };
  }

  /* ---------- Request plumbing ---------- */

  function enc(v) { return encodeURIComponent(v); }

  function buildUrl(route, params) {
    var url = BASE_URL + "/" + String(route).replace(/^\//, "");
    if (params) {
      var qs = [];
      Object.keys(params).forEach(function (k) {
        var v = params[k];
        if (v === undefined || v === null || v === "") return;
        if (Array.isArray(v)) { v.forEach(function (x) { qs.push(enc(k) + "=" + enc(x)); }); return; }
        qs.push(enc(k) + "=" + enc(v));
      });
      if (qs.length) url += (url.indexOf("?") === -1 ? "?" : "&") + qs.join("&");
    }
    return url;
  }

  // Replace ":param" placeholders. IDs are OPAQUE strings — always inserted
  // verbatim, never coerced to numbers.
  function fillRoute(route, pathParams) {
    var out = String(route);
    Object.keys(pathParams || {}).forEach(function (k) {
      out = out.split(":" + k).join(String(pathParams[k]));
    });
    return out;
  }

  function timeoutPromise(ms) {
    return new Promise(function (_, reject) {
      setTimeout(function () {
        reject(normalizeError("NETWORK_ERROR", "Le serveur ne répond pas. Vérifiez votre connexion."));
      }, ms || DEFAULT_TIMEOUT_MS);
    });
  }

  /**
   * Core request runner.
   *   request(method, route, { body, params, pathParams, auth, token, timeout })
   * Resolves with the backend success envelope `{ success, data, pagination?, ... }`.
   * Rejects with the normalized `{ success:false, code, message, details }`.
   */
  function request(method, route, options) {
    options = options || {};
    var auth = options.auth !== false;
    var token = options.token || (auth ? getToken() : null);

    var url = buildUrl(fillRoute(route, options.pathParams), options.params);
    var headers = { "Accept": "application/json" };
    if (options.body !== undefined && options.body !== null) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = "Bearer " + token;

    if (typeof global.fetch !== "function") {
      return Promise.reject(normalizeError("UNSUPPORTED", "L'API REST n'est pas disponible dans cet environnement."));
    }

    var init = { method: method, headers: headers, cache: "no-store" };
    if (options.body !== undefined && options.body !== null) init.body = JSON.stringify(options.body);

    return Promise.race([global.fetch(url, init), timeoutPromise(options.timeout)])
      .then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : {}; } catch (e) { data = null; }

          // 2xx success
          if (res.ok) {
            // data may be the envelope { success, data, pagination } or a plain body.
            if (data && typeof data === "object") {
              if (data.success === false) {
                var e0 = data.error || {};
                throw normalizeError(codeForStatus(res.status, e0.code), e0.message, e0.details);
              }
              return data;
            }
            return { success: true, data: data };
          }

          // Non-2xx: extract safe error info from the envelope.
          var err = (data && data.error) ? data.error : {};
          var code = codeForStatus(res.status, err.code);
          var message = err.message || defaultMessage(res.status);
          throw normalizeError(code, message, err.details);
        });
      })
      .catch(function (e) {
        // Already normalized.
        if (e && e.success === false && e.code) return Promise.reject(e);
        // network / unexpected.
        return Promise.reject(normalizeError("NETWORK_ERROR", "Impossible de joindre le serveur. Réessayez."));
      });
  }

  function defaultMessage(status) {
    switch (status) {
      case 400: return "Requête invalide.";
      case 401: return "Non autorisé. Veuillez vous reconnecter.";
      case 403: return "Accès refusé.";
      case 404: return "Ressource introuvable.";
      case 409: return "Conflit avec une ressource existante.";
      case 429: return "Trop de requêtes. Réessayez plus tard.";
      case 500: return "Erreur interne du serveur.";
      default: return "Réponse inattendue du serveur.";
    }
  }

  /* ---------- Exports ---------- */

  var Sna3tiApi = {
    __request: request,
    request: request,

    // Configuration / inspection
    get baseUrl() { return BASE_URL; },
    config: function (c) {
      if (c) { BASE_URL = String(c.baseUrl || c.BASE_URL || c.apiBaseUrl || BASE_URL).replace(/\/+$/, ""); }
      return BASE_URL;
    },
    setBaseUrl: function (b) { if (b) BASE_URL = String(b).replace(/\/+$/, ""); return BASE_URL; },

    // Token helpers (used by auth-api)
    getToken: getToken,
    getRefreshToken: getRefreshToken,
    setTokens: setTokens,
    clearTokens: clearTokens,
    hasToken: function () { return !!getToken(); },

    // Health check for the facade's fallback logic.
    isReachable: function () {
      return request("GET", "notifications", { auth: false, timeout: 4000 })
        .then(function () { return true; })
        .catch(function () { return false; });
    },

    // Error normalization is exported for consistency across modules.
    normalizeError: normalizeError
  };

  global.Sna3tiApi = Sna3tiApi;

})(window);
