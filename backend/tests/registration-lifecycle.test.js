// REQ 56 — registration → professional lifecycle integration regression tests.
//
// Covers the ARQ→PRO pipeline:
//   1. Approval materialises EXACTLY ONE PENDING Professional and persists the
//      professionalId link on the request (end-to-end traceability).
//   2. Field mapping is correct (name, job, city, area, phone, description,
//      package) and nothing is invented (no price / categoryId / userId /
//      subscription).
//   3. The pending professional is admin-visible (admin list/detail) but
//      NOT public — the marketplace only lists status "active".
//   4. Idempotency: a request already carrying a professional can never create
//      a duplicate account (409 + unchanged count).
//   5. Rejected requests never materialise a professional.
//   6. Activation (pending → active) is the explicit publish step: admin
//      RBAC-gated (401 / 403 / 200), audited, and it makes the professional
//      appear on the public marketplace. Suspend hides it again.
//   7. No subscription is ever auto-created by approval or activation.
//
// Runs against the in-memory DB (no PostgreSQL required in CI), mirroring the
// REQ 52/53/54 harness.

const { describe, it, before, after, beforeEach } = require("node:test");
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

function makeToken(admin) {
  return jwt.sign({ sub: admin.id, role: admin.role, name: admin.name }, env.jwtSecret, { expiresIn: "1h" });
}

const PLANS = [
  { id: "PLAN-FREE", code: "free", name: "Free", price: 0, active: true },
  { id: "PLAN-VER", code: "verified", name: "Vérifié", price: 99, active: true },
  { id: "PLAN-GOLD", code: "gold", name: "GOLD", price: 199, active: true }
];

const USERS = [
  { id: "a-1", name: "Super Admin", email: "sa@x.ma", password: "x", role: "super_admin", status: "active" },
  { id: "a-2", name: "Admin", email: "ad@x.ma", password: "x", role: "admin", status: "active" },
  { id: "a-3", name: "Finance", email: "fi@x.ma", password: "x", role: "finance", status: "active" },
  { id: "a-4", name: "Moderator", email: "mo@x.ma", password: "x", role: "moderator", status: "active" },
  { id: "a-5", name: "Support", email: "su@x.ma", password: "x", role: "support", status: "active" }
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

function publicRows(res) {
  return res.body.data && res.body.data.data ? res.body.data.data : res.body.data;
}

describe("REQ 56 — registration approval → pending professional → activation", () => {
  let server;
  let db;
  const tokens = {};

  before(async () => {
    db = createInMemoryDb({ adminUser: USERS, plan: PLANS });
    const app = createApp({ db });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    for (const u of USERS) tokens[u.role] = makeToken(u);
  });

  after(() => { server.close(); });

  // Deterministic counts: each test starts with empty professional / request /
  // subscription stores. Audit rows accumulate (we only assert presence).
  beforeEach(() => {
    db.professional.rows.length = 0;
    db.professionalRequest.rows.length = 0;
    db.subscription.rows.length = 0;
  });

  async function makePending(overrides) {
    const res = await request(server, "POST", "/professional-requests", basePayload(overrides || {}));
    assert.equal(res.status, 201, "create request must succeed: " + JSON.stringify(res.body));
    return res.body.data;
  }

  async function approve(id, token) {
    return request(server, "POST", `/admin/professional-requests/${id}/approve`, undefined, token || tokens.admin);
  }

  async function activate(id, token) {
    return request(server, "POST", `/admin/professionals/${id}/activate`, undefined, token || tokens.admin);
  }

  it("approval creates EXACTLY ONE pending professional, linked ARQ→PRO (traceability)", async () => {
    const req = await makePending();
    const res = await approve(req.id);
    assert.equal(res.status, 200);

    // One and only one professional for this approval.
    assert.equal(db.professional.rows.length, 1, "exactly one professional created");
    const pro = res.body.data.professionalId ? db.professional.rows.find((p) => p.id === res.body.data.professionalId) : null;
    assert.ok(pro, "approve response exposes professionalId");
    assert.match(pro.id, /^PRO-\d+$/);
    assert.equal(pro.status, "pending", "NEVER auto-published");

    // ARQ→PRO link is persisted on the request (admin detail).
    const detail = await request(server, "GET", `/admin/professional-requests/${req.id}`, undefined, tokens.super_admin);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.professionalId, pro.id);
    assert.equal(detail.body.data.status, "approved");

    // Response contract: status approved + reference.
    assert.equal(res.body.data.status, "approved");
    assert.equal(res.body.data.reference, req.id);
  });

  it("maps request fields onto the professional without inventing data", async () => {
    const req = await makePending({
      phone: "+212622111333",
      city: "rabat",
      cityLabel: "Rabat Agdal",
      plan: "gold",
      description: ""
    });
    await approve(req.id);

    const pro = db.professional.rows[0];
    assert.equal(pro.name, "Karim El Amrani", "firstName + lastName joined");
    assert.equal(pro.job, "electricien", "profession → job");
    assert.equal(pro.city, "rabat", "city slug preserved");
    assert.equal(pro.area, "Rabat Agdal", "distinct readable cityLabel → area");
    assert.equal(pro.phone, "+212622111333");
    assert.equal(pro.package, "gold", "REQ 57-A — the requested plan carries onto the professional (badge)");
    assert.equal(pro.description, null, "empty description stored as null");

    // Never invented: no price / no catalog refs / no account link.
    assert.equal(pro.price, undefined, "request price is not invented on the professional");
    assert.equal(pro.categoryId, undefined);
    assert.equal(pro.userId, undefined);

    // Identical city/label (case-insensitive) does NOT duplicate into area.
    const same = await makePending({ phone: "+212633222444", city: "marrakech", cityLabel: "Marrakech", plan: "free" });
    await approve(same.id);
    const pro2 = db.professional.rows.find((p) => p.id !== pro.id);
    assert.equal(pro2.area, null, "equivalent cityLabel collapsed to null");
  });

  it("no subscription is ever auto-created by approval; requested tier tracked, not activated (REQ 57-A)", async () => {
    const req = await makePending({ plan: "verified" });
    await approve(req.id);
    assert.equal(db.subscription.rows.length, 0, "approval creates no subscription");
    const pro = db.professional.rows[0];
    assert.equal(pro.package, "verified", "requested plan carries onto the professional tier");
    assert.equal(pro.planEligible, true, "paid plan flagged eligible until payment");
    assert.equal(pro.subscriptionPlanId, "PLAN-VER", "paid plan referenced on the account");
    assert.equal(pro.subscriptionStatus, undefined, "no subscription state invented");
    // The chosen formula stays traceable on the REQUEST, not the professional.
    const detail = await request(server, "GET", `/admin/professional-requests/${req.id}`, undefined, tokens.super_admin);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.planCode, "verified", "requested plan preserved on the request");
  });

  it("approved-but-pending professional is admin-visible yet NOT on the public marketplace", async () => {
    const req = await makePending({ phone: "+212644555666" });
    const approveRes = await approve(req.id);
    const proId = approveRes.body.data.professionalId;

    // Admin list surfaces the pending account (all statuses by default).
    const adminList = await request(server, "GET", "/admin/professionals", undefined, tokens.admin);
    assert.equal(adminList.status, 200);
    const adminIds = adminList.body.data.map((p) => p.id);
    assert.ok(adminIds.includes(proId), "pending professional visible on admin list");

    // Admin detail returns it.
    const adminDetail = await request(server, "GET", `/admin/professionals/${proId}`, undefined, tokens.admin);
    assert.equal(adminDetail.status, 200);
    assert.equal(adminDetail.body.data.status, "pending");

    // Public marketplace (list + search) must NOT include it.
    const pubList = await request(server, "GET", "/professionals");
    assert.equal(pubList.status, 200);
    assert.equal(
      publicRows(pubList).filter((p) => String(p.phone || "").includes("644555666")).length,
      0,
      "pending professional is not publicly listed"
    );
    const search = await request(server, "GET", "/search?query=Karim");
    assert.equal(
      publicRows(search).filter((p) => p.id === proId).length,
      0,
      "pending professional is not publicly searchable"
    );
  });

  it("approval is idempotent: second approve → 409 and never a duplicate account", async () => {
    const req = await makePending({ phone: "+212655666777" });
    const first = await approve(req.id);
    assert.equal(first.status, 200);
    assert.equal(db.professional.rows.length, 1);

    const second = await approve(req.id);
    assert.equal(second.status, 409);
    assert.equal(db.professional.rows.length, 1, "no duplicate professional created");
  });

  it("a rejected request never materialises a professional", async () => {
    const req = await makePending({ phone: "+212666777888" });
    const rej = await request(server, "POST", `/admin/professional-requests/${req.id}/reject`, { reason: "Doublon" }, tokens.admin);
    assert.equal(rej.status, 200);
    assert.equal(db.professional.rows.length, 0, "rejection creates nothing");
    const detail = await request(server, "GET", `/admin/professional-requests/${req.id}`, undefined, tokens.admin);
    assert.equal(detail.body.data.professionalId, undefined, "no link on a rejected request");
  });

  it("activating a pending professional publishes it on the marketplace; suspend hides it", async () => {
    const req = await makePending({ phone: "+212677888999", plan: "gold" });
    const adm = await approve(req.id);
    const proId = adm.body.data.professionalId;

    // Admin activates (publish) the pending account.
    const act = await activate(proId, tokens.super_admin);
    assert.equal(act.status, 200);
    assert.equal(act.body.data.status, "active");

    // Now public (the marketplace list includes every active professional).
    const pub = await request(server, "GET", "/professionals");
    assert.ok(
      publicRows(pub).some((p) => p.id === proId),
      "activated professional appears on the public marketplace"
    );

    // Suspend removes it from the marketplace; reactivate restores it.
    const susp = await request(server, "POST", `/admin/professionals/${proId}/suspend`, { reason: "Signalement" }, tokens.admin);
    assert.equal(susp.status, 200);
    const afterSuspend = await request(server, "GET", "/professionals");
    assert.equal(publicRows(afterSuspend).filter((p) => p.id === proId).length, 0, "suspended = hidden from marketplace");

    const react = await activate(proId, tokens.admin);
    assert.equal(react.status, 200);
    assert.equal(react.body.data.status, "active");
    const afterReact = await request(server, "GET", "/professionals");
    assert.ok(publicRows(afterReact).some((p) => p.id === proId), "reactivated again visible");
  });

  it("activation of an already-active professional is rejected with 409", async () => {
    const req = await makePending({ phone: "+212688999000" });
    const adm = await approve(req.id);
    const proId = adm.body.data.professionalId;
    assert.equal((await activate(proId)).status, 200);
    const again = await activate(proId);
    assert.equal(again.status, 409, "active cannot be activated again");
  });

  it("activation is RBAC-gated: 401 unauthenticated, 403 without professionals.activate", async () => {
    const req = await makePending({ phone: "+212699000111" });
    const adm = await approve(req.id);
    const proId = adm.body.data.professionalId;

    const unauth = await request(server, "POST", `/admin/professionals/${proId}/activate`);
    assert.equal(unauth.status, 401);

    // finance has no professionals.* at all.
    const finance = await activate(proId, tokens.finance);
    assert.equal(finance.status, 403);

    // moderator may approve registrations but NOT publish accounts.
    const moderator = await activate(proId, tokens.moderator);
    assert.equal(moderator.status, 403, "moderator cannot activate (professionals.activate)");

    // support only reads.
    const support = await activate(proId, tokens.support);
    assert.equal(support.status, 403);

    // admin is allowed.
    const admin = await activate(proId, tokens.admin);
    assert.equal(admin.status, 200);
    assert.equal(admin.body.data.status, "active");
  });

  it("audit trail covers REGISTRATION_APPROVED, CREATE_PROFESSIONAL and PROFESSIONAL_ACTIVATED", async () => {
    const req = await makePending({ phone: "+212611222333" });
    const adm = await approve(req.id, tokens.super_admin);
    const proId = adm.body.data.professionalId;
    await activate(proId, tokens.super_admin);

    const audit = await request(server, "GET", "/admin/audit-logs", undefined, tokens.super_admin);
    assert.equal(audit.status, 200);
    const entries = Array.isArray(audit.body.data) ? audit.body.data : (audit.body.data && audit.body.data.data) || [];
    const actions = entries.map((e) => e.action || "");

    assert.ok(actions.includes("REGISTRATION_APPROVED"), "REGISTRATION_APPROVED logged");
    assert.ok(actions.includes("CREATE_PROFESSIONAL"), "CREATE_PROFESSIONAL logged");
    assert.ok(actions.includes("PROFESSIONAL_ACTIVATED"), "PROFESSIONAL_ACTIVATED logged");

    // The professionals created on approval and their linked requests exist.
    const withLink = entries.find((e) => e.action === "REGISTRATION_APPROVED");
    assert.ok(withLink && withLink.metadata && withLink.metadata.professionalId === proId, "approval audit carries the PRO reference");
  });

  it("admin list supports status filter incl. pending + rejects bogus status", async () => {
    const req = await makePending({ phone: "+212622333444" });
    await approve(req.id);

    const pending = await request(server, "GET", "/admin/professionals?status=pending", undefined, tokens.admin);
    assert.equal(pending.status, 200);
    assert.ok(pending.body.data.every((p) => p.status === "pending"));
    const active = await request(server, "GET", "/admin/professionals?status=active", undefined, tokens.admin);
    assert.equal(active.status, 200);
    assert.equal(active.body.data.length, 0, "pending-only store shows zero active");

    const bogus = await request(server, "GET", "/admin/professionals?status=bogus", undefined, tokens.admin);
    assert.equal(bogus.status, 400);
  });
});