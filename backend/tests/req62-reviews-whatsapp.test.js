// REQ 62 — WhatsApp brief-avis flow.
//
// A site visitor (no account) can submit a rating + avis + WhatsApp number
// form an artisan profile. The backend:
//   - stores the review as PENDING with reviewerContact / reviewerName /
//     reviewSource="whatsapp" (contact is admin-only, never public)
//   - raises an admin notification (type "review") and an audit entry
//   - returns the platform WhatsApp number for a wa.me redirect
// An admin can then publish (existing moderate) or manually capture a client's
// review from the admin page (POST /admin/reviews/manual, reviewSource="admin").
//
// Contract locked here:
//   POST /reviews/whatsapp         (public, rate-limited) -> 201 pending + platformWhatsapp
//   GET  /professionals/:id/reviews (public)              -> published only, NO contact leak
//   GET  /admin/reviews            (reviews.view)          -> includes pending + reviewerContact
//   POST /admin/reviews/:id/publish                        -> appears in public list
//   POST /admin/reviews/manual     (reviews.moderate)      -> published, rating recomputed
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
const SUPPORT = { id: "a-sp", role: "support", name: "Support" };
const FINANCE = { id: "a-fi", role: "finance", name: "Finance" };
const superAdminToken = makeToken(SUPER);
const supportToken = makeToken(SUPPORT);
const financeToken = makeToken(FINANCE);

const PRO = { id: "PRO-1", name: "Yasmine Riad", status: "active", rating: null, reviewsCount: 0 };

function boot(seed) {
  const app = createApp({ db: createInMemoryDb(seed) });
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

describe("REQ 62 — WhatsApp brief-avis submission + admin manual capture", () => {
  let server;
  let createdId = null;
  before(async () => {
    server = await boot({
      adminUser: [
        { id: "a-sa", name: "Super Admin", email: "sa@sna3ti.ma", role: "super_admin", status: "active", createdAt: new Date() },
        { id: "a-sp", name: "Support", email: "sp@sna3ti.ma", role: "support", status: "active", createdAt: new Date() },
        { id: "a-fi", name: "Finance", email: "fi@sna3ti.ma", role: "finance", status: "active", createdAt: new Date() }
      ],
      role: [{ id: "ROLE-SA", code: "super_admin", name: "Super Admin" }],
      plan: [],
      category: [],
      professional: [PRO],
      user: [],
      verificationRequest: [],
      payment: [],
      subscription: [],
      review: [],
      report: [],
      supportTicket: [],
      notification: [],
      auditLog: [],
      professionalRequest: []
    });
  });
  after(() => { server.close(); });

  it("anonymous WhatsApp submission returns 201 pending review + platformWhatsapp", async () => {
    const res = await request(server, "POST", "/reviews/whatsapp", {
      professionalId: PRO.id,
      rating: 5,
      comment: "Excellent travail, très ponctuelle.",
      contact: "0661234567",
      reviewerName: "Karim B."
    });
    assert.equal(res.status, 201, "anonymous submission accepted");
    const r = res.body.data.review;
    createdId = r.id;
    assert.equal(r.status, "pending", "stored pending, never auto-published");
    assert.equal(r.rating, 5);
    assert.equal(r.reviewSource, "whatsapp");
    assert.equal(r.reviewerContact, "0661234567");
    assert.equal(typeof res.body.data.platformWhatsapp, "string", "wa.me target returned");
    // Admin notification raised.
    const feed = await request(server, "GET", "/admin/notifications", undefined, superAdminToken);
    assert.equal(feed.status, 200);
    assert.ok(feed.body.data.some((n) => n.type === "review" && n.entityType === "Review" && n.entityId === createdId), "admin notified");
  });

  it("duplicate prevention: same contact cannot resubmit while pending (409)", async () => {
    const dup = await request(server, "POST", "/reviews/whatsapp", {
      professionalId: PRO.id,
      rating: 4,
      comment: "Deuxième envoi identique.",
      contact: "0661234567"
    });
    assert.equal(dup.status, 409, "duplicate pending submission rejected");
    assert.ok(dup.body && dup.body.error, "returns an error body");
  });


  it("pending review is NOT in the public list and the contact never leaks", async () => {
    const res = await request(server, "GET", `/professionals/${PRO.id}/reviews`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.data.length, 0, "pending review hidden from public");
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes("0661234567"), "contact not exposed publicly");
  });

  it("admin reviews list shows pending + reviewerContact (reviews.view)", async () => {
    const res = await request(server, "GET", "/admin/reviews", undefined, superAdminToken);
    assert.equal(res.status, 200);
    const r = res.body.data.find((x) => x.id === createdId);
    assert.ok(r, "pending submission visible to admin");
    assert.equal(r.status, "pending");
    assert.equal(r.reviewerContact, "0661234567");
    assert.equal(r.reviewSource, "whatsapp");
  });

  it("RBAC: support can read (reviews.view) but not moderate; finance denied read", async () => {
    const supportRead = await request(server, "GET", "/admin/reviews", undefined, supportToken);
    assert.equal(supportRead.status, 200, "support has reviews.view for moderation context");

    const supportModerate = await request(server, "POST", "/admin/reviews/manual", {
      professionalId: PRO.id, customer: "X", rating: 3, comment: "y"
    }, supportToken);
    assert.equal(supportModerate.status, 403, "support has no reviews.moderate");

    const financeRead = await request(server, "GET", "/admin/reviews", undefined, financeToken);
    assert.equal(financeRead.status, 403, "finance has neither reviews.view nor moderate");
  });

  it("admin publish -> review becomes public + rating recomputed", async () => {
    const pub = await request(server, "POST", `/admin/reviews/${createdId}/publish`, {}, superAdminToken);
    assert.equal(pub.status, 200);
    const pubList = await request(server, "GET", `/professionals/${PRO.id}/reviews`);
    assert.equal(pubList.body.data.data.length, 1);
    assert.equal(pubList.body.data.data[0].id, createdId);
    assert.equal(pubList.body.data.data[0].status, "published");
    assert.ok(!JSON.stringify(pubList.body).includes("0661234567"), "still no contact leak after publish");
    assert.equal(pubList.body.data.meta.average, 5, "average recomputed");
  });

  it("admin manual capture (POST /admin/reviews/manual) publishes a review typed from WhatsApp", async () => {
    const res = await request(server, "POST", "/admin/reviews/manual", {
      professionalId: PRO.id,
      customer: "Salma E.",
      rating: 4,
      comment: "Joli travail, satisfaite du rendu.",
      contact: "0655342211"
    }, superAdminToken);
    assert.equal(res.status, 201, "manual creation accepted");
    assert.equal(res.body.data.status, "published", "admin capture is published by default");
    assert.equal(res.body.data.reviewSource, "admin");

    const pubList = await request(server, "GET", `/professionals/${PRO.id}/reviews`);
    assert.equal(pubList.body.data.data.length, 2);
    assert.equal(pubList.body.data.meta.average, (5 + 4) / 2, "avg of both published reviews");
  });

  it("validation: missing contact / bad rating / unknown professional", async () => {
    const noContact = await request(server, "POST", "/reviews/whatsapp", { professionalId: PRO.id, rating: 5, comment: "ok", contact: "12" });
    assert.equal(noContact.status, 400, "short contact rejected");

    const badRating = await request(server, "POST", "/reviews/whatsapp", { professionalId: PRO.id, rating: 9, comment: "ok", contact: "0661234567" });
    assert.equal(badRating.status, 400, "rating out of range rejected");

    const missing = await request(server, "POST", "/reviews/whatsapp", { professionalId: "NOPE", rating: 5, comment: "ok", contact: "0661234567" });
    assert.equal(missing.status, 404, "unknown professional rejected");

    const manualUnauth = await request(server, "POST", "/admin/reviews/manual", { professionalId: PRO.id, customer: "X", rating: 3, comment: "y" });
    assert.equal(manualUnauth.status, 401, "manual capture requires auth");
  });
});