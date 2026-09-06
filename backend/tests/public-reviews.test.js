// Phase 2 — Public Professional Reviews.
// Covers the public review contract consumed by js/public-reviews.js:
//   GET  /professionals/:id/reviews  (public, published-only, envelope data.data)
//   POST /professionals/:id/reviews  (auth + eligibility + duplicate + validation)
// Uses InMemoryDb (no PostgreSQL). Mirrors interactions.test.js seed shapes.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const jwt = require("jsonwebtoken");
const { createInMemoryDb } = require("./inMemoryDb");
const { createApp } = require("../src/app");
const env = require("../src/config/env");

let app, server;

function request(method, pathname, body, token) {
  return new Promise((resolve, reject) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    let payload = null;
    if (body !== undefined && body !== null) {
      payload = JSON.stringify(body);
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    const opts = { method, hostname: "127.0.0.1", port: server.address().port, path: "/api/v1" + pathname, headers };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        try { resolve({ status: res.statusCode, body: JSON.parse(buf.toString("utf8") || "{}") }); }
        catch { resolve({ status: res.statusCode, body: buf.toString("utf8") }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function tokenFor(actor) {
  return jwt.sign({ sub: actor.id, role: actor.role, name: actor.name }, env.jwtSecret, { expiresIn: "1h" });
}

const NOW = Date.now();

function buildSeed() {
  return {
    adminUser: [
      { id: "admin-1", name: "Super Admin", email: "a@sna3ti.ma", role: "super_admin", status: "active", createdAt: new Date(NOW - 86400000) }
    ],
    role: [{ id: "ROLE-SA", code: "super_admin", name: "Super Admin" }],
    user: [
      // OLD accounts (past the 48h new-account risk window).
      { id: "USR-1", name: "Client A", firstName: "A", phone: "+212600000001", role: "user", status: "active", createdAt: new Date(NOW - 30 * 86400000) },
      { id: "USR-2", name: "Client B", firstName: "B", phone: "+212600000002", role: "user", status: "active", createdAt: new Date(NOW - 30 * 86400000) }
    ],
    professional: [
      { id: "PRO-10295", name: "Ahmed Tazi", job: "Plombier", city: "Casablanca", status: "active", verified: false, rating: null, reviewsCount: 0 },
      { id: "PRO-NOREV", name: "Zero Avis", job: "Peintre", city: "Rabat", status: "active", verified: false, rating: null, reviewsCount: 0 }
    ],
    professionalContactInteraction: [
      // Already-eligible: confirmed + cooldown elapsed (review gate PASS).
      {
        id: "INT-ELIG", customerId: "USR-2", professionalId: "PRO-10295",
        channel: "WHATSAPP", source: "PROFILE", status: "CONFIRMED_CONTACT",
        customerConfirmed: true, customerConfirmedAt: new Date(NOW - 50000),
        reviewEligibleAt: new Date(NOW - 1000), riskScore: 0, riskFlags: [],
        lastContactAt: new Date(NOW - 50000), createdAt: new Date(NOW - 50000), updatedAt: new Date(NOW - 1000)
      }
    ],
    review: [
      { id: "RV-1", professionalId: "PRO-10295", userId: "USR-1", customer: "Client A", rating: 5, comment: "Excellent plombier", status: "published", verifiedContact: true, date: new Date(NOW - 5000), createdAt: new Date(NOW - 5000) },
      { id: "RV-2", professionalId: "PRO-10295", userId: "USR-1", customer: "Client A", rating: 3, comment: "Avis en modération", status: "flagged", verifiedContact: true, date: new Date(NOW - 4000), createdAt: new Date(NOW - 4000) },
      { id: "RV-3", professionalId: "PRO-10295", userId: "USR-1", customer: "Client A", rating: 4, comment: "Cache une fois modéré", status: "hidden", verifiedContact: true, date: new Date(NOW - 3000), createdAt: new Date(NOW - 3000) }
    ],
    plan: [], category: [], region: [],
    payment: [], subscription: [], verificationRequest: [], matchRequest: [], report: [], supportTicket: [],
    notification: [], analyticsEvent: [], auditLog: [], legalDocument: []
  };
}

before(async () => {
  app = createApp({ db: createInMemoryDb(buildSeed()) });
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
});

after(() => { server.close(); });

describe("GET /api/v1/professionals/:id/reviews (public listing)", () => {
  it("is reachable anonymously (no auth token needed)", async () => {
    const res = await request("GET", "/professionals/PRO-10295/reviews");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it("returns published reviews inside data.data, sorted as the backend returns", async () => {
    const res = await request("GET", "/professionals/PRO-10295/reviews");
    assert.ok(Array.isArray(res.body.data.data), "reviews live under data.data");
    assert.equal(res.body.data.data.length, 1, "only the published review is public");
    assert.equal(res.body.data.data[0].id, "RV-1");
    assert.equal(res.body.data.data[0].professionalId, "PRO-10295");
    assert.equal(res.body.data.data[0].customer, "Client A");
    assert.equal(res.body.data.data[0].rating, 5);
    assert.equal(res.body.data.data[0].comment, "Excellent plombier");
    assert.equal(res.body.data.meta.total, 1);
    assert.equal(res.body.data.meta.average, 5);
  });

  it("excludes pending/flagged/hidden reviews (published only)", async () => {
    const res = await request("GET", "/professionals/PRO-10295/reviews");
    const ids = res.body.data.data.map((r) => r.id);
    assert.equal(ids.includes("RV-2"), false, "flagged not public");
    assert.equal(ids.includes("RV-3"), false, "hidden not public");
  });

  it("returns an empty (successful) result for a professional with no reviews", async () => {
    const res = await request("GET", "/professionals/PRO-NOREV/reviews");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.data));
    assert.equal(res.body.data.data.length, 0);
    assert.equal(res.body.data.meta.total, 0);
    assert.equal(res.body.data.meta.average, 0);
  });

  it("returns 404 for an unknown professional", async () => {
    const res = await request("GET", "/professionals/PRO-MISSING/reviews");
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });
});

describe("POST /api/v1/professionals/:id/reviews (creation)", () => {
  it("rejects unauthenticated submission with 401", async () => {
    const res = await request("POST", "/professionals/PRO-10295/reviews", { rating: 5, comment: "Bien" });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it("rejects a valid but INELIGIBLE customer (no confirmed contact) with 403", async () => {
    const tok = tokenFor({ id: "USR-1", role: "user", name: "Client A" });
    const res = await request("POST", "/professionals/PRO-NOREV/reviews", { rating: 5, comment: "Avis" }, tok);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it("rejects invalid rating/data with a validation error (400)", async () => {
    const tok = tokenFor({ id: "USR-2", role: "user", name: "Client B" });
    const res = await request("POST", "/professionals/PRO-10295/reviews", { rating: 9, comment: "Note invalide" }, tok);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it("creates a published review for an eligible, authenticated customer", async () => {
    const tok = tokenFor({ id: "USR-2", role: "user", name: "Client B" });
    const res = await request("POST", "/professionals/PRO-10295/reviews", { rating: 4, comment: "Très bon travail" }, tok);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.id, "review id returned in data.id");
    assert.equal(res.body.data.professionalId, "PRO-10295");
    assert.equal(res.body.data.rating, 4);
    assert.equal(res.body.data.verifiedContact, true);
  });

  it("rejects a duplicate review by the same customer with 409", async () => {
    const tok = tokenFor({ id: "USR-2", role: "user", name: "Client B" });
    const again = await request("POST", "/professionals/PRO-10295/reviews", { rating: 2, comment: "Second essai" }, tok);
    assert.equal(again.status, 409);
    assert.equal(again.body.success, false);
  });

  it("rejects an admin account (only platform customers can review)", async () => {
    const tok = tokenFor({ id: "admin-1", role: "super_admin", name: "Super Admin" });
    const res = await request("POST", "/professionals/PRO-10295/reviews", { rating: 5, comment: "Admin" }, tok);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });
});