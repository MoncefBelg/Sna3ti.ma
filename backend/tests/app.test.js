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
    const url = new URL(path, baseUrl);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
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
    if (body) req.write(JSON.stringify(body));
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
      { id: "PLAN-VER",  code: "verified", name: "Vérifié", price: 499, active: true },
      { id: "PLAN-GOLD", code: "gold",     name: "Gold",    price: 999, active: true }
    ],
    category: [
      { id: "CAT-1", code: "plombier", label: "Plombier", icon: "🔧", active: true }
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
      { id: "NOTIF-1", title: "Test", message: "Hello", unread: true, createdAt: new Date() }
    ],
    auditLog: [],
    legalDocument: [
      { id: "legal-terms", slug: "terms", title: "CGV", content: "Terms content", published: true, updatedAt: new Date() }
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
    const res = await request("POST", "/admin/verification/VR-201/approve", {}, token);
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
    const res = await request("POST", "/admin/verification/VR-204/approve", {}, token);
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
    const res = await request("POST", "/admin/verification/VR-PLA1/approve", {}, token);
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
    const res = await request("POST", "/admin/verification/VR-CREJ/reject", { reason: "Documents illisibles" }, token);
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
    const res = await request("PATCH", "/admin/professionals/PRO-10295/suspend", { reason: "Plainte multiple" }, token);
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
    const res = await request("GET", "/public/categories");
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
  });

  it("GET /public/plans returns plans", async () => {
    const res = await request("GET", "/public/plans");
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
    assert.ok(actions.includes("CONFIRM_PAYMENT"),       "missing CONFIRM_PAYMENT");
    assert.ok(actions.includes("VERIFICATION_REJECTED"),  "missing VERIFICATION_REJECTED");
    assert.ok(actions.includes("SUSPEND_PROFESSIONAL"),   "missing SUSPEND_PROFESSIONAL");
  });
});