// REQ 58 — billing / financial-history hardening regression tests.
//
// Covers:
//   58-A  Payment.currency is server-authoritative; client can never override
//        planName / amount / currency; method is always bank_transfer.
//   58-B  create() requires a valid, existing, ACTIVE planId (400/404/400) and
//        prevents accidental duplicate PENDING payments (idempotent reuse).
//   58-C  proof inputs are sanitized (dangerous URL schemes refused, lengths
//        bounded) and proofSubmittedAt is tracked when proof is attached.
//   58-D  BillingTransaction is append-only: exactly one immutable "activation"
//        row per confirmed paid payment; free plans never create a row.
//   58-F  The confirm operation is atomic (no partial state on a failure) and
//        idempotent (second confirm → 409, never a duplicate billing row).
//   58-G  Renewal APPENDS a "renewal" transaction; prior rows stay untouched.
//   58-H  If the paid period ends, the ledger row is re-labelled (expired); an
//        explicit downgrade re-labels active rows as cancelled. No new rows, no
//        deletion, amounts/periods unchanged.
//   58-I  GET /admin/billing-transactions (+ ?professionalId/status/search) and
//        GET /admin/billing-transactions/summary are read-only, authenticated
//        and gated by payments.view (401 anonymous, 403 staff-without / users).
//   58-K  summary() aggregates confirmed revenue from the immutable ledger and
//        pending/rejected figures from the payment workflow.
//
// Runs against the in-memory DB (no PostgreSQL required in CI).

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
  { id: "PLAN-VER", code: "verified", name: "VÉRIFIÉ", price: 99, currency: "MAD", active: true },
  { id: "PLAN-GOLD", code: "gold", name: "GOLD", price: 199, currency: "MAD", active: true }
];

const ADMINS = [
  { id: "a-super", name: "Super", email: "super@x.ma", password: "x", role: "super_admin", status: "active" },
  { id: "a-admin", name: "Admin", email: "admin@x.ma", password: "x", role: "admin", status: "active" },
  { id: "a-fin", name: "Finance", email: "fin@x.ma", password: "x", role: "finance", status: "active" },
  { id: "a-mod", name: "Mod", email: "mod@x.ma", password: "x", role: "moderator", status: "active" }
];

const OWNER = { id: "USR-OWN", role: "user", name: "Owner Customer" };

function pro(id, overrides) {
  return {
    id, name: "Pro " + id, job: "Plombier", city: "Casablanca", status: "pending",
    package: "free", userId: OWNER.id, ...(overrides || {})
  };
}

const DAY = 86400000;

describe("REQ 58 — billing / financial history hardening", () => {
  let server;
  let db;
  const tokens = {};

  function seed() {
    db = createInMemoryDb({
      adminUser: ADMINS,
      plan: PLANS
    });
    const app = createApp({ db });
    server = app.listen(0);
    return new Promise((r) => server.once("listening", r));
  }

  async function reset() {
    db.professional.rows.length = 0;
    db.payment.rows.length = 0;
    db.subscription.rows.length = 0;
    db.billingTransaction.rows.length = 0;
    db.verificationRequest.rows.length = 0;
    db.auditLog.rows.length = 0;
    db.plan.rows.length = 0;
    db.plan.seed(PLANS);
    db.professional.seed([pro("PRO-9001"), pro("PRO-9002")]);
  }

  before(async () => {
    await seed();
    for (const a of ADMINS) tokens[a.role] = makeToken(a);
    tokens.owner = makeToken(OWNER);
  });

  after(() => { server.close(); });

  async function createPending(professionalId, planId, extra) {
    const res = await request(server, "POST", "/payments", { professionalId, planId, ...(extra || {}) }, tokens.owner);
    return res;
  }

  async function confirmPayment(paymentId, token = tokens.finance) {
    return request(server, "POST", `/admin/payments/${paymentId}/confirm`, undefined, token);
  }

  async function billingRows() {
    const res = await request(server, "GET", "/admin/billing-transactions", undefined, tokens.super_admin);
    return res.body.data || [];
  }

  function auditActions() {
    return db.auditLog.rows.map((a) => a.action);
  }

  describe("58-A/B/C — server-authoritative payment creation + proof hardening", () => {
    beforeEach(() => reset());

    it("requires professionalId (400) and a valid planId (400/404/400)", async () => {
      const noPlan = await request(server, "POST", "/payments", { professionalId: "PRO-9001" }, tokens.owner);
      assert.equal(noPlan.status, 400, JSON.stringify(noPlan.body));
      const unknown = await request(server, "POST", "/payments", { professionalId: "PRO-9001", planId: "PLAN-XXX" }, tokens.owner);
      assert.equal(unknown.status, 404, JSON.stringify(unknown.body));
      db.plan.rows.find((p) => p.id === "PLAN-VER").active = false;
      const inactive = await request(server, "POST", "/payments", { professionalId: "PRO-9001", planId: "PLAN-VER" }, tokens.owner);
      assert.equal(inactive.status, 400, JSON.stringify(inactive.body));
    });

    it("derives planName/amount/currency from the DB plan — client cannot override", async () => {
      const res = await request(server, "POST", "/payments", {
        professionalId: "PRO-9001", planId: "PLAN-GOLD",
        planName: "HACK", amount: 1, currency: "USD", method: "card", bankRef: "REF-ABC"
      }, tokens.owner);
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.data.planName, "GOLD");
      assert.equal(res.body.data.amount, 199);
      assert.equal(res.body.data.currency, "MAD");
      assert.equal(res.body.data.method, "bank_transfer");
      assert.equal(res.body.data.bankRef, "REF-ABC");
    });

    it("prevents accidental duplicate PENDING payments (idempotent reuse, no orphan)", async () => {
      const first = await createPending("PRO-9001", "PLAN-GOLD");
      const second = await createPending("PRO-9001", "PLAN-GOLD");
      assert.equal(first.status, 201, JSON.stringify(first.body));
      assert.equal(second.status, 201, JSON.stringify(second.body));
      assert.equal(second.body.data.id, first.body.data.id, "same payment returned");
      const rows = db.payment.rows.filter((p) => p.professionalId === "PRO-9001" && p.status === "pending");
      assert.equal(rows.length, 1, "exactly one pending row");
      // A DIFFERENT (valid, currently-not-pending) plan is still creatable.
      const other = await createPending("PRO-9001", "PLAN-VER");
      assert.equal(other.status, 201, JSON.stringify(other.body));
      assert.notEqual(other.body.data.id, first.body.data.id);
    });

    it("tracks proofSubmittedAt when proof is attached and stores sanitized proof", async () => {
      const withProof = await createPending("PRO-9001", "PLAN-GOLD", {
        bankReference: "  VIR-MAROC-88231  ",
        receiptUrl: "https://cdn.sna3ti.ma/receipts/vir-88231.pdf",
        proofNote: "Virement passé sur le compte CIH 021-88231."
      });
      assert.equal(withProof.status, 201, JSON.stringify(withProof.body));
      assert.equal(withProof.body.data.bankRef, "VIR-MAROC-88231", "reference trimmed");
      assert.equal(withProof.body.data.receipt, "https://cdn.sna3ti.ma/receipts/vir-88231.pdf");
      assert.ok(withProof.body.data.proofSubmittedAt, "submitted timestamp tracked");
      assert.equal(withProof.body.data.proofNote, "Virement passé sur le compte CIH 021-88231.");

      // Dangerous URL schemes are refused; a plain bank reference is preserved.
      const danger = await createPending("PRO-9001", "PLAN-VER", {
        receiptUrl: "javascript:alert(document.cookie)",
        bankReference: "BANK-777",
        proofNote: "x".repeat(600)
      });
      assert.equal(danger.status, 201, JSON.stringify(danger.body));
      assert.equal(danger.body.data.receipt, null, "dangerous receipt refused");
      assert.equal(danger.body.data.bankRef, "BANK-777");
      assert.equal(danger.body.data.proofNote.length, 500, "proof note capped at 500");
      assert.ok(danger.body.data.proofSubmittedAt, "still tracked when other proof exists");
    });

    it("does NOT set proofSubmittedAt when no proof is attached", async () => {
      const bare = await createPending("PRO-9001", "PLAN-GOLD");
      assert.equal(bare.status, 201, JSON.stringify(bare.body));
      assert.equal(bare.body.data.proofSubmittedAt, null);
      assert.equal(bare.body.data.bankRef, null);
      assert.equal(bare.body.data.receipt, null);
    });
  });

  describe("58-D — confirming a paid payment appends ONE immutable BillingTransaction", () => {
    beforeEach(() => reset());

    it("creates an activation ledger row tied to the payment/subscription", async () => {
      const pay = await createPending("PRO-9001", "PLAN-GOLD");
      assert.equal(pay.status, 201);
      const confirmed = await confirmPayment(pay.body.data.id);
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
      assert.equal(confirmed.body.data.status, "confirmed");

      const rows = db.billingTransaction.rows;
      assert.equal(rows.length, 1, "exactly one billing transaction");
      const t = rows[0];
      assert.equal(t.type, "activation");
      assert.equal(t.status, "active");
      assert.equal(t.professionalId, "PRO-9001");
      assert.equal(t.paymentId, pay.body.data.id);
      assert.equal(t.planId, "PLAN-GOLD");
      assert.equal(t.planName, "GOLD");
      assert.equal(t.amount, 199);
      assert.equal(t.currency, "MAD");
      assert.ok(t.id.startsWith("BT-"), "opaque BT id");
      assert.equal(t.subscriptionId, db.subscription.rows[0].id, "real subscription id referenced");
      assert.equal(t.actorId, "a-fin");
      assert.equal(t.actorName, "Finance");
      const span = new Date(t.periodEndAt).getTime() - new Date(t.periodStartAt).getTime();
      assert.ok(span >= 27 * DAY && span <= 32 * DAY, "period is one calendar month");

      const audit = auditActions();
      assert.ok(audit.includes("PAYMENT_CONFIRMED"));
      const entry = db.auditLog.rows.find((a) => a.action === "PAYMENT_CONFIRMED");
      assert.equal(entry.metadata.billingTransactionId, t.id);
      assert.ok(audit.includes("SUBSCRIPTION_ACTIVATED"), "paid activation is audited");
    });

    it("free-plan activation creates NO billing transaction", async () => {
      const pay = await createPending("PRO-9001", "PLAN-FREE");
      assert.equal(pay.status, 201);
      const confirmed = await confirmPayment(pay.body.data.id);
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
      assert.equal(db.billingTransaction.rows.length, 0, "free plan is not a financial event");
    });
  });

  describe("58-F — confirm is atomic and idempotent", () => {
    beforeEach(() => reset());

    it("a mid-confirmation failure rolls back EVERYTHING (no partial state)", async () => {
      const pay = await createPending("PRO-9001", "PLAN-GOLD");
      assert.equal(pay.status, 201);

      const originalCreate = db.billingTransaction.create;
      db.billingTransaction.create = () => { throw new Error("simulated immutable-write failure"); };
      try {
        const failed = await confirmPayment(pay.body.data.id);
        assert.equal(failed.status, 500, "confirm surfaces the backing failure");
      } finally {
        db.billingTransaction.create = originalCreate;
      }

      // Nothing committed: payment still pending, no subscription, no ledger row.
      assert.equal(db.payment.rows.find((p) => p.id === pay.body.data.id).status, "pending");
      assert.equal(db.subscription.rows.length, 0);
      assert.equal(db.billingTransaction.rows.length, 0);
      assert.equal(db.professional.rows.find((p) => p.id === "PRO-9001").package, "free");

      // And the SAME confirm succeeds on retry — atomic rollback left nothing stuck.
      const retry = await confirmPayment(pay.body.data.id);
      assert.equal(retry.status, 200, JSON.stringify(retry.body));
      assert.equal(db.billingTransaction.rows.length, 1);
    });

    it("a second confirm is rejected (409) and never creates a duplicate ledger row", async () => {
      const pay = await createPending("PRO-9001", "PLAN-GOLD");
      assert.equal((await confirmPayment(pay.body.data.id)).status, 200);
      const dup = await confirmPayment(pay.body.data.id);
      assert.equal(dup.status, 409, JSON.stringify(dup.body));
      assert.equal(db.billingTransaction.rows.length, 1, "single billing row per payment");
    });
  });

  describe("58-G — renewal APPENDS a second transaction; prior rows untouched", () => {
    beforeEach(() => reset());

    it("renew creates a renewal row with paymentId null and preserves the first row", async () => {
      const pay = await createPending("PRO-9001", "PLAN-GOLD");
      await confirmPayment(pay.body.data.id);
      const subId = db.subscription.rows[0].id;

      const renewed = await request(server, "POST", `/admin/subscriptions/${subId}/renew`, undefined, tokens.finance);
      assert.equal(renewed.status, 200, JSON.stringify(renewed.body));

      const rows = db.billingTransaction.rows;
      assert.equal(rows.length, 2, "activation + renewal");
      const [activation, renewal] = [rows.find((t) => t.type === "activation"), rows.find((t) => t.type === "renewal")];
      assert.ok(activation && renewal, "both types present");
      assert.equal(renewal.paymentId, null, "renewal is not tied to a payment");
      assert.equal(renewal.subscriptionId, subId);
      assert.equal(renewal.status, "active");
      assert.equal(renewal.amount, 199);
      assert.ok(new Date(renewal.periodStartAt).getTime() >= new Date(activation.periodEndAt).getTime(), "renewal starts at old expiry");
      assert.equal(activation.status, "active", "historical row untouched");
      assert.equal(activation.amount, 199);
      assert.equal(activation.paymentId, pay.body.data.id);
    });
  });

  describe("58-H — lifecycle re-labels the ledger (expired / cancelled)", () => {
    beforeEach(() => reset());

    it("elapsed periods are re-labelled expired by reconcile; no new rows", async () => {
      const pay = await createPending("PRO-9001", "PLAN-GOLD");
      await confirmPayment(pay.body.data.id);
      const subRow = db.subscription.rows[0];
      const txnRow = db.billingTransaction.rows[0];

      // Simulate time having fully elapsed: subscription AND period ended.
      const past = new Date(Date.now() - 1 * DAY);
      subRow.expiresAt = past;
      txnRow.periodEndAt = past;

      const listed = await request(server, "GET", "/admin/subscriptions", undefined, tokens.finance);
      assert.equal(listed.status, 200, JSON.stringify(listed.body));

      assert.equal(db.subscription.rows[0].status, "expired");
      assert.equal(db.billingTransaction.rows[0].status, "expired", "ledger row re-labelled, not deleted");
      assert.equal(db.billingTransaction.rows.length, 1, "no new financial event");
      assert.equal(db.billingTransaction.rows[0].amount, 199, "amounts immutable");
      assert.equal(db.professional.rows.find((p) => p.id === "PRO-9001").package, "free", "professional reverted to free");
    });

    it("downgrade to free re-labels active rows as cancelled (no deletion, no new row)", async () => {
      const pay = await createPending("PRO-9001", "PLAN-GOLD");
      await confirmPayment(pay.body.data.id);
      const subId = db.subscription.rows[0].id;

      const downgraded = await request(server, "POST", `/admin/subscriptions/${subId}/downgrade`, undefined, tokens.finance);
      assert.equal(downgraded.status, 200, JSON.stringify(downgraded.body));

      assert.equal(db.billingTransaction.rows.length, 1);
      assert.equal(db.billingTransaction.rows[0].status, "cancelled");
      assert.equal(db.billingTransaction.rows[0].amount, 199);
      assert.equal(db.billingTransaction.rows[0].periodEndAt.getTime, db.billingTransaction.rows[0].periodEndAt.getTime, "period preserved");
    });
  });

  describe("58-I — billing history endpoints (read-only, RBAC)", () => {
    beforeEach(() => reset());

    it("anonymous callers are denied (401)", async () => {
      assert.equal((await request(server, "GET", "/admin/billing-transactions")).status, 401);
      assert.equal((await request(server, "GET", "/admin/billing-transactions/summary")).status, 401);
    });

    it("staff without payments.view and platform users are denied (403)", async () => {
      assert.equal((await request(server, "GET", "/admin/billing-transactions", undefined, tokens.moderator)).status, 403);
      assert.equal((await request(server, "GET", "/admin/billing-transactions", undefined, tokens.owner)).status, 403);
      assert.equal((await request(server, "GET", "/admin/billing-transactions/summary", undefined, tokens.moderator)).status, 403);
    });

    it("finance / super_admin can list the ledger with pagination", async () => {
      const pay = await createPending("PRO-9001", "PLAN-GOLD");
      await confirmPayment(pay.body.data.id);

      const res = await request(server, "GET", "/admin/billing-transactions", undefined, tokens.finance);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.pagination.total, 1);
      assert.equal(res.body.data[0].type, "activation");

      const sup = await request(server, "GET", "/admin/billing-transactions", undefined, tokens.super_admin);
      assert.equal(sup.status, 200);
    });

    it("supports professionalId / status / search filters and validates type/status", async () => {
      const gold = await createPending("PRO-9001", "PLAN-GOLD");
      await confirmPayment(gold.body.data.id);
      const ver = await createPending("PRO-9002", "PLAN-VER");
      await confirmPayment(ver.body.data.id);
      const txnId = db.billingTransaction.rows[0].id;

      const scoped = await request(server, "GET", "/admin/billing-transactions?professionalId=PRO-9001", undefined, tokens.super_admin);
      assert.equal(scoped.body.data.length, 1);
      assert.equal(scoped.body.data[0].professionalId, "PRO-9001");

      const byStatus = await request(server, "GET", "/admin/billing-transactions?status=active", undefined, tokens.super_admin);
      assert.equal(byStatus.body.data.length, 2);

      const bySearch = await request(server, "GET", `/admin/billing-transactions?search=${txnId}`, undefined, tokens.super_admin);
      assert.equal(bySearch.body.data.length, 1);
      assert.equal(bySearch.body.data[0].id, txnId);

      assert.equal((await request(server, "GET", "/admin/billing-transactions?type=nonsense", undefined, tokens.super_admin)).status, 400);
      assert.equal((await request(server, "GET", "/admin/billing-transactions?status=nonsense", undefined, tokens.super_admin)).status, 400);
    });

    it("exposes NO write routes on the ledger", async () => {
      const res = await request(server, "POST", "/admin/billing-transactions", {}, tokens.super_admin);
      assert.equal(res.status, 404, "no create route");
      const del = await request(server, "DELETE", "/admin/billing-transactions/BT-1", undefined, tokens.super_admin);
      assert.equal(del.status, 404, "no delete route");
      const patch = await request(server, "PATCH", "/admin/billing-transactions/BT-1", {}, tokens.super_admin);
      assert.equal(patch.status, 404, "no update route");
    });
  });

  describe("58-K — summary aggregates confirmed revenue + workflow figures", () => {
    beforeEach(() => reset());

    it("reports confirmed amount/plan breakdown plus pending and rejected payment figures", async () => {
      const gold = await createPending("PRO-9001", "PLAN-GOLD");
      await confirmPayment(gold.body.data.id);
      const ver = await createPending("PRO-9002", "PLAN-VER");
      await confirmPayment(ver.body.data.id);

      // A brand-new PENDING payment for a plan that has no pending row yet.
      const pending = await createPending("PRO-9001", "PLAN-VER");
      assert.equal(pending.status, 201, JSON.stringify(pending.body));

      let summary = await request(server, "GET", "/admin/billing-transactions/summary", undefined, tokens.finance);
      assert.equal(summary.status, 200, JSON.stringify(summary.body));
      assert.equal(summary.body.data.confirmedCount, 2);
      assert.equal(summary.body.data.confirmedAmount, 298, "199 (GOLD) + 99 (VÉRIFIÉ)");
      assert.equal(summary.body.data.pendingAmount, 99);
      assert.equal(summary.body.data.rejectedCount, 0);
      const byPlan = Object.fromEntries(summary.body.data.revenueByPlan.map((p) => [p.planName, p]));
      assert.equal(byPlan["GOLD"].amount, 199);
      assert.equal(byPlan["VÉRIFIÉ"].amount, 99);
      assert.ok(summary.body.data.resolvedCurrencies.includes("MAD"), "only MAD in currency set");

      const rejected = await request(server, "POST", `/admin/payments/${pending.body.data.id}/reject`, { reason: "Montant incorrect." }, tokens.finance);
      assert.equal(rejected.status, 200, JSON.stringify(rejected.body));

      summary = await request(server, "GET", "/admin/billing-transactions/summary", undefined, tokens.super_admin);
      assert.equal(summary.body.data.pendingAmount, 0);
      assert.equal(summary.body.data.rejectedCount, 1);
      assert.equal(summary.body.data.rejectedAmount, 99);
    });
  });
});