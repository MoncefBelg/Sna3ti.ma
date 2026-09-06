// REQ 57 — subscription & payment lifecycle hardening regression tests.
//
// Covers:
//   57-A registration approval always starts on the FREE account (package=free)
//        for free / verified / gold requests, is idempotent, exactly one
//        professional, ARQ→PRO trace intact, request-level plan preserved.
//   57-B payment request-information admin flow: pending → needs_info, note
//        stored, PAYMENT_INFO_REQUESTED audit, non-pending → 409, anonymous 401
//        and staff without payments.reject → 403.
//   57-C subscription create writes SUBSCRIPTION_CREATED audit (a pending row is
//        semantically "created", not "activated").
//   57-D read endpoints are authenticated and authorized: anonymous 401 on
//        payment/subscription/verification reads; a professional owner can only
//        read their own records; staff per RBAC.
//   57-E verification JOIN approval activates the free subscription but NEVER
//        publishes — the professional stays pending until admin activation.
//   57-F GET /plans returns authoritative server-driven prices.
//
// Runs against the in-memory DB (no PostgreSQL required in CI), mirroring the
// existing app.test.js / registration-lifecycle.test.js harness.

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const jwt = require("jsonwebtoken");
const { createInMemoryDb } = require("./inMemoryDb");
const { createApp } = require("../src/app");
const env = require("../src/config/env");

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

function makeToken(sub) {
  return jwt.sign({ sub: sub.id, role: sub.role, name: sub.name }, env.jwtSecret, { expiresIn: "1h" });
}

const PLANS = [
  { id: "PLAN-FREE", code: "free", name: "Free", price: 0, currency: "MAD", active: true },
  { id: "PLAN-VER", code: "verified", name: "Vérifié", price: 99, currency: "MAD", active: true },
  { id: "PLAN-GOLD", code: "gold", name: "GOLD", price: 199, currency: "MAD", active: true }
];

const ADMINS = [
  { id: "a-super", name: "Super", email: "super@x.ma", password: "x", role: "super_admin", status: "active" },
  { id: "a-admin", name: "Admin", email: "admin@x.ma", password: "x", role: "admin", status: "active" },
  { id: "a-fin", name: "Finance", email: "fin@x.ma", password: "x", role: "finance", status: "active" },
  { id: "a-mod", name: "Mod", email: "mod@x.ma", password: "x", role: "moderator", status: "active" }
];

// A platform customer who OWNS a professional record (PRO-OWN).
const OWNER = { id: "USR-OWN", role: "user", name: "Owner Customer" };
// Another customer who does NOT own anything.
const OTHER = { id: "USR-OTHER", role: "user", name: "Other Customer" };

function pro(id, overrides) {
  return {
    id, name: "Pro " + id, job: "Plombier", city: "Casablanca", status: "pending",
    package: "free", userId: (id === "PRO-OWN" ? OWNER.id : null),
    ...(overrides || {})
  };
}

function pay(id, professionalId, overrides) {
  return {
    id, professionalId, planName: "GOLD", amount: 199, currency: "MAD",
    method: "bank_transfer", status: "pending", date: new Date(), createdAt: new Date(),
    ...(overrides || {})
  };
}

function sub(id, professionalId, overrides) {
  return {
    id, professionalId, planId: "PLAN-GOLD", planName: "GOLD", status: "pending",
    paymentStatus: "pending", price: 199, currency: "MAD", since: new Date(), startedAt: new Date(), createdAt: new Date(),
    ...(overrides || {})
  };
}

function vr(id, professionalId, overrides) {
  return {
    id, professionalId, level: "identity", status: "pending", priority: "medium",
    submitted: new Date(), createdAt: new Date(), ...(overrides || {})
  };
}

describe("REQ 57 — subscription / payment lifecycle hardening", () => {
  let server;
  let db;
  const tokens = {};

  function seed(base) {
    db = createInMemoryDb({
      adminUser: ADMINS,
      plan: PLANS,
      ...base
    });
    const app = createApp({ db });
    server = app.listen(0);
    return new Promise((r) => server.once("listening", r));
  }

  async function reset(overrides = {}) {
    db.professional.rows.length = 0;
    db.professionalRequest.rows.length = 0;
    db.subscription.rows.length = 0;
    db.payment.rows.length = 0;
    db.verificationRequest.rows.length = 0;
    db.user.rows.length = 0;
    db.auditLog.rows.length = 0;
    if (overrides.professional) db.professional.seed(overrides.professional);
    if (overrides.payment) db.payment.seed(overrides.payment);
    if (overrides.subscription) db.subscription.seed(overrides.subscription);
    if (overrides.verification) db.verificationRequest.seed(overrides.verification);
    if (overrides.user) db.user.seed(overrides.user);
  }

  before(async () => {
    await seed();
    for (const a of ADMINS) tokens[a.role] = makeToken(a);
    tokens.owner = makeToken(OWNER);
    tokens.other = makeToken(OTHER);
  });

  after(() => { server.close(); });

  async function auditActions() {
    const res = await request(server, "GET", "/admin/audit-logs", undefined, tokens.super_admin);
    return (res.body.data || []).map((a) => a.action);
  }

  describe("57-A — registration approval always starts on FREE", () => {
    beforeEach(() => reset());
    let phoneCounter = 100;

    function nextPhone() { return "+2126" + String(phoneCounter++).padStart(8, "0"); }

    async function registerAndApprove(overrides) {
      const created = await request(server, "POST", "/professional-requests", {
        firstName: "Karim", lastName: "El Amrani", phone: nextPhone(),
        profession: "electricien", city: "casablanca", plan: overrides.plan
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const approved = await request(server, "POST", `/admin/professional-requests/${created.body.data.id}/approve`, undefined, tokens.admin);
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      const proRow = db.professional.rows[0];
      return { req: created.body.data, pro: proRow, approved };
    }

    it("free / verified / gold requests all materialise as package=free (pending)", async () => {
      for (const plan of ["free", "verified", "gold"]) {
        const { pro: proRow } = await registerAndApprove({ plan });
        assert.equal(proRow.package, "free", "REQ 57-A: requested '" + plan + "' starts on free");
        assert.equal(proRow.status, "pending", "never published");
      }
    });

    it("requested plan stays traceable on the request (not the professional)", async () => {
      const { req, pro: proRow } = await registerAndApprove({ plan: "gold" });
      // Plan trace lives on the request, not the professional record.
      const detail = await request(server, "GET", `/admin/professional-requests/${req.id}`, undefined, tokens.super_admin);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.data.planCode, "gold", "request-level plan preserved");
      assert.equal(detail.body.data.professionalId, proRow.id, "ARQ→PRO link intact");
      assert.equal(proRow.status, "pending", "never published");
      assert.equal(proRow.package, "free", "professional always starts free");
    });

    it("exactly one professional is created; idempotent approval returns the same account", async () => {
      const { req, pro: proRow } = await registerAndApprove({ plan: "verified" });
      assert.equal(db.professional.rows.length, 1, "exactly one professional");
      // Second approve → 409, never duplicates.
      const dup = await request(server, "POST", `/admin/professional-requests/${req.id}/approve`, undefined, tokens.admin);
      assert.equal(dup.status, 409);
      assert.equal(db.professional.rows.length, 1, "still exactly one");
    });
  });

  describe("57-B — payment request-information admin flow", () => {
    beforeEach(() => reset({ professional: [pro("PRO-9001")], payment: [pay("PAY-1", "PRO-9001")] }));

    it("moves a pending payment to needs_info with the note and audits it", async () => {
      const res = await request(server, "POST", "/admin/payments/PAY-1/request-information", { note: "Merci de fournir le reçu de virement." }, tokens.finance);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.status, "needs_info");
      assert.equal(res.body.data.infoRequested, "Merci de fournir le reçu de virement.");
      const audit = await auditActions();
      assert.ok(audit.includes("PAYMENT_INFO_REQUESTED"), "PAYMENT_INFO_REQUESTED audit written");
    });

    it("rejects a non-pending payment with 409", async () => {
      db.payment.rows[0].status = "confirmed";
      const res = await request(server, "POST", "/admin/payments/PAY-1/request-information", { note: "x" }, tokens.finance);
      assert.equal(res.status, 409, "non-pending request must be rejected");
    });

    it("requires a note (400) and remains safe under authorization", async () => {
      const noNote = await request(server, "POST", "/admin/payments/PAY-1/request-information", {}, tokens.finance);
      assert.equal(noNote.status, 400);
      // Anonymous → 401.
      const anon = await request(server, "POST", "/admin/payments/PAY-1/request-information", { note: "x" });
      assert.equal(anon.status, 401);
      // Moderator lacks payments.reject → 403.
      const mod = await request(server, "POST", "/admin/payments/PAY-1/request-information", { note: "x" }, tokens.moderator);
      assert.equal(mod.status, 403);
    });
  });

  describe("57-C — subscription create audit name", () => {
    beforeEach(() => reset({ professional: [pro("PRO-9001", { userId: OWNER.id })] }));

    it("create logs SUBSCRIPTION_CREATED (pending, not activated)", async () => {
      const created = await request(server, "POST", "/subscriptions", { professionalId: "PRO-9001", planId: "PLAN-GOLD" }, tokens.owner);
      assert.equal(created.status, 201);
      assert.equal(created.body.data.status, "pending");
      const audit = await auditActions();
      assert.ok(audit.includes("SUBSCRIPTION_CREATED"), "SUBSCRIPTION_CREATED audit present");
    });
  });

  describe("57-D — read endpoints are authenticated + authorized", () => {
    beforeEach(() => reset({
      professional: [pro("PRO-OWN", { userId: OWNER.id, status: "active" }), pro("PRO-9001")],
      payment: [pay("PAY-OWN", "PRO-OWN"), pay("PAY-9001", "PRO-9001")],
      subscription: [sub("SUB-OWN", "PRO-OWN"), sub("SUB-9001", "PRO-9001")],
      verification: [vr("VR-OWN", "PRO-OWN"), vr("VR-9001", "PRO-9001")]
    }));

    it("anonymous reads all return 401", async () => {
      assert.equal((await request(server, "GET", "/subscriptions")).status, 401);
      assert.equal((await request(server, "GET", "/subscriptions/SUB-OWN")).status, 401);
      assert.equal((await request(server, "GET", "/verifications")).status, 401);
      assert.equal((await request(server, "GET", "/verifications/VR-OWN")).status, 401);
      assert.equal((await request(server, "GET", "/payments/PAY-OWN")).status, 401);
    });

    it("an owner can read their own payment/subscription/verification", async () => {
      assert.equal((await request(server, "GET", "/payments/PAY-OWN", undefined, tokens.owner)).status, 200);
      assert.equal((await request(server, "GET", "/subscriptions/SUB-OWN", undefined, tokens.owner)).status, 200);
      assert.equal((await request(server, "GET", "/verifications/VR-OWN", undefined, tokens.owner)).status, 200);
    });

    it("a professional can NOT read another professional's record", async () => {
      assert.equal((await request(server, "GET", "/payments/PAY-9001", undefined, tokens.owner)).status, 403);
      assert.equal((await request(server, "GET", "/subscriptions/SUB-9001", undefined, tokens.owner)).status, 403);
      assert.equal((await request(server, "GET", "/verifications/VR-9001", undefined, tokens.owner)).status, 403);
    });

    it("an unrelated customer with no professional cannot read any record", async () => {
      assert.equal((await request(server, "GET", "/payments/PAY-OWN", undefined, tokens.other)).status, 403);
      assert.equal((await request(server, "GET", "/subscriptions/SUB-OWN", undefined, tokens.other)).status, 403);
      assert.equal((await request(server, "GET", "/verifications/VR-OWN", undefined, tokens.other)).status, 403);
    });

    it("a customer cannot list all subscriptions (no professional scope)", async () => {
      assert.equal((await request(server, "GET", "/subscriptions", undefined, tokens.other)).status, 403);
      assert.equal((await request(server, "GET", "/verifications", undefined, tokens.other)).status, 403);
    });

    it("staff with the module permission can read records; staff without are denied", async () => {
      // finance has payments.view + subscriptions.view but NOT verification.view.
      assert.equal((await request(server, "GET", "/payments/PAY-9001", undefined, tokens.finance)).status, 200);
      assert.equal((await request(server, "GET", "/subscriptions/SUB-9001", undefined, tokens.finance)).status, 200);
      assert.equal((await request(server, "GET", "/verifications/VR-9001", undefined, tokens.finance)).status, 403, "finance lacks verification.view");
    });
  });

  describe("57-E — JOIN approval activates free sub without publishing", () => {
    beforeEach(() => reset({ professional: [pro("PRO-JOIN", { status: "pending" })], verification: [vr("VR-JOIN", "PRO-JOIN", { level: "join" })] }));

    it("approving a join leaves the professional PENDING while granting a free subscription", async () => {
      const res = await request(server, "POST", "/verifications/VR-JOIN/approve", {}, tokens.moderator);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const proRow = db.professional.rows[0];
      assert.equal(proRow.status, "pending", "REQ 57-E: never auto-published");
      const freeSub = db.subscription.rows.find((s) => s.professionalId === "PRO-JOIN");
      assert.ok(freeSub, "free subscription activated");
      assert.equal(freeSub.status, "active");
      assert.equal(freeSub.paymentStatus, "confirmed");
      const audit = await auditActions();
      assert.ok(audit.includes("SUBSCRIPTION_ACTIVATED"), "free activation is audited");
    });

    it("the pending professional does NOT appear on the public marketplace", async () => {
      await request(server, "POST", "/verifications/VR-JOIN/approve", {}, tokens.moderator);
      const pub = await request(server, "GET", "/professionals");
      const ids = (pub.body.data.data || pub.body.data).map((p) => p.id);
      assert.ok(!ids.includes("PRO-JOIN"), "pending professional not listed publicly");
    });

    it("explicit admin activation publishes the professional", async () => {
      await request(server, "POST", "/verifications/VR-JOIN/approve", {}, tokens.moderator);
      const act = await request(server, "POST", "/admin/professionals/PRO-JOIN/activate", {}, tokens.admin);
      assert.equal(act.status, 200);
      const pub = await request(server, "GET", "/professionals");
      const ids = (pub.body.data.data || pub.body.data).map((p) => p.id);
      assert.ok(ids.includes("PRO-JOIN"), "activate publishes the professional");
    });
  });

  describe("57-F — GET /plans returns authoritative prices", () => {
    beforeEach(() => reset());

    it("plans endpoints expose server-side catalogue (0 / 99 / 199 MAD)", async () => {
      const res = await request(server, "GET", "/plans");
      assert.equal(res.status, 200);
      const plans = res.body.data.data || res.body.data;
      const byCode = Object.fromEntries(plans.map((p) => [p.code, p]));
      assert.equal(byCode.free.price, 0);
      assert.equal(byCode.verified.price, 99);
      assert.equal(byCode.gold.price, 199);
      assert.equal(byCode.verified.currency, "MAD");
    });
  });
});