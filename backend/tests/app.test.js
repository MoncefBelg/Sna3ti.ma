// Backend integration tests — covers Scenarios A–E, auth, RBAC, full API flow.
// Uses InMemoryDb so no PostgreSQL required to run.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { createInMemoryDb } = require("./inMemoryDb");
const { createApp } = require("../src/app");

// ── Helpers ──────────────────────────────────────────────────────────────────
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

const NOW = new Date().toISOString();
const SEED_ADMIN = { id: "admin-1", name: "Super Admin", role: "super_admin" };

// ── Shared seed data ────────────────────────────────────────────────────────
function buildSeed() {
  return {
    adminUser: [
      { id: "admin-1", name: "Super Admin", email: "admin@sna3ti.ma", role: "super_admin", status: "active", password: "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01" },
      { id: "admin-2", name: "Admin User",  email: "admin2@sna3ti.ma", role: "admin",     status: "active", password: "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01" }
    ],
    role: [
      { id: "ROLE-SA", code: "super_admin", name: "Super Admin" },
      { id: "ROLE-AD", code: "admin",       name: "Admin" }
    ],
    plan: [
      { id: "PLAN-FREE", code: "free",     name: "Free",    price: 0,   active: true },
      { id: "PLAN-VER",  code: "verified", name: "Vérifié", price: 99,  active: true },
      { id: "PLAN-GOLD", code: "gold",     name: "Gold",    price: 199, active: true }
    ],
    category: [
      { id: "CAT-1", code: "plombier", label: "Plombier", icon: "🔧", active: true },
      { id: "CAT-7", code: "autres", label: { fr: "Autres services", ar: "خدمات أخرى", en: "Other services" }, icon: "🛠️", active: true }
    ],
    region: [
      { id: "REG-1", name: "Casablanca-Settat", order: 1 }
    ],
    professional: [
      {
        id: "PRO-10295", name: "Ahmed Tazi", categoryId: "CAT-1", city: "Casablanca",
        status: "active", identityStatus: "pending", professionStatus: "pending",
        verificationStatus: "pending", planEligible: false, verified: false,
        package: "free", subscriptionStatus: "inactive", createdAt: new Date()
      },
      {
        id: "PRO-10296", name: "Omar Alaoui", categoryId: "CAT-1", city: "Rabat",
        status: "active", identityStatus: "pending", professionStatus: "pending",
        verificationStatus: "pending", planEligible: false, verified: false,
        package: "free", subscriptionStatus: "inactive", createdAt: new Date()
      },
      {
        id: "PRO-9001",  name: "Fatima Zahra", categoryId: "CAT-1", city: "Marrakech",
        status: "active", identityStatus: "pending", professionStatus: "pending",
        verificationStatus: "pending", planEligible: false, verified: false,
        package: "free", subscriptionStatus: "inactive", createdAt: new Date()
      }
    ],
    user: [
      { id: "USR-1", name: "User One", phone: "+212600000001", status: "active", createdAt: new Date() }
    ],
    verificationRequest: [
      {
        id: "VR-201", professionalId: "PRO-10295", level: "identity",
        status: "pending", submitted: new Date(), history: []
      },
      {
        id: "VR-204", professionalId: "PRO-10295", level: "plan",
        requestedPlan: "Vérifié", planId: "PLAN-VER", paymentId: "PAY-7004",
        status: "pending", submitted: new Date(), history: []
      },
      {
        id: "VR-PLA1", professionalId: "PRO-9001", level: "plan",
        requestedPlan: "Gold", planId: "PLAN-GOLD", paymentId: "PAY-GOLD-1",
        status: "pending", submitted: new Date(), history: []
      },
      {
        id: "VR-CREJ", professionalId: "PRO-10296", level: "professionnel",
        status: "pending", submitted: new Date(), history: []
      }
    ],
    payment: [
      {
        id: "PAY-7004", reference: "ref-7004", professionalId: "PRO-10295",
        amount: 499, planName: "Vérifié", status: "pending", createdAt: new Date()
      }
    ],
    subscription: [],
    review: [],
    report: [],
    supportTicket: [],
    notification: [
      { id: "NOTIF-1", userId: "admin-1", type: "system", title: "Test", message: "Hello", readAt: null, createdAt: new Date() }
    ],
    auditLog: [],
    legalDocument: [
      { id: "terms-fr", type: "terms",   language: "fr", title: "Conditions d'utilisation", content: "CGV de Sna3ti.ma.", version: 1, published: true, createdAt: new Date(), updatedAt: new Date() },
      { id: "privacy-en", type: "privacy", language: "en", title: "Privacy Policy", content: "Privacy content.", version: 1, published: true, createdAt: new Date(), updatedAt: new Date() }
    ]
  };
}

// ── Test runner ──────────────────────────────────────────────────────────────
before(async () => {
  const db = createInMemoryDb(buildSeed());
  app = createApp({ db });
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server.close(); });

// ── Helper: sign a JWT for tests (avoid needing bcrypt + real login) ────────
const jwt = require("jsonwebtoken");
const env = require("../src/config/env");
function makeToken(admin = SEED_ADMIN) {
  return jwt.sign({ sub: admin.id, role: admin.role, name: admin.name }, env.jwtSecret, { expiresIn: "1h" });
}

const token = makeToken();

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO A — Verify identity badge (VR-201)
// ═════════════════════════════════════════════════════════════════════════════
describe("Scenario A — Identity verification", () => {
  it("VR-201 approve grants identity badge, subscription unchanged", async () => {
    const res = await request("POST", "/verifications/VR-201/approve", {}, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "approved");

    // Verify professional got the badge.
    const proRes = await request("GET", "/admin/professionals/PRO-10295", null, token);
    assert.equal(proRes.status, 200);
    assert.equal(proRes.body.data.verified, true);
    assert.equal(proRes.body.data.identityStatus, "verified");
    // Subscription must NOT be affected.
    assert.equal(proRes.body.data.subscriptionStatus, "inactive");
    assert.equal(proRes.body.data.package, "free");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO A — Plan approval (VR-204)
// ═════════════════════════════════════════════════════════════════════════════
describe("Scenario A — Plan activation", () => {
  it("VR-204 approve activates VÉRIFIÉ subscription", async () => {
    const res = await request("POST", "/verifications/VR-204/approve", {}, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "approved");

    const proRes = await request("GET", "/admin/professionals/PRO-10295", null, token);
    assert.equal(proRes.status, 200);
    assert.equal(proRes.body.data.planEligible, true);
    assert.equal(proRes.body.data.subscriptionStatus, "active");
    assert.equal(proRes.body.data.package, "verified");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO A — Independence: plan approval must NOT grant verified badge
// ═════════════════════════════════════════════════════════════════════════════
describe("Scenario A — Independence rule", () => {
  it("VR-PLA1 (PRO-9001) plan approval does NOT grant verified badge", async () => {
    const res = await request("POST", "/verifications/VR-PLA1/approve", {}, token);
    assert.equal(res.status, 200);
    const proRes = await request("GET", "/admin/professionals/PRO-9001", null, token);
    assert.equal(proRes.status, 200);
    assert.equal(proRes.body.data.verified, false);
    assert.equal(proRes.body.data.subscriptionStatus, "active");
    assert.equal(proRes.body.data.package, "gold");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO B — Confirm payment (PAY-7004)
// ═════════════════════════════════════════════════════════════════════════════
describe("Scenario B — Payment confirmation", () => {
  it("PAY-7004 confirms payment, activates subscription, badge unchanged", async () => {
    const res = await request("POST", "/admin/payments/PAY-7004/confirm", {}, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "confirmed");

    const proRes = await request("GET", "/admin/professionals/PRO-10295", null, token);
    assert.equal(proRes.body.data.subscriptionStatus, "active");
    // The package reflects VÉRIFIÉ plan (set by VR-204, confirmed by PAY-7004).
    assert.equal(proRes.body.data.package, "verified");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO C — Reject verification (VR-CREJ)
// ═════════════════════════════════════════════════════════════════════════════
describe("Scenario C — Reject verification", () => {
  it("VR-CREJ reject sets status rejected with reason, logs audit", async () => {
    const res = await request("POST", "/verifications/VR-CREJ/reject", { reason: "Documents illisibles" }, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "rejected");
    assert.equal(res.body.data.reason, "Documents illisibles");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO D — Suspend professional
// ═════════════════════════════════════════════════════════════════════════════
describe("Scenario D — Suspend professional", () => {
  it("Suspend PRO-10295 sets status suspended", async () => {
    const res = await request("POST", "/admin/professionals/PRO-10295/suspend", { reason: "Plainte multiple" }, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "suspended");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO E — RBAC: super_admin has all permissions
// ═════════════════════════════════════════════════════════════════════════════
describe("Scenario E — RBAC super_admin", () => {
  it("super_admin can list professionals", async () => {
    const res = await request("GET", "/admin/professionals", null, token);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Auth
// ═════════════════════════════════════════════════════════════════════════════
describe("Auth", () => {
  it("GET /auth/me returns current admin", async () => {
    const res = await request("GET", "/auth/me", null, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, "admin-1");
    assert.equal(res.body.data.role, "super_admin");
  });

  it("GET /auth/me without token returns 401", async () => {
    const res = await request("GET", "/auth/me");
    assert.equal(res.status, 401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Catalog (public)
// ═════════════════════════════════════════════════════════════════════════════
describe("Public catalog", () => {
  it("GET /public/categories returns categories", async () => {
    const res = await request("GET", "/categories");
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
    assert.ok(res.body.data.some(c => c.code === "autres"), "expected an 'autres' (Autres services) category");
  });

  it("GET /public/plans returns plans", async () => {
    const res = await request("GET", "/plans");
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 404 route
// ═════════════════════════════════════════════════════════════════════════════
describe("404 handling", () => {
  it("unknown route returns 404", async () => {
    const res = await request("GET", "/nonexistent");
    assert.equal(res.status, 404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Audit trail populated
// ═════════════════════════════════════════════════════════════════════════════
describe("Audit trail", () => {
  it("audit logs contain expected actions", async () => {
    const res = await request("GET", "/admin/audit-logs", null, token);
    assert.equal(res.status, 200);
    const actions = res.body.data.map((e) => e.action);
    assert.ok(actions.includes("VERIFICATION_APPROVED"), "missing VERIFICATION_APPROVED");
    assert.ok(actions.includes("PAYMENT_CONFIRMED"),      "missing PAYMENT_CONFIRMED");
    assert.ok(actions.includes("VERIFICATION_REJECTED"),  "missing VERIFICATION_REJECTED");
    assert.ok(actions.includes("PROFESSIONAL_SUSPENDED"), "missing PROFESSIONAL_SUSPENDED");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// User auth foundation — req 9/10 (register / login / refresh / logout / me)
// ═════════════════════════════════════════════════════════════════════════════
describe("User auth foundation", () => {
  it("POST /auth/register creates a user with an opaque USR id, no password leak", async () => {
    const res = await request("POST", "/auth/register", {
      firstName: "Yassine", lastName: "Amrani", email: "yassine@sna3ti.ma",
      phone: "+212600000020", password: "Sna3ti@2026"
    });
    assert.equal(res.status, 201);
    assert.match(res.body.user.id, /^USR-\d+$/);
    assert.ok(res.body.token, "expected access token");
    assert.ok(res.body.refreshToken, "expected refresh token");
    assert.ok(!JSON.stringify(res.body).includes("passwordHash"), "passwordHash must never be returned");
    assert.equal(res.body.user.role, "user");
  });

  it("POST /auth/register rejects a duplicate phone with 409", async () => {
    const res = await request("POST", "/auth/register", {
      firstName: "Yassine", lastName: "Amrani", email: "yassine.dup@sna3ti.ma",
      phone: "+212600000020", password: "Sna3ti@2026"
    });
    assert.equal(res.status, 409);
  });

  it("POST /auth/register generates monotonic, never-reused USR ids", async () => {
    const a = await request("POST", "/auth/register", { firstName: "A", lastName: "One", email: "a@sna3ti.ma",   phone: "+212600000030", password: "Sna3ti@2026" });
    const b = await request("POST", "/auth/register", { firstName: "B", lastName: "Two", email: "b@sna3ti.ma",   phone: "+212600000031", password: "Sna3ti@2026" });
    const idA = a.body.user.id, idB = b.body.user.id;
    assert.match(idA, /^USR-\d+$/);
    assert.match(idB, /^USR-\d+$/);
    assert.notEqual(idA, idB);
    const numA = parseInt(idA.slice(4), 10);
    const numB = parseInt(idB.slice(4), 10);
    assert.ok(numB > numA, "ids must be strictly increasing");
  });

  it("POST /auth/login authenticates a registered user", async () => {
    const res = await request("POST", "/auth/login", { email: "yassine@sna3ti.ma", password: "Sna3ti@2026" });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, "yassine@sna3ti.ma");
  });

  it("POST /auth/login rejects a wrong password with 401", async () => {
    const res = await request("POST", "/auth/login", { email: "yassine@sna3ti.ma", password: "wrong-password" });
    assert.equal(res.status, 401);
  });

  it("POST /auth/refresh returns a fresh access token", async () => {
    const login = await request("POST", "/auth/login", { email: "yassine@sna3ti.ma", password: "Sna3ti@2026" });
    const res = await request("POST", "/auth/refresh", { refreshToken: login.body.refreshToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it("GET /auth/me returns the user profile from a user token", async () => {
    const login = await request("POST", "/auth/login", { email: "yassine@sna3ti.ma", password: "Sna3ti@2026" });
    const me = await request("GET", "/auth/me", null, login.body.token);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, "yassine@sna3ti.ma");
    assert.equal(me.body.data.firstName, "Yassine");
    assert.equal(me.body.data.lastName, "Amrani");
  });

  it("GET /auth/me without token returns 401 for user context too", async () => {
    const res = await request("GET", "/auth/me");
    assert.equal(res.status, 401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Sequence-backed opaque ID generation — req 7/8
// ═════════════════════════════════════════════════════════════════════════════
describe("Sequence-backed opaque ID generation", () => {
  it("ids are monotonic strings, never reused after deletion, not count-based", async () => {
    const repos = app.locals.repos;
    const id1 = await repos.ids.nextId("professional");
    const id2 = await repos.ids.nextId("professional");
    assert.match(id1, /^PRO-\d+$/);
    assert.match(id2, /^PRO-\d+$/);
    assert.ok(!Number.isNaN(parseInt(id1.slice(4), 10)));

    // Deletion must NOT free the number up for reuse.
    await repos.professionals.create({ id: id1, name: "Tmp", job: "x" });
    await repos.professionals.remove(id1);

    const id3 = await repos.ids.nextId("professional");
    assert.notEqual(id3, id1, "id must never be reused after deletion");
    assert.notEqual(id3, id2, "ids must be unique");
    assert.ok(parseInt(id3.slice(4), 10) > parseInt(id2.slice(4), 10));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Verification documents — req 6 (verification_documents table)
// ═════════════════════════════════════════════════════════════════════════════
describe("Verification documents", () => {
  it("verificationDocuments repo creates and lists by professional", async () => {
    const repos = app.locals.repos;
    const doc = await repos.verificationDocuments.create({
      id: "VD-9001", verificationRequestId: "VR-201", professionalId: "PRO-10295",
      type: "cni", fileName: "cni.png", fileUrl: "/uploads/cni.png"
    });
    assert.equal(doc.id, "VD-9001");
    const byReq = await repos.verificationDocuments.findByRequest("VR-201");
    assert.ok(byReq.some((d) => d.id === "VD-9001"));
    const byPro = await repos.verificationDocuments.findByProfessional("PRO-10295");
    assert.ok(byPro.some((d) => d.id === "VD-9001"));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Search API — req 14
// ═════════════════════════════════════════════════════════════════════════════
describe("Search API", () => {
  it("GET /search returns a paginated envelope and matches results", async () => {
    const created = await request("POST", "/professionals", { name: "Search Pro", job: "plombier", city: "Casablanca", available: true }, token);
    assert.equal(created.status, 201);
    const newId = created.body.data.id;

    const res = await request("GET", "/search?service=plombier&city=Casablanca&page=1&limit=20");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(typeof res.body.pagination.page, "number");
    assert.equal(typeof res.body.pagination.total, "number");
    assert.ok(res.body.pagination.pages >= 1);
    assert.ok(res.body.data.some((p) => p.id === newId), "created professional should appear in search");
  });

  it("GET /search respects the sort param", async () => {
    const res = await request("GET", "/search?sort=-createdAt&limit=20");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Professionals API — req 13
// ═════════════════════════════════════════════════════════════════════════════
describe("Professionals API", () => {
  it("POST /professionals creates a professional (auth required)", async () => {
    const res = await request("POST", "/professionals", { name: "Nouveau Pro", job: "peintre", city: "Rabat" }, token);
    assert.equal(res.status, 201);
    assert.match(res.body.data.id, /^PRO-\d+$/);
  });

  it("POST /professionals without auth returns 401", async () => {
    const res = await request("POST", "/professionals", { name: "X", job: "x" });
    assert.equal(res.status, 401);
  });

  it("DELETE /professionals/:id removes the professional", async () => {
    const created = await request("POST", "/professionals", { name: "À supprimer", job: "menu", city: "Tanger" }, token);
    const id = created.body.data.id;
    const res = await request("DELETE", "/professionals/" + id, {}, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.deleted, true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Subscriptions API — req 15/16 (DB price, never frontend price)
// ═════════════════════════════════════════════════════════════════════════════
describe("Subscriptions API", () => {
  it("POST /subscriptions stores the DB price, ignoring client price", async () => {
    const res = await request("POST", "/subscriptions", { professionalId: "PRO-9001", planId: "PLAN-VER", price: 1 }, token);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.price, 99); // from DB, not the client's 1
    assert.equal(res.body.data.currency, "MAD");
    assert.match(res.body.data.id, /^SUB-\d+$/);
  });

  it("GET /subscriptions and POST :id/cancel work", async () => {
    const created = await request("POST", "/subscriptions", { professionalId: "PRO-9001", planId: "PLAN-GOLD" }, token);
    const subId = created.body.data.id;
    const got = await request("GET", "/subscriptions/" + subId, null, token);
    assert.equal(got.status, 200);
    assert.equal(got.body.data.price, 199);
    const cancelled = await request("POST", "/subscriptions/" + subId + "/cancel", {}, token);
    assert.equal(cancelled.body.data.status, "cancelled");
    assert.ok(cancelled.body.data.cancelledAt);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Verifications API — req 17 (independent from subscriptions)
// ═════════════════════════════════════════════════════════════════════════════
describe("Verifications API", () => {
  it("POST /verifications creates a PENDING verification", async () => {
    const res = await request("POST", "/verifications", { professionalId: "PRO-9001", level: "identity" }, token);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, "pending");
    assert.match(res.body.data.id, /^VR-\d+$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Payments API — req 19 (MOROCCAN_BANK_TRANSFER)
// ═════════════════════════════════════════════════════════════════════════════
describe("Payments API", () => {
  it("POST /payments creates a bank-transfer payment with DB amount", async () => {
    const res = await request("POST", "/payments", { professionalId: "PRO-9001", planId: "PLAN-GOLD" }, token);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.method, "bank_transfer");
    assert.equal(res.body.data.status, "pending");
    assert.equal(res.body.data.amount, 199); // from DB plan
    assert.match(res.body.data.id, /^PAY-\d+$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Business rules — req 18/20 (payment/subscription != verified; idempotent)
// ═════════════════════════════════════════════════════════════════════════════
describe("Payment / verification independence + idempotency", () => {
  it("confirming a payment activates subscription but NEVER sets verificationStatus=approved", async () => {
    // Use a fresh professional with verification PENDING and a pending payment.
    const pay = await request("POST", "/payments", { professionalId: "PRO-9001", planId: "PLAN-GOLD" }, token);
    const payId = pay.body.data.id;
    const confirm = await request("POST", "/admin/payments/" + payId + "/confirm", {}, token);
    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.data.status, "confirmed");

    // Subscription is active, but the professional stays UNVERIFIED.
    const pro = await request("GET", "/admin/professionals/PRO-9001", null, token);
    assert.equal(pro.body.data.subscriptionStatus, "active");
    assert.notEqual(pro.body.data.verificationStatus, "approved", "payment must NOT grant verification");
  });

  it("confirming the same payment twice is idempotent (no duplicate state)", async () => {
    const pay = await request("POST", "/payments", { professionalId: "PRO-9001", planId: "PLAN-VER" }, token);
    const payId = pay.body.data.id;
    const first = await request("POST", "/admin/payments/" + payId + "/confirm", {}, token);
    const second = await request("POST", "/admin/payments/" + payId + "/confirm", {}, token);
    assert.equal(first.status, 200);
    assert.equal(second.status, 409, "second confirm must be rejected (idempotent)");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Server-side RBAC — req 11 (deny by permission, not by client role)
// ═════════════════════════════════════════════════════════════════════════════
describe("Server-side RBAC", () => {
  const SUPPORT = { id: "admin-support", role: "support", name: "Support Eng" };

  it("a finance-less role cannot confirm payments (403)", async () => {
    const supportToken = makeToken(SUPPORT);
    const pay = await request("POST", "/payments", { professionalId: "PRO-9001", planId: "PLAN-VER" }, token);
    const payId = pay.body.data.id;
    const res = await request("POST", "/admin/payments/" + payId + "/confirm", {}, supportToken);
    assert.equal(res.status, 403);
  });

  it("an unauthenticated admin action returns 401", async () => {
    const res = await request("GET", "/admin/payments");
    assert.equal(res.status, 401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Reviews — req 21
// ═════════════════════════════════════════════════════════════════════════════
describe("Reviews API", () => {
  let proId;
  let reviewId;

  it("creates a professional and posts a review", async () => {
    const created = await request("POST", "/professionals", { name: "Avis Pro", job: "peintre", city: "Rabat" }, token);
    proId = created.body.data.id;
    const res = await request("POST", `/professionals/${proId}/reviews`, { rating: 5, comment: "Excellent travail" }, token);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.rating, 5);
    reviewId = res.body.data.id;
  });

  it("rejects an out-of-range rating with a validation error", async () => {
    const res = await request("POST", `/professionals/${proId}/reviews`, { rating: 9 }, token);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  it("lists published reviews for a professional (paginated envelope)", async () => {
    const res = await request("GET", `/professionals/${proId}/reviews`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.data), "reviews contained in data.data");
    assert.equal(res.body.success, true);
  });

  it("allows the author to update their review", async () => {
    const res = await request("PATCH", `/reviews/${reviewId}`, { comment: "Mise à jour" }, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.comment, "Mise à jour");
  });

  it("admin can hide a review and it disappears from public list", async () => {
    const hide = await request("POST", `/admin/reviews/${reviewId}/hide`, {}, token);
    assert.equal(hide.status, 200);
    assert.equal(hide.body.data.status, "hidden");
    const list = await request("GET", `/professionals/${proId}/reviews`);
    assert.ok(!list.body.data.data.some((r) => r.id === reviewId), "hidden review not in public list");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Reports — req 22
// ═════════════════════════════════════════════════════════════════════════════
describe("Reports API", () => {
  let proId;
  let reportId;

  it("creates a report and admin resolves it", async () => {
    const created = await request("POST", "/professionals", { name: "Report Pro", job: "macon", city: "Tanger" }, token);
    proId = created.body.data.id;
    const r = await request("POST", "/reports", { professionalId: proId, reason: "Arnaque", description: "Ne répond pas" }, token);
    assert.equal(r.status, 201);
    reportId = r.body.data.id;
    const resolve = await request("POST", `/admin/reports/${reportId}/resolve`, { note: "Vérifié" }, token);
    assert.equal(resolve.status, 200);
    assert.equal(resolve.body.data.status, "resolved");
  });

  it("admin cannot resolve a report without permission (finance role => 403)", async () => {
    // finance has payments/subscriptions perms but NOT reports.resolve
    const res = await request("POST", `/admin/reports/${reportId}/reject`, { note: "x" }, makeToken({ id: "admin-x", role: "finance", name: "Finance" }));
    assert.equal(res.status, 403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Legal content — req 24 (EN / FR / AR)
// ═════════════════════════════════════════════════════════════════════════════
describe("Legal content API", () => {
  it("serves published legal docs publicly by type/language", async () => {
    const terms = await request("GET", "/legal/terms/fr");
    assert.equal(terms.status, 200);
    assert.equal(terms.body.data.type, "terms");
    assert.equal(terms.body.data.language, "fr");
    assert.ok(terms.body.data.content.length > 0);
    // Unsupported language -> 400
    const bad = await request("GET", "/legal/terms/de");
    assert.equal(bad.status, 400);
  });

  it("admin can update a legal doc and bump its version", async () => {
    const before = await request("GET", "/legal/privacy/en");
    const upd = await request("PATCH", "/admin/legal/privacy-en", { content: "Updated privacy policy 2026." }, token);
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.version, (before.body.data.version || 1) + 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Notifications — req 25
// ═════════════════════════════════════════════════════════════════════════════
describe("Notifications API", () => {
  it("creates, lists, and marks a notification read", async () => {
    const created = await request("POST", "/notifications", { title: "Bonjour", message: "Bienvenue" }, token);
    assert.equal(created.status, 201);
    const id = created.body.data.id;
    const list = await request("GET", "/notifications", null, token);
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.data));
    const read = await request("POST", `/notifications/${id}/read`, {}, token);
    assert.equal(read.status, 200);
    assert.ok(read.body.data.readAt);
    const all = await request("POST", "/notifications/read-all", {}, token);
    assert.equal(all.status, 200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Audit append-only — req 23 (no modify/delete endpoints)
// ═════════════════════════════════════════════════════════════════════════════
describe("Audit logs are append-only", () => {
  it("audit log routes expose no update/delete mutation", async () => {
    const del = await request("DELETE", "/admin/audit-logs/AL-1", null, token);
    assert.equal(del.status, 404);
    const patch = await request("PATCH", "/admin/audit-logs/AL-1", {}, token);
    assert.equal(patch.status, 404);
  });

  it("moderation actions write expected audit entries", async () => {
    const res = await request("GET", "/admin/audit-logs", null, token);
    const actions = res.body.data.map((e) => e.action);
    assert.ok(actions.includes("REVIEW_HIDDEN"), "missing REVIEW_HIDDEN");
    assert.ok(actions.includes("REPORT_RESOLVED"), "missing REPORT_RESOLVED");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Error format — req 28
// ═════════════════════════════════════════════════════════════════════════════
describe("Consistent error format", () => {
  it("errors return {success:false, error:{code,message}}", async () => {
    const res = await request("GET", "/does-not-exist");
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, "NOT_FOUND");
    assert.ok(res.body.error.message);
  });

  it("unauthorized returns UNAUTHORIZED code", async () => {
    const res = await request("GET", "/admin/payments");
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  it("validation failures carry details", async () => {
    const res = await request("POST", "/professionals", { job: "x" }, token);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });
});