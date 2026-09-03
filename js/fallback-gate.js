/* ============================================================
   Sna3ti.ma — Safe mock-fallback gate (centralized decision).
   ============================================================
   Centralizes EVERY decision about whether the UI may fall back
   to local/demo (mock) data when the REST API is unavailable.

   Rules (strict, per the REQ 46-56 production requirements):

     1. Production ALWAYS forbids mock fallback — regardless of
        SNA3TI_ALLOW_MOCK_FALLBACK. In production an API failure is
        an error state, never silent demo data.
     2. Development allows mock fallback ONLY when explicitly opted
        in via SNA3TI_ALLOW_MOCK_FALLBACK=true.
     3. Test environment is present but the gate stays pure /
        side-effect free, so the existing test suite keeps passing.

   Environments read (in priority order) from:
     - an explicit context object (window), else process.env.
     - SNA3TI_ENV            = development | production | test
     - SNA3TI_ALLOW_MOCK_FALLBACK = true | false

   Exposes:
     - canUseMockFallback(ctx?) -> bool   (single source of truth)
     - effectiveEnv(ctx?)      -> string
     - reasoning(ctx?)         -> { env, allowMock, canFallback, reason }
     - gateFromContext()       -> top-level ctx (window || process.env)
   ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    // CommonJS (Node / backend tests)
    module.exports = factory({});
  } else if (typeof window !== "undefined") {
    // Browser — attach to the global namespace.
    window.Sna3tiFallback = factory(window);
  } else {
    root.Sna3tiFallback = factory(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (global) {
  "use strict";

  var DEFAULT_ENV = "development";

  /** Resolve the context to read env vars from (window | process.env). */
  function ctxSource(ctx) {
    if (ctx && ctx.SNA3TI_ENV !== undefined) return ctx;
    if (typeof process !== "undefined" && process.env) return process.env;
    return ctx || {};
  }

  function normalizeEnv(raw) {
    return String(raw || "").trim().toLowerCase();
  }

  /** Return the effective environment, defaulting to a safe value. */
  function effectiveEnv(ctx) {
    var src = ctxSource(ctx);
    var env = normalizeEnv(src.SNA3TI_ENV);
    if (env === "production" || env === "development" || env === "test") return env;
    return DEFAULT_ENV;
  }

  /** True if the environment explicitly opts into mock fallback. */
  function allowMock(ctx) {
    var src = ctxSource(ctx);
    var raw = String(src.SNA3TI_ALLOW_MOCK_FALLBACK || "").trim().toLowerCase();
    return raw === "true" || raw === "1";
  }

  /**
   * THE single decision point. Never scatter env checks elsewhere.
   *
   *   canUseMockFallback()                     -> read from window/process.env
   *   canUseMockFallback({SNA3TI_ENV:...})     -> explicit (tests)
   *
   * Returns true ONLY in an explicitly-enabled development mode.
   * Production ALWAYS returns false.
   */
  function canUseMockFallback(ctx) {
    var env = effectiveEnv(ctx);
    if (env === "production") return false; // hard rule
    if (env === "development") return allowMock(ctx) === true;
    return false; // test and unknown env: no mock fallback
  }

  /** Human-readable reasoning for UI / debugging (safe, no secrets). */
  function reasoning(ctx) {
    var env = effectiveEnv(ctx);
    var allowed = canUseMockFallback(ctx);
    var why;
    if (env === "production") {
      why = "production: mock fallback is always disabled";
    } else if (env === "development") {
      why = allowed
        ? "development: mock fallback explicitly enabled"
        : "development: mock fallback not enabled (set SNA3TI_ALLOW_MOCK_FALLBACK=true)";
    } else {
      why = "environment '" + env + "': mock fallback disabled";
    }
    return { env: env, allowMock: allowMock(ctx), canFallback: allowed, reason: why };
  }

  /** Fetch the default context (window in browser, process.env in Node). */
  function gateFromContext() {
    if (typeof window !== "undefined") return window;
    if (typeof process !== "undefined" && process.env) return process.env;
    return {};
  }

  return {
    effectiveEnv: effectiveEnv,
    canUseMockFallback: canUseMockFallback,
    reasoning: reasoning,
    gateFromContext: gateFromContext
  };
});
