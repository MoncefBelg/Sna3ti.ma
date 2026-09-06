// Phase 3 — Public Customer Authentication.
// Tests the backend authentication contract preserved for the public PWA.
//   POST /auth/register -> { success, token, refreshToken, user } (201)
//   POST /auth/login    -> { success, token, refreshToken, user }
//   GET  /auth/me       -> { success, data: user }
//   POST /auth/refresh  -> { success, token, user }
//   POST /auth/logout   -> { success:true }
// Plus RBAC-no-escalation + the authenticated customer review flow.
// Uses InMemoryDb (no PostgreSQL).

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
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

const NOW = Date.now();

function buildSeed() {
  return {
    adminUser: [{ id: "admin-1", name: "Super Admin", email: "sa@sna3ti.ma", role: "super_admin", status: "active" }],
    role: [{ id: "ROLE-SA", code: "super_admin", name: "Super Admin" }],
    user: [
      // Pre-existing eligible customer (reused by the review tests).
      { id: "USR-1", name: "Client Existant", firstName: "A", lastName: "B", email: "eloi@sna3ti.ma", phone: "+212600000001", role: "user", status: "active", passwordHash: bcrypt.hashSync("Sna3ti@2026", 4), createdAt: new Date(NOW - 30 * 86400000), lastLoginAt: null }
    ],
    professional: [
      { id: "PRO-10295", name: "Ahmed Tazi", job: "Plombier", city: "Casablanca", status: "active", verified: false, rating: null, reviewsCount: 0 },
      { id: "PRO-NOCONTACT", name: "Sans Contact", job: "Peintre", city: "Rabat", status: "active", verified: false, rating: null, reviewsCount: 0 }
    ],
    professionalContactInteraction: [
      {
        id: "INT-ELIG", customerId: "USR-1", professionalId: "PRO-10295",
        channel: "WHATSAPP", source: "PROFILE", status: "CONFIRMED_CONTACT",
        customerConfirmed: true, customerConfirmedAt: new Date(NOW - 50000),
        reviewEligibleAt: new Date(NOW - 1000), riskScore: 0, riskFlags: [],
        lastContactAt: new Date(NOW - 50000), createdAt: new Date(NOW - 50000), updatedAt: new Date(NOW - 1000)
      }
    ],
    review: [],
    plan: [], category: [], region: [],
    payment: [], subscription: [], verificationRequest: [], matchRequest: [], report: [],
    supportTicket: [], notification: [], analyticsEvent: [], auditLog: [], legalDocument: []
  };
}

before(async () => {
  app = createApp({ db: createInMemoryDb(buildSeed()) });
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
});

after(() => { server.close(); });

describe("POST /auth/register (public customer)", () => {
  it("creates a customer with opaque USR id, role=user, tokens, no password hash", async () => {
    const res = await request("POST", "/auth/register", {
      firstName: "Noura", lastName: "Benali", email: "noura@sna3ti.ma",
      phone: "+212600000010", password: "Sna3ti@2026"
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.match(res.body.user.id, /^USR-\d+$/);
    assert.equal(res.body.user.role, "user");
    assert.equal(res.body.user.status, "active");
    assert.equal(res.body.user.name, "Noura Benali");
    assert.ok(res.body.token, "access token present");
    assert.ok(res.body.refreshToken, "refresh token present");
    assert.ok(!JSON.stringify(res.body).includes("passwordHash"), "no password leak");
  });

  it("never accepts a privileged role from client input (RBAC no escalation)", async () => {
    const res = await request("POST", "/auth/register", {
      firstName: "X", lastName: "Y", email: "escalate@sna3ti.ma",
      phone: "+212600000011", password: "Sna3ti@2026",
      role: "super_admin", permissions: ["*"], isAdmin: true
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "user");
  });

  it("rejects a duplicate phone with 409", async () => {
    const res = await request("POST", "/auth/register", {
      firstName: "A", lastName: "B", phone: "+212600000001", password: "Sna3ti@2026"
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await request("POST", "/auth/register", {
      firstName: "C", lastName: "D", email: "eloi@sna3ti.ma", phone: "+212600000012", password: "Sna3ti@2026"
    });
    assert.equal(res.status, 409);
  });

  it("rejects a too-short password with 400", async () => {
    const res = await request("POST", "/auth/register", {
      firstName: "E", lastName: "F", email: "short@sna3ti.ma", phone: "+212600000013", password: "short"
    });
    assert.equal(res.status, 400);
  });
});

describe("POST /auth/login (public customer)", () => {
  it("authenticates with valid email/password and returns the session", async () => {
    const res = await request("POST", "/auth/login", { email: "eloi@sna3ti.ma", password: "Sna3ti@2026" });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.ok(res.body.refreshToken);
    assert.equal(res.body.user.id, "USR-1");
    assert.equal(res.body.user.role, "user");
  });
  it("rejects wrong password with 401", async () => {
    const res = await request("POST", "/auth/login", { email: "eloi@sna3ti.ma", password: "nope" });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });
  it("rejects a missing account with 401 (no account enumeration)", async () => {
    const res = await request("POST", "/auth/login", { email: "absent@sna3ti.ma", password: "Sna3ti@2026" });
    assert.equal(res.status, 401);
  });
});

describe("GET /auth/me", () => {
  it("resolves the authenticated customer from a Bearer JWT", async () => {
    const tok = jwt.sign({ sub: "USR-1", role: "user" }, env.jwtSecret, { expiresIn: "1h" });
    const res = await request("GET", "/auth/me", null, tok);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, "USR-1");
    assert.equal(res.body.data.role, "user");
    assert.equal(res.body.data.email, "eloi@sna3ti.ma");
    assert.ok(!JSON.stringify(res.body).includes("passwordHash"));
  });
  it("returns 401 without a token", async () => {
    const res = await request("GET", "/auth/me");
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });
  it("returns 401 with an invalid/expired token", async () => {
    const res = await request("GET", "/auth/me", null, "not.a.jwt");
    assert.equal(res.status, 401);
  });
});

describe("POST /auth/refresh + logout", () => {
  it("issues a fresh access token from a valid refresh token", async () => {
    const login = await request("POST", "/auth/login", { email: "eloi@sna3ti.ma", password: "Sna3ti@2026" });
    const res = await request("POST", "/auth/refresh", { refreshToken: login.body.refreshToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.id, "USR-1");
  });
  it("rejects an invalid/expired refresh token with 401", async () => {
    const res = await request("POST", "/auth/refresh", { refreshToken: "garbage" });
    assert.equal(res.status, 401);
  });
  it("rejects an access token used as a refresh token (kind guard)", async () => {
    const login = await request("POST", "/auth/login", { email: "eloi@sna3ti.ma", password: "Sna3ti@2026" });
    const res = await request("POST", "/auth/refresh", { refreshToken: login.body.token });
    assert.equal(res.status, 401);
  });
  it("logout succeeds (stateless) and the session is cleared client-side by adapter contract", async () => {
    const login = await request("POST", "/auth/login", { email: "eloi@sna3ti.ma", password: "Sna3ti@2026" });
    const res = await request("POST", "/auth/logout", { token: login.body.token }, login.body.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});

describe("Reviewed customer session cannot escalate", () => {
  it("a customer Bearer token cannot reach /admin routes", async () => {
    const tok = jwt.sign({ sub: "USR-1", role: "user" }, env.jwtSecret, { expiresIn: "1h" });
    const res = await request("GET", "/admin/professionals", null, tok);
    assert.equal(res.status, 403);
  });
});

describe("Reviews integration with the authenticated customer session", () => {
  it("anonymous POST review -> 401", async () => {
    const res = await request("POST", "/professionals/PRO-10295/reviews", { rating: 5, comment: "Avis" });
    assert.equal(res.status, 401);
  });
  it("authenticated + eligible customer -> 201 published", async () => {
    const tok = jwt.sign({ sub: "USR-1", role: "user" }, env.jwtSecret, { expiresIn: "1h" });
    const res = await request("POST", "/professionals/PRO-10295/reviews", { rating: 5, comment: "Travail impeccable" }, tok);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.verifiedContact, true);
  });
  it("authenticated but no contact -> 403 eligibility", async () => {
    const tok = jwt.sign({ sub: "USR-1", role: "user" }, env.jwtSecret, { expiresIn: "1h" });
    const res = await request("POST", "/professionals/PRO-NOCONTACT/reviews", { rating: 4, comment: "Avis" }, tok);
    assert.equal(res.status, 403);
  });
  it("duplicate review -> 409", async () => {
    const tok = jwt.sign({ sub: "USR-1", role: "user" }, env.jwtSecret, { expiresIn: "1h" });
    const res = await request("POST", "/professionals/PRO-10295/reviews", { rating: 3, comment: "Doublon" }, tok);
    assert.equal(res.status, 409);
  });
});