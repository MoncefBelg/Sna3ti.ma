// E2E test suite — REQ 56 (production readiness).
// Runs the full platform journey through the real HTTP API against the
// in-memory DB (no PostgreSQL required in CI). Covers:
//   Auth, Professionals (CRUD/suspend/activate), Subscriptions, Payments,
//   Verifications, Reviews, Reports and RBAC for all roles.
//
// These tests complement tests/app.test.js with deeper scenario coverage
// (moderation lifecycle, escalation, RBAC matrix, idempotency, badge rules).

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const jwt = require("jsonwebtoken");
const { createInMemoryDb } = require("./inMemoryDb");
const { createApp } = require("../src/app");
const env = require("../src/config/env");

// ── Harness ──────────────────────────────────────────────────────────────────
let app, server, baseUrl;

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL("/api/v1" + path, baseUrl);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    let payload = null;
    if (body !== undefined && body !== null) {
      payload = JSON.stringify(body);
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    const opts = { method, hostname: "127.0.0.1", port: server.address().port, path: url.pathname, headers };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
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

function buildSeed() {
  return {
    adminUser: [
      { id: "admin-1", name: "Super Admin", email: "sa@sna3ti.ma", role: "super_admin", status: "active", createdAt: new Date() }
    ],
    role: [{ id: "ROLE-SA", code: "super_admin", name: "Super Admin" }],
    plan: [
      { id: "PLAN-FREE", code: "free",     name: "Free",     price: 0,   active: true },
      { id: "PLAN-VER",  code: "verified", name: "Vérifié",  price: 99,  active: true },
      { id: "PLAN-GOLD", code: "gold",     name: "Gold",     price: 199, active: true }
    ],
    category: [
      { id: "CAT-1", code: "plombier", label: "Plombier", icon: "🔧", active: true },
      { id: "CAT-2", code: "peintre",  label: "Peintre",  icon: "🖌️", active: true }
    ],
    region: [{ id: "REG-1", name: "Casablanca-Settat", order: 1 }],
    professional: [
      {
        id: "PRO-5000", name: "Hassan Maroc", categoryId: "CAT-1", city: "Casablanca",
        job: "plombier", status: "active", identityStatus: "pending", professionStatus: "pending",
        verificationStatus: "pending", planEligible: false, verified: false,
        package: "free", subscriptionStatus: "none", createdAt: new Date()
      },
      {
        id: "PRO-5001", name: "Brahim Fes", categoryId: "CAT-1", city: "Fes",
        job: "macon", status: "active", identityStatus: "pending", professionStatus: "pending",
        verificationStatus: "pending", planEligible: false, verified: false,
        package: "free", subscriptionStatus: "none", createdAt: new Date()
      }
    ],
    user: [{ id: "USR-1", name: "User One", phone: "+212600000001", status: "active", createdAt: new Date() }],
    // Verified WhatsApp contacts (confirmed + 48h cooldown elapsed) that unlock
    // review eligibility for USR-1 on PRO-5000 (lifecycle) and PRO-5001 (RBAC).
    professionalContactInteraction: [
      {
        id: "INT-E2E-1", customerId: "USR-1", professionalId: "PRO-5000",
        channel: "WHATSAPP", source: "PROFILE", status: "CONFIRMED_CONTACT",
        customerConfirmed: true, customerConfirmedAt: new Date(Date.now() - 50000),
        reviewEligibleAt: new Date(Date.now() - 1000),
        riskScore: 0, riskFlags: [], lastContactAt: new Date(Date.now() - 50000),
        createdAt: new Date(Date.now() - 50000), updatedAt: new Date()
      },
      {
        id: "INT-E2E-2", customerId: "USR-1", professionalId: "PRO-5001",
        channel: "WHATSAPP", source: "PROFILE", status: "CONFIRMED_CONTACT",
        customerConfirmed: true, customerConfirmedAt: new Date(Date.now() - 50000),
        reviewEligibleAt: new Date(Date.now() - 1000),
        riskScore: 0, riskFlags: [], lastContactAt: new Date(Date.now() - 50000),
        createdAt: new Date(Date.now() - 50000), updatedAt: new Date()
      }
    ],
    verificationRequest: [
      {
        id: "VR-E2E", professionalId: "PRO-5000", level: "identity",
        status: "pending", submitted: new Date(), history: []
      }
    ],
    payment: [],
    subscription: [],
    review: [],
    report: [],
    supportTicket: [],
    notification: [],
    auditLog: []
  };
}

const ROLES = {
  super_admin: { id: "a-sa", role: "super_admin", name: "Super Admin" },
  admin:        { id: "a-ad", role: "admin",        name: "Admin" },
  moderator:    { id: "a-mo", role: "moderator",    name: "Moderator" },
  support:      { id: "a-su", role: "support",      name: "Support" },
  finance:      { id: "a-fi", role: "finance",      name: "Finance" }
};

before(async () => {
  const db = createInMemoryDb(buildSeed());
  app = createApp({ db });
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server.close(); });

// ═════════════════════════════════════════════════════════════════════════════
// AUTH — full lifecycle
// ═════════════════════════════════════════════════════════════════════════════
describe("E2E Auth", () => {
  it("register -> login -> me -> logout -> refresh", async () => {
    const reg = await request("POST", "/auth/register", {
      firstName: "Khadija", lastName: "El Idrissi", email: "khadija@sna3ti.ma",
      phone: "+212600000099", password: "Sna3ti@2026"
    });
    assert.equal(reg.status, 201);
    assert.match(reg.body.user.id, /^USR-\d+$/);
    assert.ok(!JSON.stringify(reg.body).includes("passwordHash"));

    const login = await request("POST", "/auth/login", { email: "khadija@sna3ti.ma", password: "Sna3ti@2026" });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    const me = await request("GET", "/auth/me", null, login.body.token);
    assert.equal(me.body.data.email, "khadija@sna3ti.ma");
    assert.equal(me.body.data.firstName, "Khadija");

    // Refresh rotates a fresh access token.
    const refresh = await request("POST", "/auth/refresh", { refreshToken: login.body.refreshToken });
    assert.equal(refresh.status, 200);
    assert.ok(refresh.body.token);

    // Logout invalidates the session.
    const logout = await request("POST", "/auth/logout", { token: login.body.token }, login.body.token);
    assert.equal(logout.status, 200);
  });

  it("rejects bad password with 401 and unauthenticated me with 401", async () => {
    const bad = await request("POST", "/auth/login", { email: "khadija@sna3ti.ma", password: "nope" });
    assert.equal(bad.status, 401);
    const anon = await request("GET", "/auth/me");
    assert.equal(anon.status, 401);
    assert.equal(anon.body.error.code, "UNAUTHORIZED");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PROFESSIONALS — CRUD + suspend/activate
// ═════════════════════════════════════════════════════════════════════════════
describe("E2E Professionals", () => {
  const tok = makeToken(ROLES.admin);
  let proId;

  it("creates a professional, updates it, then suspends and reactivates", async () => {
    const create = await request("POST", "/professionals", { name: "Youssef", job: "peintre", city: "Rabat" }, tok);
    assert.equal(create.status, 201);
    proId = create.body.data.id;
    assert.match(proId, /^PRO-\d+$/);

    const upd = await request("PATCH", "/professionals/" + proId, { city: "Tanger" }, tok);
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.city, "Tanger");

    const susp = await request("POST", "/admin/professionals/" + proId + "/suspend", { reason: "Signalement" }, tok);
    assert.equal(susp.status, 200);
    assert.equal(susp.body.data.status, "suspended");

    const act = await request("POST", "/admin/professionals/" + proId + "/activate", {}, tok);
    assert.equal(act.status, 200);
    assert.equal(act.body.data.status, "active");
  });

  it("activating a non-suspended professional returns 409", async () => {
    const res = await request("POST", "/admin/professionals/" + proId + "/activate", {}, tok);
    assert.equal(res.status, 409);
  });

  it("deletes the professional", async () => {
    const del = await request("DELETE", "/professionals/" + proId, {}, tok);
    assert.equal(del.status, 200);
    assert.equal(del.body.data.deleted, true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS — free / verified / gold + duplicate protection
// ═════════════════════════════════════════════════════════════════════════════
describe("E2E Subscriptions", () => {
  const tok = makeToken(ROLES.super_admin);
  let subId;

  it("creates free/verified/gold subscriptions with DB prices for distinct professionals", async () => {
    async function sub(planId, price) {
      // Each subscription targets its own freshly-created professional so the
      // Postgres unique(professionalId) rule is respected at creation time.
      const pro = await request("POST", "/professionals", { name: "Sub " + price, job: "plombier", city: "Rabat" }, tok);
      const r = await request("POST", "/subscriptions", { professionalId: pro.body.data.id, planId }, tok);
      assert.equal(r.status, 201);
      assert.equal(r.body.data.price, price, "price must come from the DB, not the client");
      return r.body.data;
    }
    await sub("PLAN-FREE", 0);
    await sub("PLAN-VER", 99);
    subId = (await sub("PLAN-GOLD", 199)).id;
  });

  it("cancels a subscription", async () => {
    const cancel = await request("POST", "/subscriptions/" + subId + "/cancel", {}, tok);
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.data.status, "cancelled");
    assert.ok(cancel.body.data.cancelledAt);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// VERIFICATIONS — submit / approve / reject / request-information / badge rules
// ═════════════════════════════════════════════════════════════════════════════
describe("E2E Verifications", () => {
  const tok = makeToken(ROLES.moderator);

  it("submits a new verification request (pending)", async () => {
    const r = await request("POST", "/verifications", { professionalId: "PRO-5000", level: "identity" }, tok);
    assert.equal(r.status, 201);
    assert.equal(r.body.data.status, "pending");
    assert.match(r.body.data.id, /^VR-\d+$/);
  });

  it("approving identity grants the badge but subscription stays unchanged", async () => {
    const approve = await request("POST", "/verifications/VR-E2E/approve", {}, tok);
    assert.equal(approve.status, 200);
    assert.equal(approve.body.data.status, "approved");

    const pro = await request("GET", "/admin/professionals/PRO-5000", null, tok);
    assert.equal(pro.body.data.verified, true);
    assert.equal(pro.body.data.subscriptionStatus, "none", "verification must NOT touch subscription");
  });

  it("request-information sets needs_info with a note", async () => {
    const created = await request("POST", "/verifications", { professionalId: "PRO-5000", level: "professionnel" }, tok);
    const vrId = created.body.data.id;
    const info = await request("POST", "/verifications/" + vrId + "/request-information", { note: "Pièce manquante" }, tok);
    assert.equal(info.status, 200);
    assert.equal(info.body.data.status, "needs_info");
    assert.equal(info.body.data.infoRequested, "Pièce manquante");
  });

  it("reject sets status rejected with a reason", async () => {
    const created = await request("POST", "/verifications", { professionalId: "PRO-5000", level: "identity" }, tok);
    const vrId = created.body.data.id;
    const rej = await request("POST", "/verifications/" + vrId + "/reject", { reason: "Documents invalides" }, tok);
    assert.equal(rej.status, 200);
    assert.equal(rej.body.data.status, "rejected");
    assert.equal(rej.body.data.reason, "Documents invalides");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PAYMENTS — bank-transfer create / confirm / reject / request info / badges
// ═════════════════════════════════════════════════════════════════════════════
describe("E2E Payments", () => {
  const tok = makeToken(ROLES.finance);
  let payId, proId;

  it("creates a MOROCCAN_BANK_TRANSFER payment with the DB amount", async () => {
    const pro = await request("POST", "/professionals", { name: "Paiement Pro", job: "plombier", city: "Fes" }, tok);
    proId = pro.body.data.id;
    const r = await request("POST", "/payments", { professionalId: proId, planId: "PLAN-GOLD" }, tok);
    assert.equal(r.status, 201);
    assert.equal(r.body.data.method, "bank_transfer");
    assert.equal(r.body.data.status, "pending");
    assert.equal(r.body.data.amount, 199);
    payId = r.body.data.id;
    assert.match(payId, /^PAY-\d+$/);
  });

  it("confirming activates the subscription but NEVER grants the badge", async () => {
    const confirm = await request("POST", "/admin/payments/" + payId + "/confirm", {}, tok);
    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.data.status, "confirmed");

    // finance = actor of the payment, but reading the professional requires an
    // account with professionals.view.
    const reader = makeToken(ROLES.super_admin);
    const pro = await request("GET", "/admin/professionals/" + proId, null, reader);
    assert.equal(pro.status, 200);
    assert.equal(pro.body.data.subscriptionStatus, "active", "payment activates subscription");
    assert.notEqual(pro.body.data.verificationStatus, "approved", "payment must NOT grant verification badge");
  });

  it("confirming the same payment twice is idempotent (409)", async () => {
    const again = await request("POST", "/admin/payments/" + payId + "/confirm", {}, tok);
    assert.equal(again.status, 409);
  });

  it("rejects a payment (reason required)", async () => {
    const pay2 = await request("POST", "/payments", { professionalId: proId, planId: "PLAN-VER" }, tok);
    const id2 = pay2.body.data.id;

    const noReason = await request("POST", "/admin/payments/" + id2 + "/reject", {}, tok);
    assert.equal(noReason.status, 400, "reject requires a reason");

    const reject = await request("POST", "/admin/payments/" + id2 + "/reject", { reason: "Paiement introuvable" }, tok);
    assert.equal(reject.status, 200);
    assert.equal(reject.body.data.status, "rejected");
    assert.equal(reject.body.data.rejectionReason, "Paiement introuvable");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REVIEWS — create / edit / publish / hide / flag moderation lifecycle
// ═════════════════════════════════════════════════════════════════════════════
describe("E2E Reviews", () => {
  const userTok = makeToken({ id: "USR-1", role: "user", name: "User One" });
  const modTok = makeToken(ROLES.moderator);
  let proId, reviewId;

  it("posts a published review after a verified WhatsApp contact", async () => {
    proId = "PRO-5000";
    const rev = await request("POST", `/professionals/${proId}/reviews`, { rating: 4, comment: "Bien" }, userTok);
    assert.equal(rev.status, 201);
    assert.equal(rev.body.data.status, "published");
    assert.equal(rev.body.data.verifiedContact, true, "verified-contact badge flag must be present");
    reviewId = rev.body.data.id;
  });

  it("author can edit their review", async () => {
    const upd = await request("PATCH", `/reviews/${reviewId}`, { rating: 5 }, userTok);
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.rating, 5);
  });

  it("moderator flags then hides the review; gone from public list", async () => {
    const flag = await request("POST", `/admin/reviews/${reviewId}/flag`, { reason: "Inapproprié" }, modTok);
    assert.equal(flag.status, 200);
    assert.equal(flag.body.data.status, "flagged");

    const hide = await request("POST", `/admin/reviews/${reviewId}/hide`, {}, modTok);
    assert.equal(hide.status, 200);
    assert.equal(hide.body.data.status, "hidden");

    const list = await request("GET", `/professionals/${proId}/reviews`);
    assert.ok(!list.body.data.data.some((r) => r.id === reviewId), "hidden review must not be public");
  });

  it("moderator can publish a hidden review back", async () => {
    const pub = await request("POST", `/admin/reviews/${reviewId}/publish`, {}, modTok);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.data.status, "published");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS — create / resolve / reject / warn / suspend escalation
// ═════════════════════════════════════════════════════════════════════════════
describe("E2E Reports", () => {
  const userTok = makeToken({ id: "client-2", role: "user", name: "Client 2" });
  const modTok = makeToken(ROLES.moderator);
  let proId, reportId;

  it("creates a report against a professional", async () => {
    const created = await request("POST", "/professionals", { name: "Report Pro", job: "macon", city: "Fes" }, modTok);
    proId = created.body.data.id;
    const r = await request("POST", "/reports", { professionalId: proId, reason: "Retard", description: "Ne vient jamais" }, userTok);
    assert.equal(r.status, 201);
    reportId = r.body.data.id;
    assert.match(reportId, /^RP-\d+$/);
  });

  it("warns the professional and resolves the report", async () => {
    const warn = await request("POST", `/admin/reports/${reportId}/warn`, { note: "Avertissement" }, modTok);
    assert.equal(warn.status, 200);
    assert.equal(warn.body.data.status, "resolved");
    const pro = await request("GET", "/admin/professionals/" + proId, null, modTok);
    assert.equal(pro.body.data.warnReason, "Avertissement");
  });

  it("escalates to suspension via a new report", async () => {
    const r2 = await request("POST", "/reports", { professionalId: proId, reason: "Arnaque" }, userTok);
    const id2 = r2.body.data.id;
    const susp = await request("POST", `/admin/reports/${id2}/suspend`, { reason: "Fraude confirmée" }, modTok);
    assert.equal(susp.status, 200);
    assert.equal(susp.body.data.status, "resolved");
    const pro = await request("GET", "/admin/professionals/" + proId, null, modTok);
    assert.equal(pro.body.data.status, "suspended");
  });

  it("reject ignores a report", async () => {
    const r3 = await request("POST", "/reports", { professionalId: proId, reason: "Abusif" }, userTok);
    const id3 = r3.body.data.id;
    const rej = await request("POST", `/admin/reports/${id3}/reject`, { note: "Non fondé" }, modTok);
    assert.equal(rej.status, 200);
    assert.equal(rej.body.data.status, "ignored");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RBAC — the whole 5-role matrix denies unauthorized operations with 403
// ═════════════════════════════════════════════════════════════════════════════
describe("E2E RBAC matrix", () => {
  const R = (role) => makeToken(ROLES[role]);
  const t = ROLES.super_admin;

  it("finance cannot moderate reviews (403)", async () => {
    // USR-1 has a verified WhatsApp contact with PRO-5001, so this review
    // submission is legal; the forbidden part is the finance moderation.
    const rev = await request("POST", `/professionals/PRO-5001/reviews`, { rating: 5, comment: "ok" }, makeToken({ id: "USR-1", role: "user", name: "User One" }));
    const res = await request("POST", `/admin/reviews/${rev.body.data.id}/hide`, {}, R("finance"));
    assert.equal(res.status, 403);
  });

  it("moderator cannot confirm payments (403)", async () => {
    const pay = await request("POST", "/payments", { professionalId: "PRO-5000", planId: "PLAN-VER" }, R("admin"));
    const res = await request("POST", `/admin/payments/${pay.body.data.id}/confirm`, {}, R("moderator"));
    assert.equal(res.status, 403);
  });

  it("support cannot suspend professionals (403)", async () => {
    const res = await request("POST", "/admin/professionals/PRO-5000/suspend", { reason: "x" }, R("support"));
    assert.equal(res.status, 403);
  });

  it("admin can do everything (no 403)", async () => {
    const reports = await request("GET", "/admin/reports", null, R("admin"));
    assert.equal(reports.status, 200);
    const audit = await request("GET", "/admin/audit-logs", null, R("admin"));
    assert.equal(audit.status, 200);
  });

  it("super_admin can manage admin users and audit logs", async () => {
    const users = await request("GET", "/admin/admin-users", null, R("super_admin"));
    assert.equal(users.status, 200);
    assert.ok(Array.isArray(users.body.data));
    const audit = await request("GET", "/admin/audit-logs", null, R("super_admin"));
    assert.equal(audit.status, 200);
  });

  it("unauthenticated requests to any admin route return 401", async () => {
    for (const path of ["/admin/professionals", "/admin/payments", "/admin/reports", "/admin/audit-logs"]) {
      const res = await request("GET", path);
      assert.equal(res.status, 401, path);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Audit trail — every admin action is append-only recorded
// ═════════════════════════════════════════════════════════════════════════════
describe("E2E Audit trail", () => {
  it("collects audit entries for the e2e actions", async () => {
    const res = await request("GET", "/admin/audit-logs", null, makeToken(ROLES.super_admin));
    assert.equal(res.status, 200);
    const actions = res.body.data.map((e) => e.action);
    for (const expected of ["CREATE_PROFESSIONAL", "PROFESSIONAL_SUSPENDED", "PROFESSIONAL_ACTIVATED", "VERIFICATION_APPROVED", "PAYMENT_CONFIRMED", "PAYMENT_REJECTED", "REVIEW_FLAGGED", "REPORT_WARNED", "REPORT_SUSPENDED"]) {
      assert.ok(actions.includes(expected), "missing audit action " + expected);
    }
  });

  it("audit logs have no update/delete routes (append-only)", async () => {
    const del = await request("DELETE", "/admin/audit-logs/AL-1", null, makeToken(ROLES.super_admin));
    assert.equal(del.status, 404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Consistent error envelope
// ═════════════════════════════════════════════════════════════════════════════
describe("E2E error envelope", () => {
  it("unknown route => {success:false, error:{code,message}}", async () => {
    const res = await request("GET", "/nope");
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, "NOT_FOUND");
    assert.ok(res.body.error.message);
  });
});
