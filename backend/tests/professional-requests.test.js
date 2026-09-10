// Account-free artisan onboarding (REQ 53 — intake) integration regression tests.
//
// Covers:
//   1. Public create -> 201, opaque ARQ- id, reference === id, status pending,
//      WhatsApp notification pending (no provider configured) — NOT a fake
//      activation.
//   2. Plan resolved server-side from the plan catalogue (client sends only a
//      plan code; planId/planName/planPrice come from the plan table).
//   3. Duplicate pending request for the same phone -> 409 (canonical +212).
//   4. Validation: invalid plan, missing required field, invalid phone -> 400.
//   5. No client status escalation: sent status/verified/subscriptionStatus/
//      planPrice are discarded; the stored state stays server-authoritative.
//   6. No auto-publication: the request never appears in the marketplace.
//   7. Admin read (list/detail) guarded by auth + RBAC (401/403/200).
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
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(buf.toString("utf8") || "{}") }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: buf.toString("utf8") }); }
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

let server;
let superAdminToken;
let financeToken;
let adminUser = { id: "a-1", name: "Super Admin", email: "a@x.ma", password: "x", role: "super_admin", status: "active" };
let financeUser = { id: "a-2", name: "Finance", email: "f@x.ma", password: "x", role: "finance", status: "active" };

const PLANS = [
  { id: "PLAN-FREE", code: "free", name: "Free", price: 0, active: true },
  { id: "PLAN-VER", code: "verified", name: "Vérifié", price: 99, active: true },
  { id: "PLAN-GOLD", code: "gold", name: "GOLD", price: 199, active: true }
];

function basePayload(overrides) {
  return {
    firstName: "Karim",
    lastName: "El Amrani",
    phone: "+212612345678",
    profession: "electricien",
    city: "casablanca",
    cityLabel: "Casablanca",
    description: "Travail soigné",
    price: 120,
    priceUnit: "DH",
    plan: "verified",
    ...(overrides || {})
  };
}

describe("Account-free artisan onboarding (REQ 53)", () => {
  before(async () => {
    const db = createInMemoryDb({ adminUser: [adminUser, financeUser], plan: PLANS });
    const app = createApp({ db });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    superAdminToken = makeToken(adminUser);
    financeToken = makeToken(financeUser);
  });

  after(() => {
    server.close();
  });

  it("public create stores an ARQ- request as pending, server-resolved plan, reference === id", async () => {
    const res = await request(server, "POST", "/professional-requests", basePayload());
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    const d = res.body.data;
    assert.match(d.id, /^ARQ-\d+$/);
    assert.equal(d.reference, d.id);
    assert.equal(d.status, "pending");
    assert.equal(d.phone, "+212612345678");
    // Plan resolution is server-side, from the catalogue.
    assert.equal(d.planId, "PLAN-VER");
    assert.equal(d.planCode, "verified");
    assert.equal(d.planName, "Vérifié");
    assert.equal(d.planPrice, 99);
    assert.equal(d.price, 120);
    assert.equal(d.firstName, "Karim");
    // WhatsApp is a channel only — pending when no provider is configured.
    assert.equal(d.notificationStatus.whatsapp, "pending");
  });

  it("free plan resolves to PLAN-FREE / 0 DH", async () => {
    const res = await request(server, "POST", "/professional-requests", basePayload({
      phone: "+212655123456", plan: "free"
    }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.planId, "PLAN-FREE");
    assert.equal(res.body.data.planPrice, 0);
  });

  it("duplicate pending request for the same phone -> 409 (canonical +212 vs 06)", async () => {
    const res = await request(server, "POST", "/professional-requests", basePayload({
      phone: "0612345678"
    }));
    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  it("invalid plan -> 400 (closed set enforced server-side)", async () => {
    const res = await request(server, "POST", "/professional-requests", basePayload({
      phone: "+212633000111", plan: "vip"
    }));
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it("missing required field -> 400", async () => {
    const res = await request(server, "POST", "/professional-requests", basePayload({
      phone: "+212644000222", lastName: ""
    }));
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it("invalid phone -> 400", async () => {
    const res = await request(server, "POST", "/professional-requests", basePayload({
      phone: "not-a-phone"
    }));
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it("client cannot escalate status/verification/subscription (fields discarded, server-authoritative)", async () => {
    const res = await request(server, "POST", "/professional-requests", basePayload({
      phone: "+212677123999",
      status: "active",
      verified: true,
      verificationStatus: "approved",
      subscriptionStatus: "active",
      role: "admin",
      planId: "PLAN-GOLD",
      planPrice: 0,
      planCode: "gold"
    }));
    assert.equal(res.status, 201);
    const d = res.body.data;
    assert.equal(d.status, "pending");
    assert.equal(d.verified, undefined);
    assert.equal(d.role, undefined);
    assert.equal(d.subscriptionStatus, undefined);
    // Client-supplied plan fields are ignored; the catalogue wins.
    assert.equal(d.planId, "PLAN-VER");
    assert.equal(d.planCode, "verified");
    assert.equal(d.planPrice, 99);
  });

  it("application is NEVER auto-published to the marketplace", async () => {
    await request(server, "POST", "/professional-requests", basePayload({ phone: "+212688444555" }));
    const res = await request(server, "GET", "/professionals?query=Karim");
    assert.equal(res.status, 200);
    const list = res.body.data && res.body.data.data ? res.body.data.data : res.body.data;
    assert.ok(Array.isArray(list));
    assert.equal(list.filter((p) => String(p.phone || "").includes("688444555")).length, 0);
  });

  it("admin list is 401 unauthenticated, 403 without permission, 200 with super_admin", async () => {
    const unauth = await request(server, "GET", "/admin/professional-requests");
    assert.equal(unauth.status, 401);
    const denied = await request(server, "GET", "/admin/professional-requests", undefined, financeToken);
    assert.equal(denied.status, 403);
    const auth = await request(server, "GET", "/admin/professional-requests", undefined, superAdminToken);
    assert.equal(auth.status, 200);
    assert.equal(auth.body.success, true);
    const list = auth.body.data;
    assert.ok(Array.isArray(list));
    assert.ok(list.some((r) => r.planCode === "verified" && r.status === "pending"));
  });

  it("admin detail is guarded and returns the request", async () => {
    const created = await request(server, "POST", "/professional-requests", basePayload({ phone: "+212699777888" }));
    const id = created.body.data.id;
    const unauth = await request(server, "GET", "/admin/professional-requests/" + id);
    assert.equal(unauth.status, 401);
    const denied = await request(server, "GET", "/admin/professional-requests/" + id, undefined, financeToken);
    assert.equal(denied.status, 403);
    const auth = await request(server, "GET", "/admin/professional-requests/" + id, undefined, superAdminToken);
    assert.equal(auth.status, 200);
    assert.equal(auth.body.data.id, id);
    const missing = await request(server, "GET", "/admin/professional-requests/ARQ-99999", undefined, superAdminToken);
    assert.equal(missing.status, 404);
  });

  it("admin list rejects an unknown status filter with 400", async () => {
    const res = await request(server, "GET", "/admin/professional-requests?status=bogus", undefined, superAdminToken);
    assert.equal(res.status, 400);
  });
});

describe("Admin registration approval (REQ 54)", () => {
  let adminToken;
  let moderatorToken;
  let supportToken;
  let createdIds = [];
  const adminUser2 = { id: "a-3", name: "Admin 2", email: "a2@x.ma", password: "x", role: "admin", status: "active" };
  const moderatorUser = { id: "a-4", name: "Mod", email: "m@x.ma", password: "x", role: "moderator", status: "active" };
  const supportUser = { id: "a-5", name: "Support", email: "s@x.ma", password: "x", role: "support", status: "active" };

  before(async () => {
    const db = createInMemoryDb({ adminUser: [adminUser, financeUser, adminUser2, moderatorUser, supportUser], plan: PLANS });
    const app = createApp({ db });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    adminToken = makeToken(adminUser2);
    moderatorToken = makeToken(moderatorUser);
    supportToken = makeToken(supportUser);
  });

  after(() => {
    server.close();
  });

  async function makePending(overrides, opts) {
    const res = await request(server, "POST", "/professional-requests", basePayload(overrides || {}), opts && opts.token);
    if (res.status !== 201) throw new Error("setup create failed: " + JSON.stringify(res.body));
    createdIds.push(res.body.data.id);
    return res.body.data.id;
  }

  it("supports admin list with search by ARQ reference, name, and phone", async () => {
    const id = await makePending({ phone: "+212611222333", firstName: "Searchy", lastName: "One", plan: "free" });
    const byRef = await request(server, "GET", `/admin/professional-requests?q=${encodeURIComponent(id)}`, undefined, adminToken);
    assert.equal(byRef.status, 200);
    assert.ok(byRef.body.data.some((r) => r.id === id));
    const byName = await request(server, "GET", "/admin/professional-requests?q=searchy", undefined, adminToken);
    assert.equal(byName.status, 200);
    assert.ok(byName.body.data.some((r) => r.firstName === "Searchy"));
    const byPhone = await request(server, "GET", "/admin/professional-requests?q=611222333", undefined, adminToken);
    assert.equal(byPhone.status, 200);
    assert.ok(byPhone.body.data.some((r) => String(r.phone).includes("611222333")));
  });

  it("filters by status, plan, and city", async () => {
    await makePending({ phone: "+212622333444", city: "rabat", cityLabel: "Rabat", plan: "gold" });
    await makePending({ phone: "+212633444555", city: "marrakech", cityLabel: "Marrakech", plan: "verified" });
    const gold = await request(server, "GET", "/admin/professional-requests?plan=gold", undefined, adminToken);
    assert.equal(gold.status, 200);
    assert.ok(gold.body.data.length > 0);
    assert.ok(gold.body.data.every((r) => r.planCode === "gold"));
    const rabat = await request(server, "GET", "/admin/professional-requests?city=rabat", undefined, adminToken);
    assert.equal(rabat.status, 200);
    assert.ok(rabat.body.data.length > 0);
    assert.ok(rabat.body.data.every((r) => r.cityLabel === "Rabat"));
    const invalidPlan = await request(server, "GET", "/admin/professional-requests?plan=vip", undefined, adminToken);
    assert.equal(invalidPlan.status, 400);
  });

  it("admin approves a pending request: 200, status approved, reviewer recorded, no professional created", async () => {
    const id = await makePending({ phone: "+212644555666", plan: "verified" });
    const res = await request(server, "POST", `/admin/professional-requests/${id}/approve`, undefined, adminToken);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.status, "approved");
    assert.equal(d.reviewerId, "a-3");
    assert.equal(d.reviewerName, "Admin 2");
    assert.ok(d.reviewedAt);
    assert.ok(Array.isArray(d.history) && d.history.length === 1);
    // Approval must NOT create a professional (no auto-publish).
    const profs = await request(server, "GET", "/professionals?query=644555666");
    assert.equal(profs.status, 200);
    const list = profs.body.data && profs.body.data.data ? profs.body.data.data : profs.body.data;
    assert.equal(list.filter((p) => String(p.phone || "").includes("644555666")).length, 0);
  });

  it("approving a GOLD request carries the plan onto the created professional (package/planEligible)", async () => {
    const id = await makePending({ phone: "+212611333444", plan: "gold" });
    const res = await request(server, "POST", `/admin/professional-requests/${id}/approve`, undefined, adminToken);
    assert.equal(res.status, 200);
    const proId = res.body.data.professionalId;
    assert.ok(proId, "approve must expose the created professionalId");
    const proRes = await request(server, "GET", `/admin/professionals/${proId}`, undefined, adminToken);
    assert.equal(proRes.status, 200);
    const pro = proRes.body.data;
    assert.equal(String(pro.package), "gold", "marketplace badge comes from package");
    assert.equal(pro.planEligible, true);
    assert.equal(String(pro.subscriptionPlanId || ""), "PLAN-GOLD");
    // Paid subscription itself stays separate until money actually moves.
    assert.equal(String(pro.subscriptionStatus || "none"), "none");
  });

  it("approve is rejectable-only-once: second approve -> 409 (invalid transition)", async () => {
    const id = await makePending({ phone: "+212655666777", plan: "free" });
    const first = await request(server, "POST", `/admin/professional-requests/${id}/approve`, undefined, adminToken);
    assert.equal(first.status, 200);
    const second = await request(server, "POST", `/admin/professional-requests/${id}/approve`, undefined, adminToken);
    assert.equal(second.status, 409);
  });

  it("reject requires a reason -> 400 when missing", async () => {
    const id = await makePending({ phone: "+212666777888", plan: "free" });
    const res = await request(server, "POST", `/admin/professional-requests/${id}/reject`, undefined, adminToken);
    assert.equal(res.status, 400);
  });

  it("admin rejects a pending request with a reason: 200, status rejected, reason stored", async () => {
    const id = await makePending({ phone: "+212677888999", plan: "verified" });
    const res = await request(server, "POST", `/admin/professional-requests/${id}/reject`, { reason: "Document manquant" }, adminToken);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.status, "rejected");
    assert.equal(d.reason, "Document manquant");
    assert.equal(d.reviewerId, "a-3");
    assert.ok(d.reviewedAt);
    assert.ok(Array.isArray(d.history) && d.history.length === 1);
  });

  it("reject is pending->rejected only: double reject -> 409", async () => {
    const id = await makePending({ phone: "+212688999000", plan: "free" });
    const first = await request(server, "POST", `/admin/professional-requests/${id}/reject`, { reason: "Doublon" }, adminToken);
    assert.equal(first.status, 200);
    const second = await request(server, "POST", `/admin/professional-requests/${id}/reject`, { reason: "Encore" }, adminToken);
    assert.equal(second.status, 409);
  });

  it("approving an already-rejected request -> 409", async () => {
    const id = await makePending({ phone: "+212699000111", plan: "free" });
    await request(server, "POST", `/admin/professional-requests/${id}/reject`, { reason: "Annulé par l'artisan" }, adminToken);
    const approve = await request(server, "POST", `/admin/professional-requests/${id}/approve`, undefined, adminToken);
    assert.equal(approve.status, 409);
  });

  it("approve/reject on a non-existent request -> 404", async () => {
    const approve = await request(server, "POST", "/admin/professional-requests/ARQ-999999/approve", undefined, adminToken);
    assert.equal(approve.status, 404);
    const reject = await request(server, "POST", "/admin/professional-requests/ARQ-999999/reject", { reason: "X" }, adminToken);
    assert.equal(reject.status, 404);
  });

  it("approve/reject are RBAC-gated: 401 unauthenticated, 403 without permission", async () => {
    const id = await makePending({ phone: "+212611000222", plan: "free" });
    const unauthApprove = await request(server, "POST", `/admin/professional-requests/${id}/approve`);
    assert.equal(unauthApprove.status, 401);
    const unauthReject = await request(server, "POST", `/admin/professional-requests/${id}/reject`, { reason: "X" });
    assert.equal(unauthReject.status, 401);
    // finance lacks professionalRequests approve/reject.
    const deniedApprove = await request(server, "POST", `/admin/professional-requests/${id}/approve`, undefined, financeToken);
    assert.equal(deniedApprove.status, 403);
    const deniedReject = await request(server, "POST", `/admin/professional-requests/${id}/reject`, { reason: "X" }, financeToken);
    assert.equal(deniedReject.status, 403);
    // moderators CAN approve/reject (mirrors verification RBAC).
    const modApprove = await request(server, "POST", `/admin/professional-requests/${id}/approve`, undefined, moderatorToken);
    assert.equal(modApprove.status, 200);
    // support can read but must be denied the decision actions.
    const supportDenied = await request(server, "POST", "/admin/professional-requests/ARQ-1/approve", undefined, supportToken);
    assert.equal(supportDenied.status, 403);
  });

  it("client cannot escalate a decision (no status override via approve)", async () => {
    const id = await makePending({ phone: "+212622111333", plan: "free" });
    const res = await request(server, "POST", `/admin/professional-requests/${id}/approve`, { status: "rejected" }, adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "approved");
  });

  it("audit log records both decisions", async () => {
    const logs = await request(server, "GET", "/admin/audit-logs", undefined, adminToken);
    assert.equal(logs.status, 200);
    const entries = Array.isArray(logs.body.data) ? logs.body.data : (logs.body.data && logs.body.data.data) || [];
    const actions = entries.map((e) => e.action || "");
    assert.ok(actions.includes("REGISTRATION_APPROVED"));
    assert.ok(actions.includes("REGISTRATION_REJECTED"));
  });
});

// REQ 55 — Admin Registration Management UI & UX polish (backend side).
// The list endpoint must be backend-authoritative for page size, ordering and
// dashboard counters: real server pagination (never client-side faking over a
// full dataset), global status counts, and whitelisted server-side sort. The
// existing `data` array contract stays intact so REQ 53/54 clients keep
// working; `pagination` and `counts` are additive.
describe("REQ 55 — registrations server pagination, counts, sort", () => {
  let server;
  let db;
  let regToken;
  const regAdmin = { id: "a-r1", name: "Reg Admin", email: "reg@x.ma", password: "x", role: "admin", status: "active" };

  before(async () => {
    db = createInMemoryDb({ adminUser: [adminUser, regAdmin], plan: PLANS });
    const app = createApp({ db });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    regToken = makeToken(regAdmin);
  });

  after(() => {
    server.close();
  });

  // Each test starts with a clean professionalRequest store so counts/pages
  // are fully deterministic.
  beforeEach(() => {
    db.professionalRequest.rows.length = 0;
  });

  const phoneFor = (i) => "+2126" + String(30000000 + i).slice(0, 8);

  function list(qs) {
    return request(server, "GET", "/admin/professional-requests" + (qs || ""), undefined, regToken).then((r) => r.body);
  }

  async function seed(configs) {
    const ids = [];
    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i] || {};
      const res = await request(server, "POST", "/professional-requests", basePayload({
        firstName: cfg.name || ("N" + i),
        lastName: cfg.lastName || ("L" + i),
        phone: cfg.phone || phoneFor(i),
        city: cfg.city || "casablanca",
        cityLabel: cfg.cityLabel || (cfg.city || "casablanca"),
        plan: cfg.plan || "verified"
      }));
      assert.equal(res.status, 201, "seed create must succeed");
      ids.push(res.body.data.id);
    }
    return ids;
  }

  async function approve(id) {
    const r = await request(server, "POST", `/admin/professional-requests/${id}/approve`, undefined, regToken);
    assert.equal(r.status, 200);
    return r.body.data;
  }

  async function reject(id, reason) {
    const r = await request(server, "POST", `/admin/professional-requests/${id}/reject`, { reason }, regToken);
    assert.equal(r.status, 200);
    return r.body.data;
  }

  it("list keeps data as array and adds pagination + global counts (REQ54 compat)", async () => {
    await seed([{ name: "Karim" }, { name: "Sara" }, { name: "Yassine" }]);
    const res = await request(server, "GET", "/admin/professional-requests", undefined, regToken);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data), "data stays an array");
    assert.equal(res.body.data.length, 3);
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.limit, 25);
    assert.equal(res.body.pagination.total, 3);
    assert.equal(res.body.pagination.pages, 1);
    assert.deepEqual(res.body.counts, { total: 3, pending: 3, approved: 0, rejected: 0 });
  });

  it("paginates server-side: page size, page, no overlap, out-of-range clamps", async () => {
    const ids = await seed([{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "E" }]);
    const p1 = await list("?page=1&pageSize=2");
    assert.equal(p1.data.length, 2);
    assert.equal(p1.pagination.total, 5);
    assert.equal(p1.pagination.pages, 3);
    assert.equal(p1.data[0].id, ids[4], "newest first (createdAt desc)");
    assert.equal(p1.data[1].id, ids[3]);

    const p2 = await list("?page=2&pageSize=2");
    assert.equal(p2.data.length, 2);
    assert.deepEqual(p2.data.map((r) => r.id), [ids[2], ids[1]]);

    const p3 = await list("?page=3&pageSize=2");
    assert.equal(p3.data.length, 1);
    assert.equal(p3.data[0].id, ids[0]);

    const seen = p1.data.concat(p2.data, p3.data).map((r) => r.id);
    assert.equal(new Set(seen).size, 5, "pages never overlap");

    const over = await list("?page=99&pageSize=2");
    assert.equal(over.pagination.page, 3, "out-of-range page clamps to last page");
    assert.equal(over.data.length, 1);
  });

  it("counts are global aggregates while pagination.total tracks filters", async () => {
    const ids = await seed([
      { name: "One", plan: "free" },
      { name: "Two", plan: "verified" },
      { name: "Three", plan: "gold" }
    ]);
    await approve(ids[0]);
    await reject(ids[1], "Nope");

    const all = await list("");
    assert.equal(all.counts.total, 3);
    assert.equal(all.counts.pending, 1);
    assert.equal(all.counts.approved, 1);
    assert.equal(all.counts.rejected, 1);
    assert.equal(all.pagination.total, 3);

    const pend = await list("?status=pending");
    assert.equal(pend.data.length, 1);
    assert.equal(pend.data[0].id, ids[2]);
    assert.equal(pend.pagination.total, 1);
    // Dashboard counters must NOT shrink under a filter — they stay global.
    assert.equal(pend.counts.total, 3);
    assert.equal(pend.counts.pending, 1);
    assert.equal(pend.counts.approved, 1);
    assert.equal(pend.counts.rejected, 1);

    const byPlan = await list("?plan=gold");
    assert.equal(byPlan.data.length, 1);
    assert.equal(byPlan.pagination.total, 1);
    assert.deepEqual(byPlan.counts, { total: 3, pending: 1, approved: 1, rejected: 1 });
  });

  it("sorts server-side by name / status / createdAt with direction", async () => {
    await seed([
      { name: "Zara", lastName: "C" },
      { name: "Anna", lastName: "A" },
      { name: "Momo", lastName: "B" }
    ]);
    // Deterministic timestamps (insertion order: Zara, Anna, Momo).
    db.professionalRequest.rows[0].createdAt = new Date(1000);
    db.professionalRequest.rows[1].createdAt = new Date(2000);
    db.professionalRequest.rows[2].createdAt = new Date(3000);

    const byName = await list("?sort=name&dir=asc");
    assert.deepEqual(byName.data.map((r) => r.firstName), ["Anna", "Momo", "Zara"], "asc by full name");
    const byNameDesc = await list("?sort=name&dir=desc");
    assert.deepEqual(byNameDesc.data.map((r) => r.firstName), ["Zara", "Momo", "Anna"], "desc by full name");
    const byCreatedAsc = await list("?sort=createdAt&dir=asc");
    assert.deepEqual(byCreatedAsc.data.map((r) => r.firstName), ["Zara", "Anna", "Momo"], "oldest first");
    const dflt = await list("");
    assert.deepEqual(dflt.data.map((r) => r.firstName), ["Momo", "Anna", "Zara"], "default createdAt desc");
    // Mixed statuses for a meaningful status sort.
    await approve(db.professionalRequest.rows[1].id);      // Anna -> approved
    await reject(db.professionalRequest.rows[2].id, "X");  // Momo -> rejected
    const byStatus = await list("?sort=status&dir=asc");
    assert.deepEqual(byStatus.data.map((r) => r.status), ["approved", "pending", "rejected"], "status sorted asc");
  });

  it("status / plan / city filters compose with pagination", async () => {
    await seed([
      { name: "Rab", city: "rabat", cityLabel: "Rabat", plan: "gold" },
      { name: "Mar", city: "marrakech", cityLabel: "Marrakech", plan: "verified" },
      { name: "Cas", city: "casablanca", cityLabel: "Casablanca", plan: "gold" }
    ]);
    const rabat = await list("?city=rab&pageSize=1&page=1");
    assert.equal(rabat.pagination.total, 1);
    assert.equal(rabat.data.length, 1);
    assert.equal(rabat.data[0].firstName, "Rab");
    const gold = await list("?plan=gold&sort=status&dir=desc");
    assert.equal(gold.pagination.total, 2);
    assert.ok(gold.data.every((r) => r.planCode === "gold"));
  });

  it("search (q) composes with pagination and sort", async () => {
    await seed([
      { name: "Finale", lastName: "A" },
      { name: "Finn", lastName: "B" },
      { name: "Zed", lastName: "C" }
    ]);
    const r = await list("?q=fin&sort=name&dir=asc&page=1&pageSize=1");
    assert.equal(r.pagination.total, 2);
    assert.equal(r.data.length, 1);
    assert.equal(r.data[0].firstName, "Finale");
    const r2 = await list("?q=fin&sort=name&dir=asc&page=2&pageSize=1");
    assert.equal(r2.pagination.total, 2);
    assert.equal(r2.data[0].firstName, "Finn");
  });

  it("rejects invalid page/pageSize/sort/dir with 400", async () => {
    await seed([{ name: "One" }]);
    for (const qs of ["?page=abc", "?page=0", "?page=-3", "?page=1.5"]) {
      const r = await request(server, "GET", "/admin/professional-requests" + qs, undefined, regToken);
      assert.equal(r.status, 400, "page: " + qs);
    }
    for (const qs of ["?pageSize=0", "?pageSize=-1", "?pageSize=501", "?pageSize=x"]) {
      const r = await request(server, "GET", "/admin/professional-requests" + qs, undefined, regToken);
      assert.equal(r.status, 400, "pageSize: " + qs);
    }
    for (const qs of ["?sort=nope", "?sort=price"]) {
      const r = await request(server, "GET", "/admin/professional-requests" + qs, undefined, regToken);
      assert.equal(r.status, 400, "sort: " + qs);
    }
    for (const qs of ["?dir=up", "?dir=sideways"]) {
      const r = await request(server, "GET", "/admin/professional-requests" + qs, undefined, regToken);
      assert.equal(r.status, 400, "dir: " + qs);
    }
    const okCase = await list("?sort=NAME&dir=ASC");
    assert.equal(okCase.data.length, 1, "case-insensitive params accepted");
  });
});