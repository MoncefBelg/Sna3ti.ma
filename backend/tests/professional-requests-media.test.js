// Professional media pipeline (REQ 53) integration regression tests.
//
// Covers the full flow that was previously broken end-to-end: an artisan
// uploads profile photo + échantillon photos/videos during onboarding and the
// admin must be able to SEE them (guarded serving) during review, then the
// media carries over to the professional account after approval.
//
//   1. Public upload (multipart) attaches media to a pending request.
//   2. Plan gates are server-authoritative: FREE = photos only (video -> 400);
//      Vérifié/GOLD allow videos; quotas enforced.
//   3. Admin guarded GET serves the bytes (RBAC 401/403/200).
//   4. Admin DELETE removes an entry.
//   5. Approval copies request media onto the Professional (pro.media).
//   6. Professional media servable publicly (portfolio) + via admin guard.

const { describe, it, before, after } = require("node:test");
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

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function upload(server, pathname, { kind, label, file = { name: "photo.gif", mime: "image/gif", buffer: GIF }, token } = {}) {
  return new Promise((resolve, reject) => {
    const boundary = "----Sna3tiMedia" + Math.random().toString(16).slice(2);
    const head = [];
    if (kind) head.push(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}\r\n`);
    if (label) head.push(`--${boundary}\r\nContent-Disposition: form-data; name="label"\r\n\r\n${label}\r\n`);
    head.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.mime}\r\n\r\n`);
    const tail = `\r\n--${boundary}--\r\n`;
    const body = Buffer.concat([
      ...head.map((s) => Buffer.from(s)),
      file.buffer,
      Buffer.from(tail)
    ]);
    const headers = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length)
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const opts = { method: "POST", hostname: "127.0.0.1", port: server.address().port, path: "/api/v1" + pathname, headers };
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
    req.write(body);
    req.end();
  });
}

function mediaGET(server, pathname, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const opts = { method: "GET", hostname: "127.0.0.1", port: server.address().port, path: "/api/v1" + pathname, headers };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, bytes: buf, body: buf.toString("utf8") });
      });
    });
    req.on("error", reject);
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

const superAdmin = { id: "a-1", name: "Super Admin", email: "a@x.ma", password: "x", role: "super_admin", status: "active" };
const finance = { id: "a-2", name: "Finance", email: "f@x.ma", password: "x", role: "finance", status: "active" };

function basePayload(overrides) {
  return {
    firstName: "Karim", lastName: "El Amrani", phone: "+212612345678",
    profession: "electricien", city: "casablanca", cityLabel: "Casablanca",
    description: "Travail soigné", price: 120, priceUnit: "DH",
    plan: "free",
    ...(overrides || {})
  };
}

async function createRequest(server, overrides) {
  const phone = (overrides && overrides.phone)
    ? overrides.phone
    : `+2126${String(Math.floor(70000000 + Math.random() * 20000000))}`;
  const res = await request(server, "POST", "/professional-requests", basePayload({ phone, ...(overrides || {}) }));
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id;
}

describe("Professional media pipeline (REQ 53)", () => {
  let server, token;

  before(async () => {
    const db = createInMemoryDb({ adminUser: [superAdmin, finance], plan: PLANS });
    const app = createApp({ db });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    token = makeToken(superAdmin);
  });

  after(() => server.close());

  it("FREE request: profile photo + échantillon photos upload via multipart (201)", async () => {
    const id = await createRequest(server, { plan: "free" });
    const p1 = await upload(server, `/professional-requests/${id}/media`, { kind: "profile", label: "Mon visage" });
    assert.equal(p1.status, 201);
    assert.equal(p1.body.success, true);
    assert.match(p1.body.data.id, /^MED-\d+$/);
    assert.equal(p1.body.data.kind, "profile");
    assert.equal(p1.body.data.type, "photo");
    assert.equal(p1.body.data.label, "Mon visage");
    assert.ok(p1.body.data.fileUrl.startsWith("/files/professional-requests/"));

    const e1 = await upload(server, `/professional-requests/${id}/media`, { kind: "echantillon", label: "Tableau posé" });
    assert.equal(e1.status, 201);
    assert.equal(e1.body.data.kind, "echantillon");

    const detail = await request(server, "GET", `/admin/professional-requests/${id}`, null, token);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.media.length, 2);
  });

  it("FREE plan REJECTS videos (photos only) — 400 with clear message", async () => {
    const id = await createRequest(server, { plan: "free" });
    const v = await upload(server, `/professional-requests/${id}/media`, {
      kind: "echantillon", label: "Vidéo chantier",
      file: { name: "clip.mp4", mime: "video/mp4", buffer: Buffer.from("fake-mp4-bytes") }
    });
    assert.equal(v.status, 400);
    assert.match(String(v.body.error.message), /GRATUIT n'autorise pas les vidéos/i);
  });

  it("Vérifié plan ALLOWS photos and videos, and enforces quota ceilings", async () => {
    const id = await createRequest(server, { plan: "verified" });
    const p1 = await upload(server, `/professional-requests/${id}/media`, { kind: "echantillon" });
    const p2 = await upload(server, `/professional-requests/${id}/media`, { kind: "echantillon" });
    assert.equal(p1.status, 201);
    assert.equal(p2.status, 201);
    const v = await upload(server, `/professional-requests/${id}/media`, {
      kind: "echantillon",
      file: { name: "clip.mp4", mime: "video/mp4", buffer: Buffer.from("mp4-bytes") }
    });
    assert.equal(v.status, 201);
    assert.equal(v.body.data.type, "video");

    // One more video pushes past the 3-video ceiling for Vérifié.
    const v2 = await upload(server, `/professional-requests/${id}/media`, {
      kind: "echantillon",
      file: { name: "clip2.mp4", mime: "video/mp4", buffer: Buffer.from("mp4-bytes-2") }
    });
    assert.equal(v2.status, 201);
    const v3 = await upload(server, `/professional-requests/${id}/media`, {
      kind: "echantillon",
      file: { name: "clip3.mp4", mime: "video/mp4", buffer: Buffer.from("mp4-bytes-3") }
    });
    assert.equal(v3.status, 201);
    const v4 = await upload(server, `/professional-requests/${id}/media`, {
      kind: "echantillon",
      file: { name: "clip4.mp4", mime: "video/mp4", buffer: Buffer.from("mp4-bytes-4") }
    });
    assert.equal(v4.status, 400);
    assert.match(String(v4.body.error.message), /vidéo/i);
  });

  it("admin guarded GET serves the media bytes (RBAC: 401 / 403 / 200)", async () => {
    const id = await createRequest(server, { plan: "free" });
    const up = await upload(server, `/professional-requests/${id}/media`, { kind: "profile" });
    const mediaId = up.body.data.id;

    const anon = await mediaGET(server, `/admin/professional-requests/${id}/media/${mediaId}`);
    assert.equal(anon.status, 401);

    const fin = await mediaGET(server, `/admin/professional-requests/${id}/media/${mediaId}`, makeToken(finance));
    assert.equal(fin.status, 403);

    const ok = await mediaGET(server, `/admin/professional-requests/${id}/media/${mediaId}`, token);
    assert.equal(ok.status, 200);
    assert.match(String(ok.headers["content-type"]), /image\/gif/);
    assert.deepEqual([...ok.bytes], [...GIF]);
  });

  it("admin DELETE removes a request media entry", async () => {
    const id = await createRequest(server, { plan: "free" });
    const up = await upload(server, `/professional-requests/${id}/media`, { kind: "echantillon" });
    const mediaId = up.body.data.id;

    const del = await request(server, "DELETE", `/admin/professional-requests/${id}/media/${mediaId}`, null, token);
    assert.equal(del.status, 200);
    assert.equal(del.body.data.removed, true);

    const detail = await request(server, "GET", `/admin/professional-requests/${id}`, null, token);
    assert.equal(detail.body.data.media.length, 0);
  });

  it("approval carries request media onto the Professional; media servable via admin guard and publicly", async () => {
    const id = await createRequest(server, { plan: "free" });
    const up = await upload(server, `/professional-requests/${id}/media`, { kind: "profile", label: "Profil" });
    const mediaId = up.body.data.id;

    const appr = await request(server, "POST", `/admin/professional-requests/${id}/approve`, null, token);
    assert.equal(appr.status, 200);
    const proId = appr.body.data.professionalId;
    assert.ok(proId);

    const proDetail = await request(server, "GET", `/admin/professionals/${proId}`, null, token);
    assert.equal(proDetail.status, 200);
    assert.equal((proDetail.body.data.media || []).length, 1);
    assert.equal(proDetail.body.data.media[0].kind, "profile");
    assert.equal(proDetail.body.data.media[0].id, mediaId);

    // Admin guard serves professional media.
    const adminBytes = await mediaGET(server, `/admin/professionals/${proId}/media/${mediaId}`, token);
    assert.equal(adminBytes.status, 200);
    assert.deepEqual([...adminBytes.bytes], [...GIF]);

    // Public portfolio serving (no auth).
    const pub = await mediaGET(server, `/professionals/${proId}/media/${mediaId}`);
    assert.equal(pub.status, 200);
    assert.deepEqual([...pub.bytes], [...GIF]);
  });
});