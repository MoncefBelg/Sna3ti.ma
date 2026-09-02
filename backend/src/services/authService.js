const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { AppError } = require("../utils/AppError");

// Roles valid for the `User.role` enum (kept in sync with the Prisma
// UserRole enum: USER, PROFESSIONAL, ADMIN, SUPER_ADMIN, MODERATOR, FINANCE,
// SUPPORT). Used to whitelist roles accepted by /auth/register. User-vs-admin
// disambiguation is table-based (see resolveActor), NOT role-based, because
// these same role values also appear on AdminUser.
const USER_ROLES = new Set([
  "user", "professional", "admin", "super_admin", "moderator", "finance", "support"
]);

// Access tokens are short-lived and carry a MINIMAL payload — never the
// password, never profile details. `sub` is the opaque id, `role` enables
// RBAC and user-vs-admin disambiguation.
function signToken(actor) {
  return jwt.sign({ sub: actor.id, role: actor.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });
}

// Longer-lived refresh token used to obtain new access tokens via /auth/refresh.
function signRefreshToken(actor) {
  return jwt.sign({ sub: actor.id, role: actor.role, kind: "refresh" }, env.jwtSecret, {
    expiresIn: "30d"
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (e) {
    return null;
  }
}

// ── Login ────────────────────────────────────────────────────────────────────
// Unified: an email resolves to either an AdminUser or a platform User.
async function login(repos, { email, password }) {
  if (!email || !password) throw new AppError("Email et mot de passe requis.", 400);

  const adminUser = await repos.adminUsers.findByEmail(email);
  if (adminUser) {
    if (adminUser.status !== "active") throw new AppError("Compte inactif.", 403);
    const valid = await bcrypt.compare(password, adminUser.password);
    if (!valid) throw new AppError("Identifiants invalides.", 401);
    await repos.adminUsers.update(adminUser.id, { lastLogin: new Date() });
    await repos.auditLogs.log({
      adminId: adminUser.id, adminName: adminUser.name,
      action: "LOGIN", entity: "Admin", entityId: adminUser.email, result: "Success"
    });
    return {
      token: signToken(adminUser),
      refreshToken: signRefreshToken(adminUser),
      user: pickAdminPublic(adminUser)
    };
  }

  const user = await repos.users.findByEmail(email);
  if (!user) throw new AppError("Identifiants invalides.", 401);
  if (user.status !== "active") throw new AppError("Compte inactif.", 403);
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError("Identifiants invalides.", 401);
  await repos.users.update(user.id, { lastLoginAt: new Date() });

  return { token: signToken(user), refreshToken: signRefreshToken(user), user: pickUserPublic(user) };
}

// ── Register a platform user ─────────────────────────────────────────────────
async function register(repos, body) {
  const { firstName, lastName, email, phone, password, cityId } = body || {};
  if (!firstName || !lastName) throw new AppError("Prénom et nom requis.", 400);
  if (!phone) throw new AppError("Numéro de téléphone requis.", 400);
  if (!password || String(password).length < 8) throw new AppError("Mot de passe trop court (≥ 8 caractères).", 400);

  if (await repos.users.findByPhone(phone)) throw new AppError("Ce numéro est déjà utilisé.", 409);
  if (email && await repos.users.findByEmail(email)) throw new AppError("Cet email est déjà utilisé.", 409);

  // NEVER trust a role submitted by the client. Public registration always
  // creates a `user`; admin/moderator/finance/... roles can only be assigned
  // server-side (e.g. via admin_users.manage).
  const safeRole = "user";
  const id = await repos.ids.nextId("user");
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const fullName = `${firstName} ${lastName}`.trim();

  const user = await repos.users.create({
    id,
    firstName,
    lastName,
    name: fullName,
    email: email ? email.toLowerCase() : null,
    phone,
    passwordHash,
    role: safeRole,
    cityId: cityId || null,
    status: "active",
    createdAt: new Date()
  });

  await repos.auditLogs.log({
    action: "USER_REGISTERED", entity: "User",
    entityId: id, result: "Success",
    metadata: { email: user.email, role: safeRole }
  });

  return {
    token: signToken(user),
    refreshToken: signRefreshToken(user),
    user: pickUserPublic(user)
  };
}

// ── Refresh ──────────────────────────────────────────────────────────────────
async function refresh(repos, { refreshToken }) {
  if (!refreshToken) throw new AppError("Refresh token requis.", 400);
  const decoded = verifyToken(refreshToken);
  if (!decoded || decoded.kind !== "refresh") throw new AppError("Refresh token invalide.", 401);

  const actor = { id: decoded.sub, role: decoded.role };
  const fresh = await getActor(repos, actor);
  if (!fresh) throw new AppError("Compte introuvable ou inactif.", 401);

  return { token: signToken(fresh), user: pickActorPublic(fresh) };
}

// ── Logout ───────────────────────────────────────────────────────────────────
// Stateless JWT: nothing to revoke server-side. Present for API symmetry and
// future refresh-token denylist support.
async function logout() {
  return { success: true };
}

// ── /auth/me ─────────────────────────────────────────────────────────────────
// Resolves an actor (User or AdminUser) by `id`. Disambiguation is
// table-based because role values overlap between User.role and AdminUser.role
// (e.g. "admin"/"super_admin" are valid for both). A `sub` lives in exactly
// one table, so we try `users` first, then `adminUsers`.
async function resolveActor(repos, { id, role }) {
  const user = await repos.users.get(id);
  if (user) return { kind: "user", record: user };
  const admin = await repos.adminUsers.get(id);
  if (admin) return { kind: "admin", record: admin };
  return null;
}

// Returns the active User/AdminUser record, or null if missing/inactive.
async function getActor(repos, actor) {
  const found = await resolveActor(repos, actor);
  return (found && found.record.status === "active") ? found.record : null;
}

async function getMe(repos, actor) {
  const fresh = await getActor(repos, actor);
  return fresh ? pickActorPublic(fresh) : null;
}

// Raw AdminUser record, used by the auth middleware to expose `name` to the
// /admin services (audit trails, reviewer names, ...).
async function getAdmin(repos, id) {
  return repos.adminUsers.get(id) || null;
}

function pickActorPublic(actor) {
  if (actor && "passwordHash" in actor) return pickUserPublic(actor);
  return pickAdminPublic(actor);
}

function pickAdminPublic(a) {
  return { id: a.id, name: a.name, email: a.email, role: a.role, status: a.status };
}

function pickUserPublic(u) {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    lastLoginAt: u.lastLoginAt
  };
}

module.exports = {
  login, register, refresh, logout, verifyToken, getMe, getAdmin, signToken, signRefreshToken,
  pickAdminPublic, pickUserPublic, pickActorPublic, USER_ROLES
};
