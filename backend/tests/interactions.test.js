// WhatsApp Interaction + Review Trust System — integration tests (req §33).
//
// Covers the trust chain end-to-end against the in-memory DB:
//   1. Record contact requires auth (401 anonymous).
//   2. Authenticated record -> opaque INT- id; reviewEligibleAt = +48h.
//   3. Second record inside the dedup window consolidates (same id, no dupes).
//   4. Unknown professional -> 404.
//   5. Admin tokens record anonymous interactions (customerId null) but can
//      NEVER confirm or review (account_required).
//   6. Confirmation requires a platform User (admin -> 403).
//   7. Ownership: another customer cannot confirm someone else's contact (404).
//   8. confirmed:false keeps TRACKED; eligibility blocked (contact_not_confirmed).
//   9. confirmed:true -> CONFIRMED_CONTACT; eligibility still gated by 48h
//      (cooldown_48h).
//  10. Eligible interaction (confirmed + cooldown elapsed) -> myEligibility true,
//      review published (low risk), verifiedContact true, rating recomputed.
//  11. Review without any contact -> 403. Review before 48h -> 403.
//  12. One review max per customer + professional (409).
//  13. High-risk review (new account + velocity + duplicate) -> status flagged,
//      excluded from the professional rating.
//  14. Admin interactions list: 401 anonymous, 403 support, 200 moderator/super_admin.
//  15. Opaque ids are preserved end-to-end (never parseInt).
//  16. Audit trail records CONTACT_RECORDED / CONTACT_CONFIRMED / REVIEW_CREATED.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const jwt = require("jsonwebtoken");
const { createInMemoryDb } = require("./inMemoryDb");
const { createApp } = require("../src/app");
const env = require("../src/config/env");

const NOW = Date.now();

const SEED = {
  adminUser: [
    { id: "admin-1", name: "Super Admin", email: "a@sna3ti.ma", role: "super_admin", status: "active" },
    { id: "admin-support", name: "Support", email: "s@sna3ti.ma", role: "support", status: "active" },
    { id: "admin-mo", name: "Moderator", email: "m@sna3ti.ma", role: "moderator", status: "active" }
  ],
  user: [
    { id: "USR-1", name: "Client A", firstName: "A", phone: "+212600000001", role: "user", status: "active", createdAt: new Date(NOW - 30 * 86400000) },
    { id: "USR-2", name: "Client B", firstName: "B", phone: "+212600000002", role: "user", status: "active", createdAt: new Date(NOW - 30 * 86400000) },
    { id: "USR-HIGH", name: "Client C", firstName: "C", phone: "+212600000003", role: "user", status: "active", createdAt: new Date(NOW - 2 * 3600000) }
  ],
  professional: [
    { id: "PRO-10295", name: "Ahmed Tazi", job: "Plombier", city: "Casablanca", status: "active", verified: false, rating: null, reviewsCount: 0 },
    { id: "PRO-RISK", name: "Risky Pro", job: "Electricien", city: "Rabat", status: "active", verified: false, rating: null, reviewsCount: 0 },
    { id: "PRO-OTHER", name: "Other Pro", job: "Peintre", city: "Tanger", status: "active", verified: false, rating: null, reviewsCount: 0 }
  ],
  professionalContactInteraction: [
    // Already-eligible: confirmed + cooldown elapsed (review gate PASS).
    {
      id: "INT-ELIG", customerId: "USR-2", professionalId: "PRO-10295",
      channel: "WHATSAPP", source: "PROFILE", status: "CONFIRMED_CONTACT",
      customerConfirmed: true, customerConfirmedAt: new Date(NOW - 50000),
      reviewEligibleAt: new Date(NOW - 1000), riskScore: 0, riskFlags: [],
      lastContactAt: new Date(NOW - 50000), createdAt: new Date(NOW - 50000), updatedAt: new Date(NOW - 1000)
    },
    // Eligible + new account / velocity / duplicate signals (risk HIGH).
    {
      id: "INT-RISK", customerId: "USR-HIGH", professionalId: "PRO-RISK",
      channel: "WHATSAPP", source: "PROFILE", status: "CONFIRMED_CONTACT",
      customerConfirmed: true, customerConfirmedAt: new Date(NOW - 50000),
      reviewEligibleAt: new Date(NOW - 1000), riskScore: 0, riskFlags: [],
      lastContactAt: new Date(NOW - 50000), createdAt: new Date(NOW - 50000), updatedAt: new Date(NOW - 1000)
    }
  ],
  review: [
    // 3 reviews by USR-HIGH inside 24h (velocity signal) on a DIFFERENT pro
    // (PRO-OTHER, so PRO-10295's rating stays clean); one of them duplicates
    // the comment the customer will reuse on PRO-RISK.
    { id: "RV-1", professionalId: "PRO-OTHER", userId: "USR-HIGH", customer: "Client C", rating: 5, comment: "Super travail", status: "published", createdAt: new Date(NOW - 1000) },
    { id: "RV-2", professionalId: "PRO-OTHER", userId: "USR-HIGH", customer: "Client C", rating: 4, comment: "Rapide", status: "published", createdAt: new Date(NOW - 2000) },
    { id: "RV-3", professionalId: "PRO-OTHER", userId: "USR-HIGH", customer: "Client C", rating: 5, comment: "Propre", status: "published", createdAt: new Date(NOW - 3000) }
  ]
};

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

const USER1 = makeToken({ id: "USR-1", role: "user", name: "Client A" });
const USER2 = makeToken({ id: "USR-2", role: "user", name: "Client B" });
const ADMIN = makeToken({ id: "admin-1", role: "super_admin", name: "Super Admin" });
const MOD = makeToken({ id: "admin-mo", role: "moderator", name: "Moderator" });
const SUPPORT = makeToken({ id: "admin-support", role: "support", name: "Support" });

describe("WhatsApp Interaction + Review Trust System", () => {
  let server;
  let app;

  before(async () => {
    const db = createInMemoryDb(SEED);
    app = createApp({ db });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
  });

  after(() => server.close());

  it("record contact requires auth (401 without a token)", async () => {
    const res = await request(server, "POST", "/professionals/PRO-10295/contact", { channel: "WHATSAPP", source: "PROFILE" });
    assert.equal(res.status, 401);
  });

  it("authenticated record stores an opaque INT- interaction with reviewEligibleAt +48h", async () => {
    const res = await request(server, "POST", "/professionals/PRO-10295/contact", { channel: "WHATSAPP", source: "PROFILE" }, USER1);
    assert.equal(res.status, 201);
    const d = res.body.data;
    assert.match(d.id, /^INT-\d+$/);
    assert.equal(d.customerId, "USR-1");
    assert.equal(d.professionalId, "PRO-10295");
    assert.equal(d.channel, "WHATSAPP");
    assert.equal(d.source, "PROFILE");
    assert.equal(d.status, "TRACKED");
    const eligibleAt = new Date(d.reviewEligibleAt).getTime();
    assert.ok(eligibleAt - Date.now() > 47 * 3600 * 1000, "reviewEligibleAt must be ~48h in the future");
  });

  it("a second click inside the dedup window consolidates (same id, no duplicate)", async () => {
    const first = await request(server, "POST", "/professionals/PRO-10295/contact", { channel: "WHATSAPP" }, USER1);
    const second = await request(server, "POST", "/professionals/PRO-10295/contact", { channel: "WHATSAPP" }, USER1);
    assert.equal(second.status, 200);
    assert.equal(second.body.repeated, true);
    assert.equal(second.body.data.id, first.body.data.id, "must not create a second row");
    assert.equal(second.body.data.customerConfirmed, false);
  });

  it("unknown professional -> 404", async () => {
    const res = await request(server, "POST", "/professionals/PRO-NOPE/contact", { channel: "WHATSAPP" }, USER1);
    assert.equal(res.status, 404);
  });

  it("admin token records an anonymous interaction (customerId null) but is never eligible", async () => {
    const res = await request(server, "POST", "/professionals/PRO-10295/contact", { channel: "WHATSAPP", source: "SEARCH" }, ADMIN);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.customerId, null);

    const elig = await request(server, "GET", "/professionals/PRO-10295/contact/eligibility", undefined, ADMIN);
    assert.equal(elig.status, 200);
    assert.equal(elig.body.data.eligible, false);
    assert.ok(elig.body.data.reasons.includes("account_required"));
  });

  it("confirmation requires a platform User (admin -> 403)", async () => {
    const res = await request(server, "POST", "/professionals/PRO-10295/contact/confirm", { confirmed: true }, ADMIN);
    assert.equal(res.status, 403);
  });

  it("confirmation is ownership-checked (another customer -> 404)", async () => {
    // USR-HIGH has no interaction with PRO-10295 (its INT-RISK targets PRO-RISK).
    const res = await request(server, "POST", "/professionals/PRO-10295/contact/confirm", { confirmed: true }, makeToken({ id: "USR-HIGH", role: "user", name: "Client C" }));
    assert.equal(res.status, 404);
  });

  it("confirmed:false keeps TRACKED and blocks eligibility", async () => {
    await request(server, "POST", "/professionals/PRO-10295/contact", { channel: "WHATSAPP" }, USER1);
    const res = await request(server, "POST", "/professionals/PRO-10295/contact/confirm", { confirmed: false }, USER1);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.interaction.status, "TRACKED");
    assert.equal(res.body.data.interaction.customerConfirmed, false);

    const elig = await request(server, "GET", "/professionals/PRO-10295/contact/eligibility", undefined, USER1);
    assert.equal(elig.body.data.eligible, false);
    assert.ok(elig.body.data.reasons.includes("contact_not_confirmed"));
  });

  it("confirmed:true -> CONFIRMED_CONTACT but 48h cooldown still blocks the review", async () => {
    await request(server, "POST", "/professionals/PRO-10295/contact", { channel: "WHATSAPP" }, USER1);
    const res = await request(server, "POST", "/professionals/PRO-10295/contact/confirm", { confirmed: true, serviceStatus: "in_progress" }, USER1);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.interaction.status, "CONFIRMED_CONTACT");
    assert.equal(res.body.data.interaction.customerConfirmed, true);
    assert.equal(res.body.data.interaction.customerReportedService, "in_progress");

    const elig = await request(server, "GET", "/professionals/PRO-10295/contact/eligibility", undefined, USER1);
    assert.equal(elig.body.data.eligible, false);
    assert.ok(elig.body.data.reasons.includes("cooldown_48h"));

    const rev = await request(server, "POST", "/professionals/PRO-10295/reviews", { rating: 5, comment: "Trop tôt" }, USER1);
    assert.equal(rev.status, 403, "review must be rejected before the 48h cooldown");
  });

  it("review without any contact -> 403", async () => {
    const res = await request(server, "POST", "/professionals/PRO-RISK/reviews", { rating: 5, comment: "Jamais contacté" }, USER2);
    assert.equal(res.status, 403);
  });

  it("eligible interaction unlocks the review: published, verifiedContact, rating recomputed", async () => {
    const elig = await request(server, "GET", "/professionals/PRO-10295/contact/eligibility", undefined, USER2);
    assert.equal(elig.body.data.eligible, true);
    assert.equal(elig.body.data.verifiedContact, true);

    const rev = await request(server, "POST", "/professionals/PRO-10295/reviews", { rating: 5, comment: "Très bon plombier" }, USER2);
    assert.equal(rev.status, 201);
    assert.equal(rev.body.data.status, "published");
    assert.equal(rev.body.data.verifiedContact, true, "server must stamp verifiedContact=true");
    assert.equal(rev.body.data.customer, "Client B");
    assert.equal(rev.body.data.riskScore, 0);

    const publicList = await request(server, "GET", "/professionals/PRO-10295/reviews");
    const mine = publicList.body.data.data.find((r) => r.id === rev.body.data.id);
    assert.ok(mine, "review visible publicly");
    assert.equal(mine.verifiedContact, true);

    const pro = await request(server, "GET", "/admin/professionals/PRO-10295", undefined, ADMIN);
    assert.equal(pro.body.data.rating, 5);
    assert.equal(pro.body.data.reviewsCount, 1);
  });

  it("one review max per customer + professional (409)", async () => {
    const again = await request(server, "POST", "/professionals/PRO-10295/reviews", { rating: 4, comment: "Second avis" }, USER2);
    assert.equal(again.status, 409);
  });

  it("high-risk review (new account + velocity + duplicate) is flagged and never counted", async () => {
    const rev = await request(server, "POST", "/professionals/PRO-RISK/reviews", { rating: 5, comment: "Super travail" }, makeToken({ id: "USR-HIGH", role: "user", name: "Client C" }));
    assert.equal(rev.status, 201);
    assert.equal(rev.body.data.status, "flagged", "risk HIGH must land in moderation queue");
    assert.ok(rev.body.data.riskScore >= 60, "expected risk score >= 60 (HIGH)");

    const pro = await request(server, "GET", "/admin/professionals/PRO-RISK", undefined, ADMIN);
    assert.equal(pro.body.data.rating, null, "flagged reviews must not move the rating");
    assert.equal(pro.body.data.reviewsCount, 0);
  });

  it("admin interactions list: 401 anonymous, 403 support, 200 moderator/super_admin", async () => {
    const anon = await request(server, "GET", "/admin/interactions");
    assert.equal(anon.status, 401);

    const denied = await request(server, "GET", "/admin/interactions", undefined, SUPPORT);
    assert.equal(denied.status, 403);

    const mod = await request(server, "GET", "/admin/interactions", undefined, MOD);
    assert.equal(mod.status, 200);
    assert.equal(mod.body.success, true);

    const admin = await request(server, "GET", "/admin/interactions", undefined, ADMIN);
    assert.equal(admin.status, 200);
    assert.ok(Array.isArray(admin.body.data));
    assert.ok(admin.body.data.length >= 4, "interaction rows exposed to the dashboard");
    const row = admin.body.data[0];
    for (const key of ["id", "customerId", "professionalId", "channel", "status", "confirmed", "riskScore", "reviewEligibleAt", "lastContactAt"]) {
      assert.ok(key in row, `dashboard row must expose ${key}`);
    }
    // reviewId is nullable (links a review once created) — JSON drops undefined.
    assert.ok(row.reviewId === undefined || typeof row.reviewId === "string", "reviewId must be a string when linked");
  });

  it("opaque ids are preserved end-to-end (never parseInt)", async () => {
    assert.equal(SEED.professional[0].id, "PRO-10295");
    const res = await request(server, "POST", "/professionals/PRO-10295/contact", { channel: "WHATSAPP" }, USER1);
    assert.equal(typeof res.body.data.id, "string");
    assert.equal(res.body.data.professionalId, "PRO-10295");
    assert.match(res.body.data.id, /^INT-\d+$/);
  });

  it("audit trail records CONTACT_RECORDED, CONTACT_CONFIRMED and REVIEW_CREATED", async () => {
    const res = await request(server, "GET", "/admin/audit-logs", undefined, ADMIN);
    const actions = res.body.data.map((e) => e.action);
    assert.ok(actions.includes("CONTACT_RECORDED"));
    assert.ok(actions.includes("CONTACT_CONFIRMED"));
    assert.ok(actions.includes("REVIEW_CREATED"));
  });
});