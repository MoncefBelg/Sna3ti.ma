// Verifications + admin integration regression tests (REQ 52).
//
// Covers:
//   1.    RBAC: unauthenticated -> 401; finance (no verification.*) -> 403;
//         super_admin/moderator -> 200 on the admin list
//   2.    Admin list returns real requests (status filter + pagination) and
//         preserves opaque IDs verbatim (no parseInt/Number coercion)
//   3.    Empty dataset -> HTTP 200 with [] (EMPTY state, not an error, no mock)
//   4.    Approve identity verification -> verificationStatus=approved + verified,
//         subscription UNTOUCHED (business separation), audit VERIFICATION_APPROVED
//   5.    Approve an already-approved request -> 409
//   6.    Reject professionnel -> reason persisted + history appended, audit
//         VERIFICATION_REJECTED
//   7.    requestInfo -> needs_info + infoRequested persisted, audit
//         VERIFICATION_INFO_REQUESTED
//   8.    Business separation: identity approve NEVER activates a subscription;
//         payment confirm DOES activate the plan subscription + commercial badge
//         WITHOUT requiring identity approval
//
// Runs against the in-memory DB (no PostgreSQL required in CI).

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
  finance:     { id: "a-fi", role: "finance",     name: "Finance" },
  super_admin: { id: "a-sa", role: "super_admin", name: "Super Admin" },
  moderator:   { id: "a-mo", role: "moderator",   name: "Moderator" }
};

function pro(id, overrides) {
  return Object.assign({
    id, name: "Hassan " + id, categoryId: "CAT-1", city: "Casablanca",
    job: "plombier", status: "active", identityStatus: "pending",
    professionStatus: "pending", verificationStatus: "pending",
    planEligible: false, verified: false, package: "free",
    subscriptionStatus: "none", createdAt: new Date()
  }, overrides || {});
}

function plan(id, overrides) {
  return Object.assign({
    id, code: id === "PLAN-FREE" ? "free" : id === "PLAN-VER" ? "verified" : "gold",
    name: id === "PLAN-FREE" ? "Free" : id === "PLAN-VER" ? "Vérifié" : "Gold",
    price: id === "PLAN-FREE" ? 0 : id === "PLAN-VER" ? 99 : 199,
    currency: "MAD", active: true
  }, overrides || {});
}

function baseSeed(overrides = {}) {
  return {
    adminUser: [
      { id: "a-sa", name: "Super Admin", email: "sa@sna3ti.ma",    role: "super_admin", status: "active", createdAt: new Date() },
      { id: "a-fi", name: "Finance",     email: "finance@sna3ti.ma", role: "finance",   status: "active", createdAt: new Date() },
      { id: "a-mo", name: "Moderator",   email: "mod@sna3ti.ma",    role: "moderator", status: "active", createdAt: new Date() }
    ],
    role: [{ id: "ROLE-SA", code: "super_admin", name: "Super Admin" }],
    plan: [
      plan("PLAN-FREE"),
      plan("PLAN-VER"),
      plan("PLAN-GOLD")
    ],
    category: [{ id: "CAT-1", code: "plombier", label: "Plombier", icon: "🔧", active: true }],
    region: [{ id: "REG-1", name: "Casablanca-Settat", order: 1 }],
    professional: overrides.professionals || [pro("PRO-8001")],
    user: [],
    verificationRequest: overrides.verificationRequest || [],
    payment: overrides.payment || [],
    subscription: overrides.subscription || [],
    review: [], report: [], supportTicket: [],
    notification: overrides.notification || [],
    auditLog: overrides.auditLog || []
  };
}

function vr(id, proId, overrides) {
  return Object.assign({
    id, professionalId: proId, level: "identity", status: "pending",
    priority: "medium", submitted: new Date(),
    history: [{ date: new Date().toISOString(), text: "Demande créée" }],
    createdAt: new Date()
  }, overrides || {});
}

async function hasAudit(server, token, action) {
  const res = await request(server, "GET", "/admin/audit-logs", null, token);
  assert.equal(res.status, 200);
  const list = Array.isArray(res.body.data) ? res.body.data : (res.body.data && res.body.data.data) || [];
  return list.some((a) => a.action === action);
}

async function adminVerifications(server, token) {
  const res = await request(server, "GET", "/admin/verifications", null, token);
  assert.equal(res.status, 200);
  return res.body.data;
}

// ─── 1. RBAC on the admin list ───────────────────────────────────────────────

describe("Admin verifications — RBAC + empty/list shape (source of truth)", () => {
  let app, server;
  before(async () => {
    const db = createInMemoryDb(baseSeed({
      verificationRequest: [
        vr("VER-10294", "PRO-8001", { level: "identity", status: "pending" }),
        vr("VER-10295", "PRO-8001", { level: "professionnel", status: "approved", reviewerName: "Super Admin", reviewedAt: new Date() }),
        vr("VER-10296", "PRO-8001", { level: "join", status: "needs_info" })
      ]
    }));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("unauthenticated -> 401", async () => {
    const res = await request(server, "GET", "/admin/verifications");
    assert.equal(res.status, 401);
  });

  it("finance (lacks verification.*) -> 403", async () => {
    const res = await request(server, "GET", "/admin/verifications", null, makeToken(ROLES.finance));
    assert.equal(res.status, 403);
  });

  it("super_admin -> 200, returns real requests with opaque IDs preserved", async () => {
    const data = await adminVerifications(server, makeToken(ROLES.super_admin));
    const list = Array.isArray(data) ? data : data.data;
    assert.ok(Array.isArray(list) && list.length >= 3, "returns seeded requests");
    const ids = list.map((x) => x.id);
    assert.ok(ids.includes("VER-10294") && ids.includes("VER-10295") && ids.includes("VER-10296"),
      "opaque IDs pass through verbatim: " + ids.join(","));
    list.forEach((x) => assert.equal(x.id, String(x.id), "id not coerced to number"));
  });

  it("admin list supports status filter + pagination wrapper", async () => {
    const res = await request(server, "GET", "/admin/verifications?status=pending", null, makeToken(ROLES.moderator));
    assert.equal(res.status, 200);
    const list = Array.isArray(res.body.data) ? res.body.data : res.body.data.data;
    assert.ok(Array.isArray(list));
    list.forEach((x) => assert.equal(x.status, "pending"));
    const pag = res.body.pagination;
    if (Array.isArray(res.body.data)) {
      assert.ok(true); // flat list shape is acceptable
    } else {
      assert.ok(pag && typeof pag.total === "number", "pagination present");
    }
  });

  it("status filter reflects real backend state", async () => {
    const data = await adminVerifications(server, makeToken(ROLES.super_admin));
    const list = Array.isArray(data) ? data : data.data;
    assert.ok(list.some((x) => x.id === "VER-10295" && x.status === "approved"), "approved request surfaces");
  });
});

// ─── 2. Empty state (no mock fallback) ───────────────────────────────────────

describe("Admin verifications — empty dataset is an EMPTY 200 state", () => {
  let app, server;
  before(async () => {
    const db = createInMemoryDb(baseSeed({}));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("no requests -> 200 [] (empty, not error, not demo)", async () => {
    const res = await request(server, "GET", "/admin/verifications", null, makeToken(ROLES.super_admin));
    assert.equal(res.status, 200);
    const data = Array.isArray(res.body.data) ? res.body.data : res.body.data.data;
    assert.ok(Array.isArray(data) && data.length === 0, "empty array is a valid empty state");
  });
});

// ─── 3. Approve / reject / request-info lifecycle + audit ────────────────────

describe("Verifications — approve/reject/request-info mutate state + audit", () => {
  let app, server;
  before(async () => {
    const db = createInMemoryDb(baseSeed({
      verificationRequest: [
        vr("VER-10294", "PRO-8001", { level: "identity", status: "pending" }),
        vr("VER-10295", "PRO-8001", { level: "professionnel", status: "pending" }),
        vr("VER-10296", "PRO-8001", { level: "identity", status: "pending" })
      ]
    }));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("reject professionnel -> reason persisted + history appended + audit", async () => {
    const token = makeToken(ROLES.super_admin);
    const res = await request(server, "POST", "/verifications/VER-10295/reject", { reason: "Preuves insuffisantes" }, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "rejected");
    assert.equal(res.body.data.reason, "Preuves insuffisantes");
    const texts = res.body.data.history.map((h) => h.text);
    assert.ok(texts.some((t) => t.includes("Rejetée")), "history records the rejection");
    assert.ok(await hasAudit(server, token, "VERIFICATION_REJECTED"));
  });

  it("reject requires a reason (400)", async () => {
    const res = await request(server, "POST", "/verifications/VER-10295/reject", {}, makeToken(ROLES.super_admin));
    assert.equal(res.status, 400);
  });

  it("requestInfo -> needs_info + infoRequested persisted + audit", async () => {
    const token = makeToken(ROLES.super_admin);
    const res = await request(server, "POST", "/verifications/VER-10296/request-information", { note: "Merci de fournir un extrait du registre." }, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "needs_info");
    assert.equal(res.body.data.infoRequested, "Merci de fournir un extrait du registre.");
    assert.ok(await hasAudit(server, token, "VERIFICATION_INFO_REQUESTED"));
  });

  it("approve identity -> verificationStatus approved + verified, subscription UNTOUCHED", async () => {
    const token = makeToken(ROLES.super_admin);
    const res = await request(server, "POST", "/verifications/VER-10294/approve", {}, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "approved");

    const pRes = await request(server, "GET", "/admin/professionals/PRO-8001", null, token);
    assert.equal(pRes.body.data.verificationStatus, "approved");
    assert.equal(pRes.body.data.verified, true);
    // Business separation: identity approval must NOT create/activate a subscription.
    const subs = await request(server, "GET", "/admin/subscriptions", null, token);
    const subList = Array.isArray(subs.body.data) ? subs.body.data : (subs.body.data && subs.body.data.data) || [];
    assert.equal(subList.length, 0, "identity approve leaves subscriptions untouched");
    assert.ok(await hasAudit(server, token, "VERIFICATION_APPROVED"));
  });

  it("approve an already-approved request -> 409", async () => {
    const res = await request(server, "POST", "/verifications/VER-10294/approve", {}, makeToken(ROLES.super_admin));
    assert.equal(res.status, 409);
  });
});

// ─── 4. Business separation: identity vs paid-subscription activation ───────

describe("Verifications — separation: identity approve never activates; payment confirm does", () => {
  let app, server;
  before(async () => {
    const db = createInMemoryDb(baseSeed({
      // Identity request is still PENDING (not approved).
      verificationRequest: [
        vr("VER-10294", "PRO-8001", { level: "identity", status: "pending" })
      ],
      payment: [{
        id: "PAY-8001", reference: "REF-8001", professionalId: "PRO-8001",
        planName: "Vérifié", amount: 99, method: "bank_transfer", status: "pending",
        createdAt: new Date()
      }]
    }));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("payment confirm activates plan subscription + commercial package WITHOUT identity approval", async () => {
    const token = makeToken(ROLES.finance);
    const conf = await request(server, "POST", "/admin/payments/PAY-8001/confirm", {}, token);
    assert.equal(conf.status, 200);

    const pRes = await request(server, "GET", "/admin/professionals/PRO-8001", null, makeToken(ROLES.super_admin));
    assert.equal(pRes.body.data.subscriptionStatus, "active");
    assert.equal(pRes.body.data.package, "verified");
    // Independence: the identity verification is STILL pending after payment.
    assert.equal(pRes.body.data.verificationStatus, "pending");
    assert.equal(pRes.body.data.verified, false);
  });
});
