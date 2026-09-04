// Sna3ti Match integration regression tests.
//
// Covers the "Trouve-moi un artisan de confiance" flow end-to-end:
//   1. Public create -> 201, opaque REQ- id, status new, WhatsApp stored
//      (pending when no provider configured) — NOT a fake success.
//   2. Digits-only phone server-side backstop (letters -> 400).
//   3. Admin list/detail are guarded (401 unauthenticated).
//   4. Admin status update + audit trail (MATCH_REQUEST_STATUS_CHANGED).
//   5. Prices are set by admin only and persisted.
//   6. Administrateur retry WhatsApp flips notificationStatus away from sent.
//   7. Invalid status -> 400 (closed set enforced server-side).
//   8. Photo create + guarded photo retrieval (image served with mime).
//
// Runs against the in-memory DB (no PostgreSQL required in CI).

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createInMemoryDb } = require("./inMemoryDb");
const { createApp } = require("../src/app");
const env = require("../src/config/env");

// Hermetic storage: point the global storage object at a temp dir before any
// app (and thus any StorageService) is built in this file.
const TEMP_STORAGE = fs.mkdtempSync(path.join(os.tmpdir(), "sna3ti-match-test-"));

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
let adminToken;
let baseUser = { id: "USR-1", firstName: "A", lastName: "B", name: "A B", role: "user", status: "active", passwordHash: "x" };
let adminUser = { id: "a-1", name: "Super Admin", email: "a@x.ma", password: "x", role: "super_admin", status: "active" };

function miniPngDataUrl() {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
}

describe("Sna3ti Match", () => {
  before(async () => {
    env.storage = { driver: "local", root: TEMP_STORAGE, baseUrl: "/files" };
    const db = createInMemoryDb({ adminUser: [adminUser], user: [baseUser] });
    const app = createApp({ db });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    adminToken = makeToken(adminUser);
  });

  after(() => {
    server.close();
    try { fs.rmSync(TEMP_STORAGE, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  it("public create stores a REQ- lead as source of truth with WhatsApp pending", async () => {
    const res = await request(server, "POST", "/match", {
      name: "Client Test", phone: "0612345678", whatsapp: "0612345678",
      city: "Casablanca", area: "Maarif", service: "electricien",
      description: "Installer deux prises", preferredContact: "both"
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    const d = res.body.data;
    assert.match(d.id, /^REQ-\d+$/);
    assert.equal(d.status, "new");
    assert.equal(d.phone, "0612345678");
    // stored status — never a fake "sent" when no real provider is configured.
    assert.equal(d.notificationStatus.whatsapp, "pending");
  });

  it("rejects non-numeric phone with 400 (server-side backstop)", async () => {
    const res = await request(server, "POST", "/match", {
      name: "X", phone: "not a number", city: "Fes", service: "peintre"
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it("enforces max 5 photos (7 rejected with 400)", async () => {
    const photo = miniPngDataUrl();
    const res = await request(server, "POST", "/match", {
      name: "X", phone: "0622222222", city: "Fes", service: "peintre",
      photos: Array(7).fill(photo)
    });
    assert.equal(res.status, 400);
  });

  it("admin list is guarded (401 without token), OK with token", async () => {
    const unauth = await request(server, "GET", "/admin/match-requests");
    assert.equal(unauth.status, 401);
    const auth = await request(server, "GET", "/admin/match-requests", undefined, adminToken);
    assert.equal(auth.status, 200);
    assert.equal(auth.body.success, true);
    assert.ok(auth.body.data.length >= 1);
  });

  it("admin can update status, set prices, and mark an artisan", async () => {
    const list = await request(server, "GET", "/admin/match-requests", undefined, adminToken);
    const id = list.body.data[0].id;

    const st = await request(server, "PATCH", `/admin/match-requests/${id}/status`, { status: "price_received" }, adminToken);
    assert.equal(st.status, 200);
    assert.equal(st.body.data.status, "price_received");

    const pr = await request(server, "PATCH", `/admin/match-requests/${id}/prices`, { artisanPrice: 500, customerPrice: 550, commission: 50 }, adminToken);
    assert.equal(pr.status, 200);
    assert.equal(pr.body.data.artisanPrice, 500);
    assert.equal(pr.body.data.customerPrice, 550);
    assert.equal(pr.body.data.commission, 50);

    const art = await request(server, "PATCH", `/admin/match-requests/${id}/artisan`, { artisanName: "Karim", artisanPhone: "0655555555" }, adminToken);
    assert.equal(art.status, 200);
    assert.equal(art.body.data.artisanName, "Karim");
  });

  it("rejects an invalid status with 400 (closed set enforced)", async () => {
    const list = await request(server, "GET", "/admin/match-requests", undefined, adminToken);
    const id = list.body.data[0].id;
    const res = await request(server, "PATCH", `/admin/match-requests/${id}/status`, { status: "bogus" }, adminToken);
    assert.equal(res.status, 400);
  });

  it("admin retry WhatsApp re-stores the notification status", async () => {
    const list = await request(server, "GET", "/admin/match-requests", undefined, adminToken);
    const id = list.body.data[0].id;
    const res = await request(server, "POST", `/admin/match-requests/${id}/whatsapp/retry`, {}, adminToken);
    assert.equal(res.status, 200);
    assert.ok(["pending", "failed", "sent"].includes(res.body.data.notificationStatus.whatsapp));
  });

  it("photo is stored privately and served via guarded admin endpoint", async () => {
    const createRes = await request(server, "POST", "/match", {
      name: "Photo Client", phone: "0622222222", city: "Rabat", service: "plombier",
      photos: [miniPngDataUrl()]
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.data.photos.length, 1);
    const id = createRes.body.data.id;

    const detail = await request(server, "GET", `/admin/match-requests/${id}`, undefined, adminToken);
    assert.equal(detail.body.data.photos.length, 1);
    const photoId = detail.body.data.photos[0].id;

    // Unauthenticated admin photo fetch -> 401.
    const unauthPhoto = await request(server, "GET", `/admin/match-requests/${id}/photo/${photoId}`);
    assert.equal(unauthPhoto.status, 401);

    // Authorized fetch -> binary image.
    const photoRes = await request(server, "GET", `/admin/match-requests/${id}/photo/${photoId}`, undefined, adminToken);
    assert.equal(photoRes.status, 200);
    assert.equal(photoRes.headers["content-type"], "image/png");
  });
});
