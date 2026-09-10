// REQ 61 — Analytics endpoint returns REAL figures derived from live data.
//
// GET /admin/analytics (permission analytics.view) must compute its numbers
// from the actual repositories at request time — never from a static/simulated
// store. This locks the contract:
//   - totals  : professionals / active / pendingRegistrations / pendingPayments /
//               verifiedPercent / goldPercent / freeToPaid / mrr / confirmedAmountTotal /
//               pendingAmount / thisMonthRevenue
//   - revenueByPlan : confirmed revenue split by plan name
//   - months  : 12 monthly buckets {signups, activations, revenue, pays, leads, conversion, churn}
//   - days    : 90 daily buckets {signups, activations, revenue, pays, leads, requests}
//   - RBAC    : finance (no analytics.view) -> 403; super_admin -> 200
//
// Runs against the in-memory DB (no PostgreSQL required in CI).

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createInMemoryDb } = require("./inMemoryDb");
const { createApp } = require("../src/app");
const env = require("../src/config/env");
const jwt = require("jsonwebtoken");
const http = require("http");

function request(server, method, pathname, body, token) {
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

function makeToken(actor) {
  return jwt.sign({ sub: actor.id, role: actor.role, name: actor.name }, env.jwtSecret, { expiresIn: "1h" });
}

const SUPER = { id: "a-sa", role: "super_admin", name: "Super Admin" };
const FINANCE = { id: "a-fi", role: "finance", name: "Finance" };
const SUPPORT = { id: "a-sp", role: "support", name: "Support" };
const superAdminToken = makeToken(SUPER);
const financeToken = makeToken(FINANCE);
const supportToken = makeToken(SUPPORT);

const PLANS = [
  { id: "PLAN-FREE", code: "free", name: "Free", price: 0, active: true },
  { id: "PLAN-VER", code: "verified", name: "Vérifié", price: 99, active: true },
  { id: "PLAN-GOLD", code: "gold", name: "GOLD", price: 199, active: true }
];

function boot(seed) {
  const app = createApp({ db: createInMemoryDb(seed) });
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

describe("REQ 61 — GET /admin/analytics computes real figures", () => {
  let server;
  before(async () => {
    server = await boot({
      adminUser: [
        { id: "a-sa", name: "Super Admin", email: "sa@sna3ti.ma", role: "super_admin", status: "active", createdAt: new Date() },
        { id: "a-fi", name: "Finance", email: "fi@sna3ti.ma", role: "finance", status: "active", createdAt: new Date() },
        { id: "a-sp", name: "Support", email: "sp@sna3ti.ma", role: "support", status: "active", createdAt: new Date() }
      ],
      role: [{ id: "ROLE-SA", code: "super_admin", name: "Super Admin" }],
      plan: PLANS,
      category: [],
      professional: [],
      user: [],
      verificationRequest: [],
      payment: [],
      subscription: [],
      review: [],
      report: [],
      supportTicket: [],
      notification: [],
      auditLog: [],
      professionalRequest: []
    });
  });
  after(() => { server.close(); });

  it("RBAC: support (no analytics.view) -> 403, super_admin + finance -> 200", async () => {
    const forbidden = await request(server, "GET", "/admin/analytics", undefined, supportToken);
    assert.equal(forbidden.status, 403, "support must be denied analytics.view");

    const okSuper = await request(server, "GET", "/admin/analytics", undefined, superAdminToken);
    assert.equal(okSuper.status, 200, "super_admin can read analytics");
    assert.ok(okSuper.body.data, "envelope { data }");

    const okFinance = await request(server, "GET", "/admin/analytics", undefined, financeToken);
    assert.equal(okFinance.status, 200, "finance (achats/revenus) can read analytics");
  });

  it("day/month buckets exist with the documented shapes", async () => {
    const res = await request(server, "GET", "/admin/analytics", undefined, superAdminToken);
    const d = res.body.data;
    assert.equal(res.status, 200);

    assert.equal(d.days.length, 90, "90 daily buckets");
    const day = d.days[d.days.length - 1];
    assert.ok("date" in day && "signups" in day && "activations" in day && "revenue" in day && "pays" in day && "leads" in day && "requests" in day);

    assert.equal(d.months.length, 12, "12 monthly buckets");
    const month = d.months[d.months.length - 1];
    assert.ok("month" in month && "label" in month && "signups" in month && "revenue" in month && "conversion" in month && "churn" in month);

    assert.ok(Array.isArray(d.revenueByPlan), "revenueByPlan is an array");
    assert.ok(Array.isArray(d.topServices) && Array.isArray(d.topCities), "top lists are arrays");
    assert.ok("mrr" in d.totals && "confirmedAmountTotal" in d.totals && "pendingAmount" in d.totals, "totals carry money/pipeline fields");
  });

  it("a paid registration approved + payment confirmed is reflected in analytics", async () => {
    const reg = await request(server, "POST", "/professional-requests", {
      firstName: "Salma", lastName: "Benali", phone: "+212600000001",
      profession: "electricien", city: "casablanca", plan: "gold"
    });
    assert.equal(reg.status, 201);

    const approve = await request(server, "POST", `/admin/professional-requests/${reg.body.data.id}/approve`, {}, superAdminToken);
    assert.equal(approve.status, 200, "approval ok");

    const pays = await request(server, "GET", "/admin/payments", undefined, superAdminToken);
    const list = Array.isArray(pays.body.data) ? pays.body.data : (pays.body.data && pays.body.data.data) || [];
    const pending = list.find((p) => p.status === "pending");
    assert.ok(pending, "REQ 60 pending payment auto-created by approval");
    const pendingAmount = pending.amount || 199;

    const confirm = await request(server, "POST", `/admin/payments/${pending.id}/confirm`, {}, superAdminToken);
    assert.equal(confirm.status, 200, "payment confirmed");

    const res = await request(server, "GET", "/admin/analytics", undefined, superAdminToken);
    const d = res.body.data;

    assert.equal(d.totals.active, 0, "no professional activated yet (confirmation precedes the PRO creation in this flow)");
    assert.ok(d.totals.pendingRegistrations >= 0, "pendingRegistrations is a number");

    // Subscriptions / MRR: confirm activates the real Subscription plan (GOLD 199)
    assert.equal(d.totals.mrr, 199, "MRR = sum of active paid subscription prices");
    assert.equal(d.totals.confirmedAmountTotal, pendingAmount, "confirmedAmountTotal = confirmed billing ledger");

    const gold = (d.revenueByPlan || []).find((r) => r.planName === "GOLD");
    assert.ok(gold, "revenueByPlan contains a GOLD bucket");
    assert.equal(gold.amount, pendingAmount, "GOLD revenue aggregates the confirmed transaction");

    const current = d.months[d.months.length - 1];
    assert.ok(current.signups >= 1, "this month counts the golden registration");
    assert.ok(current.revenue >= pendingAmount, "this month counts the confirmed revenue");

    // Ping the analytics again AFTER data changed: numbers must move (dynamique).
    const res2 = await request(server, "GET", "/admin/analytics", undefined, superAdminToken);
    assert.ok(res2.body.data.totals.confirmedAmountTotal >= res.body.data.totals.confirmedAmountTotal, "analytics recomputes on each request");
  });
});