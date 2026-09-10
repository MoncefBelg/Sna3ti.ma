// REQ 59 — Admin notification coverage for every UI-originated event.
//
// Every action a visitor / professional / customer triggers from the UI that
// mutates state must surface as an admin notification (broadcast, userId null)
// visible at GET /admin/notifications. This file locks the contract per event:
//
//   registration create -> "Nouvelle demande d'inscription"    (type registration)
//   registration approve -> "Demande approuvée"                (type registration)
//   registration reject  -> "Demande rejetée"                  (type registration)
//   professional activate -> "Artisan activé"                  (type system)
//   professional suspend  -> "Artisan suspendu"                (type system)
//   verification create   -> "Nouvelle demande de vérification" (type verification)
//   verification approve  -> "Vérification approuvée"          (type verification)
//   verification reject   -> "Vérification rejetée"            (type verification)
//   payment create        -> "Nouveau paiement en attente"     (type payment)
//   payment confirm       -> "Paiement confirmé"               (type payment)
//   payment reject        -> "Paiement rejeté"                 (type payment)
//   report create         -> "Nouveau signalement"             (type report)
//   review auto-flagged   -> "Avis signalé"                    (type review)
//
// Broadcast notifications are admin-only: they carry userId null, so the
// public /notifications list (scoped to req.admin.id) never exposes them.
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
const superAdminToken = makeToken(SUPER);
const financeToken = makeToken(FINANCE);

const PLANS = [
  { id: "PLAN-FREE", code: "free", name: "Free", price: 0, active: true },
  { id: "PLAN-VER", code: "verified", name: "Vérifié", price: 99, active: true },
  { id: "PLAN-GOLD", code: "gold", name: "GOLD", price: 199, active: true }
];

function baseSeed(overrides = {}) {
  return {
    adminUser: [
      { id: "a-sa", name: "Super Admin", email: "sa@sna3ti.ma", role: "super_admin", status: "active", createdAt: new Date() },
      { id: "a-fi", name: "Finance", email: "fi@sna3ti.ma", role: "finance", status: "active", createdAt: new Date() }
    ],
    role: [{ id: "ROLE-SA", code: "super_admin", name: "Super Admin" }],
    plan: PLANS,
    category: overrides.category || [],
    professional: overrides.professionals || [],
    user: overrides.users || [],
    verificationRequest: overrides.verificationRequest || [],
    payment: overrides.payment || [],
    subscription: overrides.subscription || [],
    review: overrides.review || [],
    report: overrides.report || [],
    supportTicket: [],
    notification: overrides.notification || [],
    auditLog: overrides.auditLog || []
  };
}

function boot(seed) {
  const app = createApp({ db: createInMemoryDb(seed) });
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function adminNotifs(server) {
  const res = await request(server, "GET", "/admin/notifications", undefined, superAdminToken);
  assert.equal(res.status, 200, "admin notifications reachable");
  const list = Array.isArray(res.body.data) ? res.body.data : (res.body.data && res.body.data.data) || [];
  return res.body.data; // keep envelope shape for callers
}

function flatList(resBody) {
  return Array.isArray(resBody) ? resBody : (resBody && resBody.data) || [];
}

function byType(resBody, type) {
  return flatList(resBody).filter((n) => n && n.type === type);
}

// ─── Registration: create / approve / reject ─────────────────────────────────

describe("REQ 59 — registration events raise admin notifications", () => {
  let server;
  before(async () => {
    server = await boot(baseSeed());
  });
  after(() => { server.close(); });

  function payload(phone, plan) {
    return {
      firstName: "Karim", lastName: "El Amrani", phone,
      profession: "electricien", city: "casablanca", plan: plan || "free"
    };
  }

  it("registration create -> registration notification for the new ARQ", async () => {
    const res = await request(server, "POST", "/professional-requests", payload("+212600000001"));
    assert.equal(res.status, 201);
    const notifs = await adminNotifs(server);
    const regs = byType(notifs, "registration");
    const match = regs.find((n) => n.entityId === res.body.data.id);
    assert.ok(match, "a registration notification exists for the created request");
    assert.equal(match.entityType, "ProfessionalRequest");
    assert.ok(match.title.includes("demande"), "title is about a new application");
    assert.equal(match.userId, null, "broadcast (admin-only, no user scoping)");
    assert.equal(match.readAt, null);
  });

  it("registration approve -> notification, twice (create + approve)", async () => {
    const res = await request(server, "POST", "/professional-requests", payload("+212600000002"));
    assert.equal(res.status, 201);
    const approved = await request(server, "POST", `/admin/professional-requests/${res.body.data.id}/approve`, undefined, superAdminToken);
    assert.equal(approved.status, 200);
    const notifs = await adminNotifs(server);
    const regs = byType(notifs, "registration");
    const forRequest = regs.filter((n) => n.entityId === res.body.data.id);
    assert.ok(forRequest.length >= 2, "create + approve notifications both exist");
    assert.ok(forRequest.some((n) => n.title.includes("approuvée")), "approve title present");
  });

  it("registration reject -> rejection notification", async () => {
    const res = await request(server, "POST", "/professional-requests", payload("+212600000003"));
    assert.equal(res.status, 201);
    const rejected = await request(server, "POST", `/admin/professional-requests/${res.body.data.id}/reject`,
      { reason: "Pièce manquante" }, superAdminToken);
    assert.equal(rejected.status, 200);
    const notifs = await adminNotifs(server);
    const regs = byType(notifs, "registration");
    const match = regs.find((n) => n.entityId === res.body.data.id && n.title.includes("rejetée"));
    assert.ok(match, "reject notification present");
    assert.ok(match.message.includes("Pièce manquante"), "reason surfaced");
  });
});

// ─── Professional activate / suspend ─────────────────────────────────────────

describe("REQ 59 — professional activate/suspend raise admin notifications", () => {
  let server;
  before(async () => {
    server = await boot(baseSeed({
      professionals: [{
        id: "PRO-9001", name: "Hassan Test", job: "plombier", city: "Casablanca",
        status: "pending", package: "free", createdAt: new Date()
      }]
    }));
  });
  after(() => { server.close(); });

  it("activate -> 'Artisan activé' system notification", async () => {
    const res = await request(server, "POST", "/admin/professionals/PRO-9001/activate", undefined, superAdminToken);
    assert.equal(res.status, 200);
    const notifs = await adminNotifs(server);
    const match = flatList(notifs).find((n) => n.entityId === "PRO-9001" && n.title.includes("activé"));
    assert.ok(match, "activate notification present");
    assert.equal(match.entityType, "Professional");
  });

  it("suspend -> 'Artisan suspendu' system notification", async () => {
    const res = await request(server, "POST", "/admin/professionals/PRO-9001/suspend",
      { reason: "Manque de disponibilité" }, superAdminToken);
    assert.equal(res.status, 200);
    const notifs = await adminNotifs(server);
    const match = flatList(notifs).find((n) => n.entityId === "PRO-9001" && n.title.includes("suspendu"));
    assert.ok(match, "suspend notification present");
    assert.ok(match.message.includes("Manque de disponibilité"), "reason surfaced");
  });
});

// ─── Verification: create (identity) / approve / reject ──────────────────────

describe("REQ 59 — verification events raise admin notifications", () => {
  let server;
  before(async () => {
    server = await boot(baseSeed({
      professionals: [{
        id: "PRO-9002", name: "Yassine Test", job: "peintre", city: "Rabat",
        status: "active", package: "free", identityStatus: "pending",
        professionStatus: "pending", verificationStatus: "pending", verified: false, createdAt: new Date()
      }]
    }));
  });
  after(() => { server.close(); });

  it("identity verification create -> verification notification", async () => {
    const res = await request(server, "POST", "/verifications",
      { professionalId: "PRO-9002", level: "identity" }, superAdminToken);
    assert.equal(res.status, 201, "verification request created");
    const notifs = await adminNotifs(server);
    const match = byType(notifs, "verification").find((n) => n.entityId === res.body.data.id);
    assert.ok(match, "verification create notification present");
    assert.equal(match.entityType, "VerificationRequest");
  });

  it("verification approve -> 'Vérification approuvée' notification", async () => {
    const res = await request(server, "POST", "/verifications",
      { professionalId: "PRO-9002", level: "professionnel" }, superAdminToken);
    assert.equal(res.status, 201);
    const approved = await request(server, "POST", `/verifications/${res.body.data.id}/approve`, undefined, superAdminToken);
    assert.equal(approved.status, 200);
    const notifs = await adminNotifs(server);
    const match = byType(notifs, "verification").find((n) => n.entityId === res.body.data.id && n.title.includes("approuvée"));
    assert.ok(match, "verification approve notification present");
  });

  it("verification reject -> 'Vérification rejetée' notification", async () => {
    const res = await request(server, "POST", "/verifications",
      { professionalId: "PRO-9002", level: "identity" }, superAdminToken);
    assert.equal(res.status, 201);
    const rejected = await request(server, "POST", `/verifications/${res.body.data.id}/reject`,
      { reason: "CNI illisible" }, superAdminToken);
    assert.equal(rejected.status, 200);
    const notifs = await adminNotifs(server);
    const match = byType(notifs, "verification").find((n) => n.entityId === res.body.data.id && n.title.includes("rejetée"));
    assert.ok(match, "verification reject notification present");
  });
});

// ─── Payments: create / confirm / reject ─────────────────────────────────────

describe("REQ 59 — payment events raise admin notifications", () => {
  let server;
  before(async () => {
    server = await boot(baseSeed({
      professionals: [{
        id: "PRO-9003", name: "Sanae Test", job: "cuisiniere", city: "Marrakech",
        status: "active", package: "free", createdAt: new Date()
      }]
    }));
  });
  after(() => { server.close(); });

  it("payment create -> 'Nouveau paiement en attente' notification", async () => {
    const res = await request(server, "POST", "/payments",
      { professionalId: "PRO-9003", planId: "PLAN-GOLD", reference: "VIR-TEST-1" }, financeToken);
    assert.equal(res.status, 201, "payment created");
    const notifs = await adminNotifs(server);
    const match = byType(notifs, "payment").find((n) => n.entityId === res.body.data.id);
    assert.ok(match, "payment create notification present");
    assert.ok(match.title.includes("attente"), "pending-payment title");
    assert.equal(match.entityType, "Payment");
  });

  it("payment confirm -> 'Paiement confirmé' notification (in-transaction)", async () => {
    const confirmServer = await boot(baseSeed({
      professionals: [{
        id: "PRO-9003", name: "Sanae Test", job: "cuisiniere", city: "Marrakech",
        status: "active", package: "free", createdAt: new Date()
      }],
      payment: [{
        id: "PAY-9001", reference: "VIR-TEST-2", professionalId: "PRO-9003",
        planName: "GOLD", amount: 199, currency: "MAD", method: "bank_transfer", status: "pending", createdAt: new Date()
      }]
    }));
    try {
      const res = await request(confirmServer, "POST", "/admin/payments/PAY-9001/confirm", undefined, financeToken);
      assert.equal(res.status, 200, "payment confirmed");
      const notifs = await adminNotifs(confirmServer);
      const match = byType(notifs, "payment").find((n) => n.entityId === "PAY-9001" && n.title.includes("confirmé"));
      assert.ok(match, "payment confirm notification present (atomic with confirmation)");
    } finally {
      confirmServer.close();
    }
  });

  it("payment reject -> 'Paiement rejeté' notification", async () => {
    const rejectServer = await boot(baseSeed({
      professionals: [{
        id: "PRO-9003", name: "Sanae Test", job: "cuisiniere", city: "Marrakech",
        status: "active", package: "free", createdAt: new Date()
      }],
      payment: [{
        id: "PAY-9002", reference: "VIR-TEST-3", professionalId: "PRO-9003",
        planName: "GOLD", amount: 199, currency: "MAD", method: "bank_transfer", status: "pending", createdAt: new Date()
      }]
    }));
    try {
      const res = await request(rejectServer, "POST", "/admin/payments/PAY-9002/reject",
        { reason: "Virement non conforme" }, financeToken);
      assert.equal(res.status, 200, "payment rejected");
      const notifs = await adminNotifs(rejectServer);
      const match = byType(notifs, "payment").find((n) => n.entityId === "PAY-9002" && n.title.includes("rejeté"));
      assert.ok(match, "payment reject notification present");
    } finally {
      rejectServer.close();
    }
  });
});

// ─── Reports ─────────────────────────────────────────────────────────────────

describe("REQ 59 — report create raises an admin notification", () => {
  let server;
  let userToken;
  before(async () => {
    server = await boot(baseSeed({
      professionals: [{
        id: "PRO-9004", name: "Omar Test", job: "menuisier", city: "Fès",
        status: "active", package: "free", createdAt: new Date()
      }],
      users: [{ id: "USR-9001", name: "Client A", phone: "+212600000001", role: "user", status: "active", createdAt: new Date() }]
    }));
    userToken = makeToken({ id: "USR-9001", role: "user", name: "Client A" });
  });
  after(() => { server.close(); });

  it("report create -> 'Nouveau signalement' notification", async () => {
    const res = await request(server, "POST", "/reports",
      { professionalId: "PRO-9004", reason: "Retard répété", type: "service", description: "Ne répond plus" }, userToken);
    assert.equal(res.status, 201, "report created");
    const notifs = await adminNotifs(server);
    const match = byType(notifs, "report").find((n) => n.entityId === res.body.data.id);
    assert.ok(match, "report notification present");
    assert.equal(match.entityType, "Report");
    assert.ok(match.message.includes("Omar Test"), "professional name in message");
  });
});

// ─── Auto-flagged reviews ────────────────────────────────────────────────────

describe("REQ 59 — auto-flagged review raises an admin notification", () => {
  const NOW = Date.now();
  let server;
  let userToken;
  before(async () => {
    server = await boot({
      adminUser: [{ id: "a-sa", name: "Super Admin", email: "sa@sna3ti.ma", role: "super_admin", status: "active", createdAt: new Date() }],
      role: [{ id: "ROLE-SA", code: "super_admin", name: "Super Admin" }],
      plan: PLANS,
      category: [], region: [],
      professional: [
        { id: "PRO-9005", name: "Nabil Test", job: "maçon", city: "Tanger", status: "active", verified: false, rating: null, reviewsCount: 0, createdAt: new Date() },
        { id: "PRO-9006", name: "Autre Pro", job: "couvreur", city: "Tétouan", status: "active", verified: false, rating: null, reviewsCount: 0, createdAt: new Date() }
      ],
      user: [{
        id: "USR-9002", name: "Client B", phone: "+212600000002", role: "user", status: "active",
        createdAt: new Date(NOW - 60 * 60000) // very new account -> risk signal
      }],
      professionalContactInteraction: [{
        id: "INT-9001", customerId: "USR-9002", professionalId: "PRO-9005",
        channel: "WHATSAPP", source: "PROFILE", status: "CONFIRMED_CONTACT",
        customerConfirmed: true, customerConfirmedAt: new Date(NOW - 50000),
        reviewEligibleAt: new Date(NOW - 1000), riskScore: 0, riskFlags: [],
        lastContactAt: new Date(NOW - 50000), createdAt: new Date(NOW - 50000), updatedAt: new Date(NOW - 1000)
      }],
      review: [
        { id: "RV-9001", professionalId: "PRO-9006", userId: "USR-9002", customer: "Client B",
          rating: 5, comment: "Très sérieux", status: "published", verifiedContact: true,
          date: new Date(NOW - 3600000), createdAt: new Date(NOW - 3600000) },
        { id: "RV-9002", professionalId: "PRO-9006", userId: "USR-9002", customer: "Client B",
          rating: 5, comment: "Bon travail", status: "published", verifiedContact: true,
          date: new Date(NOW - 7200000), createdAt: new Date(NOW - 7200000) },
        { id: "RV-9003", professionalId: "PRO-9006", userId: "USR-9002", customer: "Client B",
          rating: 5, comment: "Très rapide", status: "published", verifiedContact: true,
          date: new Date(NOW - 10800000), createdAt: new Date(NOW - 10800000) }
      ],
      payment: [], subscription: [], verificationRequest: [], matchRequest: [], report: [], supportTicket: [],
      notification: [], analyticsEvent: [], auditLog: [], legalDocument: []
    });
    userToken = makeToken({ id: "USR-9002", role: "user", name: "Client B" });
  });
  after(() => { server.close(); });

  it("identical comment on a new account -> flagged + 'Avis signalé' notification", async () => {
    const res = await request(server, "POST", "/professionals/PRO-9005/reviews",
      { rating: 5, comment: "Très sérieux" }, userToken);
    assert.equal(res.status, 201, "review created");
    assert.equal(res.body.data.status, "flagged", "risk score high enough to auto-flag");
    const notifs = await adminNotifs(server);
    const match = byType(notifs, "review").find((n) => n.entityId === res.body.data.id);
    assert.ok(match, "flagged-review notification present");
    assert.ok(match.title.includes("signalé"), "title flags the review");
    assert.equal(match.entityType, "Review");
  });
});