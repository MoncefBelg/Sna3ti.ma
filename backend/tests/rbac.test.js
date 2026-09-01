// RBAC enforcement tests — Scenario E. Verifies the permission middleware
// blocks unauthorized resource access per role, server-side.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { createInMemoryDb } = require("./inMemoryDb");
const { createApp } = require("../src/app");
const jwt = require("jsonwebtoken");
const env = require("../src/config/env");

let server, baseUrl;
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const opts = { method, hostname: "127.0.0.1", port: server.address().port, path: url.pathname, headers: { "Content-Type": "application/json" } };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function tokenFor(role) { return jwt.sign({ sub: "x-"+role, role, name: role }, env.jwtSecret, { expiresIn: "1h" }); }

function buildSeed() {
  const now = new Date();
  return {
    adminUser: [], role: [],
    plan: [{ id: "PLAN-FREE", code: "free", name: "Free", price: 0, active: true }],
    category: [{ id: "CAT-1", code: "plombier", label: "Plombier", icon: "x", active: true }],
    region: [{ id: "REG-1", name: "R", order: 1 }],
    professional: [{ id: "PRO-1", name: "A", categoryId: "CAT-1", city: "C", status: "active", createdAt: now }],
    user: [], verificationRequest: [], payment: [], subscription: [],
    review: [], report: [], supportTicket: [], notification: [], auditLog: [], legalDocument: []
  };
}

before(async () => {
  const app = createApp({ db: createInMemoryDb(buildSeed()) });
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

describe("RBAC — Scenario E", () => {
  it("finance CAN read payments but CANNOT create admin users", async () => {
    const fin = tokenFor("finance");
    const read = await request("GET", "/admin/payments", null, fin);
    assert.equal(read.status, 200);
    const create = await request("POST", "/admin/admin-users", { name: "X" }, fin);
    assert.equal(create.status, 403);
  });

  it("moderator CAN approve verification but CANNOT manage payments", async () => {
    const mod = tokenFor("moderator");
    const approve = await request("GET", "/admin/verification", null, mod);
    assert.equal(approve.status, 200);
    const pay = await request("GET", "/admin/payments", null, mod);
    assert.equal(pay.status, 403);
  });

  it("support CANNOT approve verification (read-only reviewers)", async () => {
    const sup = tokenFor("support");
    const res = await request("POST", "/admin/verification/VR-1/approve", {}, sup);
    assert.equal(res.status, 403);
  });

  it("request without token returns 401", async () => {
    const res = await request("GET", "/admin/professionals");
    assert.equal(res.status, 401);
  });

  it("unknown role cannot access", async () => {
    const t = tokenFor("ghost");
    const res = await request("GET", "/admin/professionals", null, t);
    assert.equal(res.status, 403);
  });
});