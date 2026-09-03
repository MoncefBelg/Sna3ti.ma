// REQ 52 — Payments admin-API regression tests.
//
// Verifies the Sna3ti payment model (manual bank transfer only) as exposed to
// the admin frontend:
//   - a pending payment is listed with opaque string IDs preserved verbatim
//   - NO private banking information (IBAN, card, CVV, online-banking
//     credentials) is ever collected or exposed
//   - admin confirmation activates the subscription but NEVER grants the
//     verified badge (verificationStatus stays unchanged)
//   - confirmation is idempotent-guarded (a second confirm is rejected, 409)
//   - rejection records the reason
//   - RBAC: finance (payments.*) -> 200; moderator (no payments.*) -> 403
//   - backend audit logs (PAYMENT_CONFIRMED / PAYMENT_REJECTED)
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
  finance:   { id: "a-fi", role: "finance",   name: "Finance" },
  super_admin: { id: "a-sa", role: "super_admin", name: "Super Admin" },
  moderator: { id: "a-mo", role: "moderator", name: "Moderator" }
};

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

function payment(id, overrides) {
  return Object.assign(
    {
      id,
      reference: "REF-" + id,
      professionalId: "PRO-7001",
      planName: "Gold",
      amount: 199,
      method: "bank_transfer",
      status: "pending",
      createdAt: new Date()
    },
    overrides || {}
  );
}

function baseSeed(extraPay) {
  return {
    adminUser: [
      { id: "a-sa", name: "Super Admin", email: "sa@sna3ti.ma", role: "super_admin", status: "active", createdAt: new Date() },
      { id: "a-fi", name: "Finance",     email: "finance@sna3ti.ma", role: "finance", status: "active", createdAt: new Date() },
      { id: "a-mo", name: "Moderator",   email: "mod@sna3ti.ma",    role: "moderator", status: "active", createdAt: new Date() }
    ],
    role: [{ id: "ROLE-SA", code: "super_admin", name: "Super Admin" }],
    plan: [
      { id: "PLAN-FREE", code: "free",     name: "Free",    price: 0,   active: true },
      { id: "PLAN-VER",  code: "verified", name: "Vérifié", price: 99,  active: true },
      { id: "PLAN-GOLD", code: "gold",     name: "Gold",    price: 199, active: true }
    ],
    category: [{ id: "CAT-1", code: "plombier", label: "Plombier", icon: "🔧", active: true }],
    region: [{ id: "REG-1", name: "Casablanca-Settat", order: 1 }],
    professional: [pro("PRO-7001")],
    user: [],
    verificationRequest: [
      { id: "VR-700", paymentId: "PAY-7001", level: "plan", status: "pending", professionalId: "PRO-7001", requestedPlan: "Gold", submitted: new Date() }
    ],
    payment: extraPay ? [extraPay] : [],
    subscription: [],
    review: [],
    report: [],
    supportTicket: [],
    notification: [],
    auditLog: []
  };
}

describe("REQ52 payments — reads, opaque IDs, no banking info, pending state", () => {
  let app, server;
  before(async () => {
    const db = createInMemoryDb(baseSeed(payment("PAY-7001")));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("admin list -> 200, pending payment present, opaque ID preserved, method bank_transfer", async () => {
    const res = await request(server, "GET", "/admin/payments", null, makeToken(ROLES.finance));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const list = res.body.data;
    assert.ok(Array.isArray(list));
    const pay = list.find((x) => x.id === "PAY-7001");
    assert.ok(pay, "pending payment present");
    assert.equal(pay.id, "PAY-7001");
    assert.equal(typeof pay.id, "string");
    assert.equal(pay.status, "pending");
    assert.equal(pay.method, "bank_transfer");
    assert.equal(pay.amount, 199);
  });

  it("NO private banking information is stored or exposed", async () => {
    const res = await request(server, "GET", "/admin/payments", null, makeToken(ROLES.finance));
    const pay = res.body.data.find((x) => x.id === "PAY-7001");
    // Only tracking/proof references (reference, bankRef, receipt) are allowed.
    const obj = JSON.stringify(pay).toLowerCase();
    for (const blocked of ["iban", "cardnumber", "cvv", "bankcredential", "onlinebanking", "accountnumber", "login", "password", "bankinglogin"]) {
      assert.equal(obj.includes(blocked), false, "must not contain " + blocked);
    }
  });

  it("missing/invalid JWT -> 401 on the payments admin list", async () => {
    const none = await request(server, "GET", "/admin/payments");
    assert.equal(none.status, 401);
    const bad = await request(server, "GET", "/admin/payments", null, "not.a.token");
    assert.equal(bad.status, 401);
  });

  it("RBAC: moderator (no payments.*) -> 403; finance (payments.*) -> 200", async () => {
    const ok = await request(server, "GET", "/admin/payments", null, makeToken(ROLES.finance));
    assert.equal(ok.status, 200);
    const forbidden = await request(server, "GET", "/admin/payments", null, makeToken(ROLES.moderator));
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error.code, "FORBIDDEN");
  });

  it("moderator cannot confirm or reject payments (403)", async () => {
    const conf = await request(server, "POST", "/admin/payments/PAY-7001/confirm", {}, makeToken(ROLES.moderator));
    assert.equal(conf.status, 403);
    const rej = await request(server, "POST", "/admin/payments/PAY-7001/reject", { reason: "x" }, makeToken(ROLES.moderator));
    assert.equal(rej.status, 403);
  });
});

describe("REQ52 payments — confirm activates subscription, badge untouched, idempotent, audit", () => {
  let app, server;
  before(async () => {
    const db = createInMemoryDb(baseSeed(payment("PAY-7001")));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("finance confirms a pending payment -> 200 status confirmed", async () => {
    const res = await request(server, "POST", "/admin/payments/PAY-7001/confirm", {}, makeToken(ROLES.finance));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "confirmed");
  });

  it("confirmation activates the subscription (paymentStatus confirmed, package gold)", async () => {
    const subs = await request(server, "GET", "/admin/subscriptions", null, makeToken(ROLES.finance));
    assert.equal(subs.status, 200);
    const arr = Array.isArray(subs.body.data) ? subs.body.data : (subs.body.data && subs.body.data.data) || [];
    const s = arr.find((x) => x.professionalId === "PRO-7001");
    assert.ok(s, "subscription created for the professional");
    assert.equal(s.status, "active");
    assert.equal(s.paymentStatus, "confirmed");
    assert.equal(s.planName, "Gold");
  });

  it("confirmation does NOT grant the verified badge (verificationStatus unchanged)", async () => {
    const pro = await request(server, "GET", "/admin/professionals/PRO-7001", null, makeToken(ROLES.super_admin));
    assert.equal(pro.status, 200);
    // Badge stays pending — payment never grants verification.
    assert.equal(pro.body.data.verificationStatus, "pending");
  });

  it("duplicate/idempotent confirmation -> 409 (not re-processed)", async () => {
    const again = await request(server, "POST", "/admin/payments/PAY-7001/confirm", {}, makeToken(ROLES.finance));
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, "CONFLICT");
  });

  it("audit log PAYMENT_CONFIRMED is written backend-side", async () => {
    const audit = await request(server, "GET", "/admin/audit-logs", null, makeToken(ROLES.super_admin));
    assert.equal(audit.status, 200);
    const actions = audit.body.data.map((a) => a.action);
    assert.ok(actions.includes("PAYMENT_CONFIRMED"), "audit includes PAYMENT_CONFIRMED");
  });
});

describe("REQ52 payments — reject records reason + audit; RBAC on confirm/reject", () => {
  let app, server;
  before(async () => {
    const db = createInMemoryDb(baseSeed(payment("PAY-7002")));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("reject requires a reason and records it -> status rejected", async () => {
    const noReason = await request(server, "POST", "/admin/payments/PAY-7002/reject", {}, makeToken(ROLES.finance));
    assert.equal(noReason.status, 400);

    const res = await request(server, "POST", "/admin/payments/PAY-7002/reject", { reason: "Virement non conforme" }, makeToken(ROLES.finance));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "rejected");
    assert.equal(res.body.data.rejectionReason, "Virement non conforme");
  });

  it("rejection does NOT grant the verified badge either", async () => {
    const pro = await request(server, "GET", "/admin/professionals/PRO-7001", null, makeToken(ROLES.super_admin));
    assert.equal(pro.body.data.verificationStatus, "pending");
  });

  it("audit log PAYMENT_REJECTED is written backend-side", async () => {
    const audit = await request(server, "GET", "/admin/audit-logs", null, makeToken(ROLES.super_admin));
    const actions = audit.body.data.map((a) => a.action);
    assert.ok(actions.includes("PAYMENT_REJECTED"), "audit includes PAYMENT_REJECTED");
  });
});

describe("REQ52 payments — successful EMPTY list is an empty state, not an error", () => {
  let app, server;
  before(async () => {
    const db = createInMemoryDb(baseSeed(null));
    app = createApp({ db });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  });
  after(() => { server.close(); });

  it("GET /admin/payments with zero records -> 200 [] (empty, not error)", async () => {
    const res = await request(server, "GET", "/admin/payments", null, makeToken(ROLES.finance));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 0);
    assert.equal(res.body.error, undefined);
  });
});
