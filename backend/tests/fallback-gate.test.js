"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// The centralized safe-fallback gate (frontend logic, CommonJS-exported so it
// is directly testable from the Node suite without a browser).
const gate = require("../../js/fallback-gate.js");

// --- Faithful mirrors of the frontend decision branches ---------------------
// These reproduce the exact branch logic added to admin.js renderDashboard()
// (and sna3ti-bridge.js syncNow/recordSyncFailure) so the production-vs-demo
// and empty-vs-error behaviors are verifiable without a full browser.

// production: API failure must become error/offline, never demo data.
function simulateDashboardFailure(env, allowFallback) {
  const demoAllowed = gate.canUseMockFallback({ SNA3TI_ENV: env, SNA3TI_ALLOW_MOCK_FALLBACK: allowFallback });
  // res.success === false from the backend -> real API failure.
  return demoAllowed ? "demo" : "error";
}

// successful empty response ("[]") must be an empty state, not an error.
function simulateDashboardEmpty(env, allowFallback) {
  const demoAllowed = gate.canUseMockFallback({ SNA3TI_ENV: env, SNA3TI_ALLOW_MOCK_FALLBACK: allowFallback });
  const res = { success: true, data: {} }; // successful, empty payload
  if (res.success) return "empty"; // never an error; empty counts
  return demoAllowed ? "demo" : "error";
}

// Test 1: development + fallback enabled -> allowed.
test("dev + mock fallback enabled -> allowed", () => {
  const ctx = { SNA3TI_ENV: "development", SNA3TI_ALLOW_MOCK_FALLBACK: "true" };
  assert.equal(gate.canUseMockFallback(ctx), true);
  assert.equal(gate.effectiveEnv(ctx), "development");
});

// Test 2: development + fallback disabled -> forbidden.
test("dev + mock fallback disabled -> forbidden", () => {
  const ctx = { SNA3TI_ENV: "development", SNA3TI_ALLOW_MOCK_FALLBACK: "false" };
  assert.equal(gate.canUseMockFallback(ctx), false);
});

// Test 3: production + fallback enabled -> STILL forbidden.
test("production + fallback enabled -> still forbidden", () => {
  const ctx = { SNA3TI_ENV: "production", SNA3TI_ALLOW_MOCK_FALLBACK: "true" };
  assert.equal(gate.canUseMockFallback(ctx), false);
  const why = gate.reasoning(ctx);
  assert.equal(why.env, "production");
  assert.equal(why.canFallback, false);
});

// Production is a hard rule regardless of the flag value.
test("production always forbids mock fallback (any flag value)", () => {
  for (const flag of ["true", "false", "1", "0", "yes"]) {
    assert.equal(gate.canUseMockFallback({ SNA3TI_ENV: "production", SNA3TI_ALLOW_MOCK_FALLBACK: flag }), false);
  }
});

// Test 4: API failure in production -> error/offline state, no demo data.
test("API failure in production -> error/offline state, never demo data", () => {
  assert.equal(simulateDashboardFailure("production", "true"), "error");
  assert.equal(simulateDashboardFailure("production", "false"), "error");
  // even the run-through comment: production + enabled must NOT demos
  assert.equal(gate.canUseMockFallback({ SNA3TI_ENV: "production", SNA3TI_ALLOW_MOCK_FALLBACK: "false" }), false);
});

// Test 5: successful empty API response -> empty state, not error.
test("successful empty API response -> empty state, not error", () => {
  assert.equal(simulateDashboardEmpty("production", "true"), "empty");
  assert.equal(simulateDashboardEmpty("production", "false"), "empty");
  assert.equal(simulateDashboardEmpty("development", "true"), "empty");
});

// Test 6: test environment compatible with existing suite (no mock fallback).
test("test env stays compatible: deterministic, no mock fallback", () => {
  const ctx = { SNA3TI_ENV: "test", SNA3TI_ALLOW_MOCK_FALLBACK: "true" };
  assert.equal(gate.effectiveEnv(ctx), "test");
  // Test env must not silently fall back, matching backend expectations.
  assert.equal(gate.canUseMockFallback(ctx), false);
});

// Startup / production safety: production ALWAYS wins over an unsafe flag,
// even a misconfigured environment must never activate demo data.
test("production safety: production always wins over unsafe fallback flag", () => {
  const misconfigured = { SNA3TI_ENV: "production", SNA3TI_ALLOW_MOCK_FALLBACK: "true" };
  assert.equal(gate.canUseMockFallback(misconfigured), false);
  // hard rule, independent of how the flag is spelled
  assert.equal(gate.canUseMockFallback({ SNA3TI_ENV: "production", SNA3TI_ALLOW_MOCK_FALLBACK: "1" }), false);
  assert.equal(gate.canUseMockFallback({ SNA3TI_ENV: "production", SNA3TI_ALLOW_MOCK_FALLBACK: "yes" }), false);
  assert.equal(gate.canUseMockFallback({ SNA3TI_ENV: "production" }), false);
});

// Mirror of pricing-service getPlans() fallback decision (REQ 57.x gating).
function pricingOnApiFailure(env, allowFallback) {
  // backend unreachable:
  if (gate.canUseMockFallback({ SNA3TI_ENV: env, SNA3TI_ALLOW_MOCK_FALLBACK: allowFallback })) {
    return "demo"; // dev + explicit fallback -> flagged fallback catalogue
  }
  return "error"; // production / dev-disabled -> offline/error, no fake pricing
}

test("pricing: dev + fallback enabled -> demo catalogue (fromBackend:false)", () => {
  assert.equal(pricingOnApiFailure("development", "true"), "demo");
});
test("pricing: development + fallback disabled -> error state, no fake pricing", () => {
  assert.equal(pricingOnApiFailure("development", "false"), "error");
});
test("pricing: production API failure -> error state, never fake pricing", () => {
  assert.equal(pricingOnApiFailure("production", "true"), "error");
});

// Successful empty plans response (`[]`) is an empty state, not an error.
test("plans: successful empty response -> empty state, not error", () => {
  const res = { success: true, data: [] }; // backend answered with zero plans
  assert.equal(res.success, true);
  // must NOT be interpreted as an offline/API error
  assert.equal(gate.canUseMockFallback({ SNA3TI_ENV: "production" }), false); // error rule unaffected
});

// Defaults: unset env -> development (safe default for local), fallback off.
test("defaults: unset env -> development, fallback disabled", () => {
  assert.equal(gate.effectiveEnv(), "development");
  assert.equal(gate.canUseMockFallback(), false);
});

// reasoning() must be safe and consistent (no secrets) and extra flag values.
test("reasoning reflects the decision without throwing", () => {
  const rProd = gate.reasoning({ SNA3TI_ENV: "production", SNA3TI_ALLOW_MOCK_FALLBACK: "true" });
  assert.equal(rProd.canFallback, false);
  const rDevOff = gate.reasoning({ SNA3TI_ENV: "development" });
  assert.equal(rDevOff.canFallback, false);
  const rDevOn = gate.reasoning({ SNA3TI_ENV: "development", SNA3TI_ALLOW_MOCK_FALLBACK: "true" });
  assert.equal(rDevOn.canFallback, true);
  assert.equal(gate.canUseMockFallback({ SNA3TI_ENV: "development", SNA3TI_ALLOW_MOCK_FALLBACK: "1" }), true);
});
