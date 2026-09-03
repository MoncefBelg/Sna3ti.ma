// REQ 52 — Professionals admin-API regression tests.
// Verifies the admin professional endpoints the frontend now uses as the
// source of truth (GET /admin/professionals, :id, PATCH, suspend, activate):
//   - successful list / detail reads (opaque string IDs preserved verbatim)
//   - successful EMPTY list ("[]") is an empty state, never an error
//   - missing / invalid JWT -> 401
//   - authorized role -> 200, unauthorized role -> 403 (RBAC)
//   - mutations (update / suspend / activate) succeed and write audit logs
//
// Runs against the in-memory DB (no PostgreSQL required in CI), mirroring the
// REQ 56 e2e harness.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const jwt = require("jsonwebtoken");
const { createInMemoryDb } = require("./inMemoryDb");
const { createApp } = require("../src/app");
const env = require("../src/config/env");

function request(server, method, path, body, token) {
  return new Promise((resolve, reject) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    let payload = null;
    if (body !== undefined && body !== null) {
      payload = JSON.stringify(body);
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    const opts = { method, hostname: "127.0.0.1", port: server.address().port, path: "/api/v1" + path, headers };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || "{}") }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function makeToken(admin) {
  return jwt.sign({ sub: admin.id, role: admin.role, name: admin.name }, env.jwtSecret, { expiresIn: "1h" });
}

const ROLES = {
  admin:     { id: "a-ad", role: "admin",        name: "Admin" },
  super_admin:{ id: "a-sa", role: "super_admin", name: "Super Admin" },
  finance:   { id: "a-fi", role: "finance",      name: "Finance" }
};

function baseSeed(extraPros) {
  const seed = {
    adminUser: [
      { id: "admin-1", name: "Super Admin", email: "sa@sna3ti.ma", role: "super_admin", status: "active", createdAt: new Date() },
      { id: "a-ad",    name: "Admin",       email: "admin@sna3ti.ma", role: "admin", status: "active", createdAt: new Date() },
      { id: "a-fi",    name: "Finance",     email: "finance@sna3ti.ma", role: "finance", status: "active", createdAt: new Date() }
    ],
    role: [{ id: "ROLE-SA", code: "super_admin", name: "Super Admin" }],
    plan: [
      { id: "PLAN-FREE", code: "free",     name: "Free",    price: 0,   active: true },
      { id: "PLAN-VER",  code: "verified", name: "Vérifié", price: 99,  active: true },
      { id: "PLAN-GOLD", code: "gold",     name: "Gold",    price: 199, active: true }
    ],
    category: [{ id: "CAT-1", code: "plombier", label: "Plombier", icon: "🔧", active: true }],
    region: [{ id: "REG-1", name: "Casablanca-Settat", order: 1 }],
    professional: extraPros || [],
    user: [],
    verificationRequest: [],
    payment: [],
    subscription: [],
    review: [],
    report: [],
    supportTicket: [],
    notification: [],
    auditLog: []
  };
  return seed;
}

function pro(id, overrides) {
  return Object.assign(
    {
      id, name: "Hassan " + id, categoryId: "CAT-1", city: "Casablanca",
      job: "plombier", status: "active", identityStatus: "pending",
      professionStatus: "pending", verificationStatus: "pending",
      planEligible: false, verified: false, package: "free",
      subscriptionStatus: "none", createdAt: new Date()
    },
    overrides || {}
  );
}

describe("REQ52 admin professionals — reads, RBAC, opaque IDs", () => {
  let app, server;
  before(async () => {
    const db = createInMemoryDb(baseSeed([
      pro("PRO-10295"),
      pro("PRO-AB73X")
    ]));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("admin can list professionals -> 200 with opaque string IDs preserved verbatim", async () => {
    const res = await request(server, "GET", "/admin/professionals", null, makeToken(ROLES.admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const list = res.body.data;
    assert.ok(Array.isArray(list));
    const ids = list.map((p) => p.id);
    assert.ok(ids.includes("PRO-10295"), "PRO-10295 present");
    assert.ok(ids.includes("PRO-AB73X"), "PRO-AB73X present");
    // IDs must remain the exact opaque strings, never coerced to numbers.
    list.forEach((p) => assert.equal(typeof p.id, "string"));
    assert.equal(list.find((p) => p.id === "PRO-10295").id, "PRO-10295");
    assert.equal(list.find((p) => p.id === "PRO-AB73X").id, "PRO-AB73X");
  });

  it("admin can get a single professional by its exact opaque ID", async () => {
    const res = await request(server, "GET", "/admin/professionals/PRO-AB73X", null, makeToken(ROLES.super_admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, "PRO-AB73X");
    assert.equal(res.body.data.status, "active");
  });

  it("missing JWT -> 401, invalid JWT -> 401", async () => {
    const none = await request(server, "GET", "/admin/professionals");
    assert.equal(none.status, 401);
    assert.equal(none.body.error.code, "UNAUTHORIZED");
    const bad = await request(server, "GET", "/admin/professionals", null, "not.a.token");
    assert.equal(bad.status, 401);
  });

  it("authorized role -> 200, unauthorized role (finance, no professionals.view) -> 403", async () => {
    const ok = await request(server, "GET", "/admin/professionals", null, makeToken(ROLES.admin));
    assert.equal(ok.status, 200);
    const forbidden = await request(server, "GET", "/admin/professionals", null, makeToken(ROLES.finance));
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, "FORBIDDEN");
  });

  it("finance cannot edit/suspend professionals either (403)", async () => {
    const upd = await request(server, "PATCH", "/admin/professionals/PRO-10295", { city: "Rabat" }, makeToken(ROLES.finance));
    assert.equal(upd.status, 403);
    const susp = await request(server, "POST", "/admin/professionals/PRO-10295/suspend", { reason: "x" }, makeToken(ROLES.finance));
    assert.equal(susp.status, 403);
  });
});

describe("REQ52 admin professionals — mutations + audit", () => {
  let app, server;
  before(async () => {
    const db = createInMemoryDb(baseSeed([pro("PRO-10295")]));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("update via PATCH /admin/professionals/:id -> 200, persisted", async () => {
    const res = await request(server, "PATCH", "/admin/professionals/PRO-10295", { city: "Tanger", phone: "0600000000" }, makeToken(ROLES.admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.city, "Tanger");
    const get = await request(server, "GET", "/admin/professionals/PRO-10295", null, makeToken(ROLES.admin));
    assert.equal(get.body.data.city, "Tanger");
  });

  it("suspend -> 200 status suspended; activate -> 200 status active", async () => {
    const susp = await request(server, "POST", "/admin/professionals/PRO-10295/suspend", { reason: "Signalement" }, makeToken(ROLES.admin));
    assert.equal(susp.status, 200);
    assert.equal(susp.body.data.status, "suspended");

    const act = await request(server, "POST", "/admin/professionals/PRO-10295/activate", {}, makeToken(ROLES.admin));
    assert.equal(act.status, 200);
    assert.equal(act.body.data.status, "active");
  });

  it("updates/suspend/activate are audit-logged backend-side (not client-only)", async () => {
    const audit = await request(server, "GET", "/admin/audit-logs", null, makeToken(ROLES.super_admin));
    assert.equal(audit.status, 200);
    const actions = audit.body.data.map((a) => a.action);
    for (const expected of ["UPDATE_PROFESSIONAL", "PROFESSIONAL_SUSPENDED", "PROFESSIONAL_ACTIVATED"]) {
      assert.ok(actions.includes(expected), "audit includes " + expected);
    }
  });
});

describe("REQ52 admin professionals — successful EMPTY list is an empty state, not an error", () => {
  let app, server;
  before(async () => {
    // No professionals seeded at all.
    const db = createInMemoryDb(baseSeed([]));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("GET /admin/professionals with zero records -> 200 [] (empty, not error)", async () => {
    const res = await request(server, "GET", "/admin/professionals", null, makeToken(ROLES.admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 0);
    // Must NOT be reported as an offense/error envelope.
    assert.equal(res.body.error, undefined);
  });
});
