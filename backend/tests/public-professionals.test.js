// Phase 1 — Public Professionals: anonymous GET /professionals + /professionals/:id.
// Verifies the public listing contract consumed by the frontend adapter
// (js/public-professionals.js): envelope shape, opaque id passthrough, active-only
// listing, no auth required, and 404 for unknown ids. Uses InMemoryDb like
// app.test.js, so no PostgreSQL is required.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { createInMemoryDb } = require("./inMemoryDb");
const { createApp } = require("../src/app");

// ── Helpers ──────────────────────────────────────────────────────────────────
let app, server;

function request(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL("/api/v1" + path, "http://127.0.0.1");
    const opts = { method, hostname: "127.0.0.1", port: server.address().port, path: url.pathname, headers: {} };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || "{}") }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

const NOW = Date.now();

// ── Seed data ────────────────────────────────────────────────────────────────
function buildSeed() {
  return {
    adminUser: [
      { id: "admin-1", name: "Super Admin", email: "admin@sna3ti.ma", role: "super_admin", status: "active", password: "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01" }
    ],
    role: [
      { id: "ROLE-SA", code: "super_admin", name: "Super Admin" }
    ],
    category: [
      { id: "CAT-1", code: "plombier", label: "Plombier", icon: "🔧", active: true },
      { id: "CAT-2", code: "electricien", label: "Électricien", icon: "⚡", active: true }
    ],
    professional: [
      // GOLD + verified → the highest hero tier (GOLD ≠ Vérifié is respected
      // by the frontend ranking; both booleans must survive the API verbatim).
      {
        id: "PRO-10295", name: "Ahmed Tazi", job: "Électricien", categoryId: "CAT-2",
        city: "Casablanca", area: "Maarif", phone: "+212600000001",
        description: "Installation et dépannage électrique.",
        status: "active", available: true,
        media: ["assets/img/sna3ti_logo.png"], services: ["electricite"],
        identityStatus: "approved", professionStatus: "approved",
        verificationStatus: "approved", planEligible: true, verified: true,
        package: "gold", rating: 4.8, reviewsCount: 32,
        createdAt: new Date(NOW + 1)
      },
      // Verified (non-gold) → second priority tier.
      {
        id: "PRO-10296", name: "Omar Alaoui", job: "Plombier", categoryId: "CAT-1",
        city: "Rabat", area: "Agdal", phone: "+212600000002",
        description: "Réparations de fuites et installations sanitaires.",
        status: "active", available: true,
        media: [], services: ["plomberie"],
        identityStatus: "approved", professionStatus: "approved",
        verificationStatus: "approved", planEligible: false, verified: true,
        package: "free", rating: 4.5, reviewsCount: 18,
        createdAt: new Date(NOW + 2)
      },
      // Free / unverified with NO rating and NO reviews → exercises the
      // frontend's null-safe rendering ("—", "Sur devis", "Contact et
      // coordonnées à venir").
      {
        id: "PRO-9001", name: "Fatima Zahra", job: "Peintre", categoryId: "CAT-1",
        city: "Marrakech", area: "Guéliz", phone: "+212600000003",
        description: "Peinture intérieure et extérieure.",
        status: "active", available: true,
        media: [], services: ["peinture"],
        identityStatus: "approved", professionStatus: "approved",
        verificationStatus: "pending", planEligible: false, verified: false,
        package: "free", rating: null, reviewsCount: 0,
        createdAt: new Date(NOW + 3)
      },
      // Inactive pros must NEVER appear in the public listing.
      { id: "PRO-7771", name: "Suspendu", job: "Maçon", city: "Tanger", status: "suspended", available: false, package: "free", verified: false, rating: 3.9, createdAt: new Date(NOW + 4) },
      { id: "PRO-7772", name: "En attente", job: "Menuisier", city: "Agadir", status: "pending", available: true, package: "free", verified: false, rating: null, createdAt: new Date(NOW + 5) }
    ],
    plan: [],
    region: [],
    user: [],
    professionalContactInteraction: [],
    verificationRequest: [],
    payment: [],
    subscription: [],
    review: [],
    report: [],
    supportTicket: [],
    notification: [],
    analyticsEvent: [],
    auditLog: [],
    legalDocument: [],
    adminAuditLog: []
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────
before(async () => {
  const db = createInMemoryDb(buildSeed());
  app = createApp({ db });
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
});

after(() => { server.close(); });

describe("GET /api/v1/professionals (public listing)", () => {
  it("is reachable anonymously (no auth token needed)", async () => {
    const res = await request("GET", "/professionals");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it("returns the paginated envelope with only ACTIVE professionals", async () => {
    const res = await request("GET", "/professionals");
    assert.ok(Array.isArray(res.body.data), "data must be an array");
    assert.equal(res.body.data.length, 3, "exactly the 3 active pros");
    assert.deepEqual(res.body.pagination, {
      page: 1, limit: 20, total: 3, pages: 1
    });

    const ids = res.body.data.map((p) => p.id).sort();
    assert.deepEqual(ids, ["PRO-10295", "PRO-10296", "PRO-9001"]);
    assert.ok(!ids.includes("PRO-7771"), "suspended pro must be excluded");
    assert.ok(!ids.includes("PRO-7772"), "pending pro must be excluded");
  });

  it("preserves opaque ids and the verification/package tier verbatim", async () => {
    const res = await request("GET", "/professionals");
    const gold = res.body.data.find((p) => p.id === "PRO-10295");
    assert.ok(gold, "GOLD pro present");
    assert.equal(typeof gold.id, "string");
    assert.equal(gold.id, "PRO-10295");
    assert.equal(gold.verified, true);
    assert.equal(gold.package, "gold");
    assert.equal(gold.rating, 4.8);
    assert.equal(gold.reviewsCount, 32);

    const verified = res.body.data.find((p) => p.id === "PRO-10296");
    assert.equal(verified.verified, true);
    assert.equal(verified.package, "free");
  });

  it("passes through null rating / zero reviews for honest UI rendering", async () => {
    const res = await request("GET", "/professionals");
    const free = res.body.data.find((p) => p.id === "PRO-9001");
    assert.equal(free.rating, null);
    assert.equal(free.reviewsCount, 0);
    assert.equal(free.verified, false);
  });
});

describe("GET /api/v1/professionals/:id (public detail)", () => {
  it("returns the professional by opaque id without auth", async () => {
    const res = await request("GET", "/professionals/PRO-10295");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, "PRO-10295");
    assert.equal(res.body.data.name, "Ahmed Tazi");
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request("GET", "/professionals/PRO-NOPE");
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });
});