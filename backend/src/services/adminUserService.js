const bcrypt = require("bcrypt");
const { AppError } = require("../utils/AppError");
const { makeId } = require("../utils/id");
const env = require("../config/env");
const { ROLES } = require("../constants/roles");

// Public shape returned by the admin API — NEVER includes password hashes.
function toPublic(record) {
  if (Array.isArray(record)) return record.map(toPublic);
  if (!record) return record;
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    status: record.status,
    lastLogin: record.lastLogin ? new Date(record.lastLogin).toLocaleString("fr-MA") : "—",
    createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : ""
  };
}

async function list(repos) {
  const rows = await repos.adminUsers.list({}, { orderBy: { createdAt: "desc" } });
  return toPublic(rows);
}

async function create(repos, data) {
  if (!data.password || data.password.length < 8) throw new AppError("Mot de passe trop court (≥ 8 caractères).", 400);
  const email = String(data.email || "").toLowerCase();
  const existing = await repos.adminUsers.findByEmail(email);
  if (existing) throw new AppError("Cet email est déjà utilisé.", 409);
  if (!ROLES[data.role]) throw new AppError("Rôle inconnu: " + data.role, 400);
  const id = await makeId("adminUser", repos.ids);
  const password = await bcrypt.hash(data.password, env.bcryptRounds);
  const created = await repos.adminUsers.create({ id, name: data.name, email, role: data.role, status: "active", password, createdAt: new Date() });
  return toPublic(created);
}

async function update(repos, adminId, data = {}) {
  const admin = await repos.adminUsers.get(adminId);
  if (!admin) throw new AppError("Admin introuvable.", 404);

  // Change-direct (self) password flow: the helper must prove their current
  // password before the new one is accepted. Plain admin resets (no
  // currentPassword) keep working for super-admin resets.
  const suppliedCurrent = data.currentPassword;
  if (suppliedCurrent) {
    const ok = await bcrypt.compare(suppliedCurrent, admin.password);
    if (!ok) throw new AppError("Mot de passe actuel incorrect.", 401);
  }

  const updates = { ...data };
  delete updates.currentPassword;
  if (updates.email !== undefined) {
    updates.email = String(updates.email).toLowerCase();
    const clash = await repos.adminUsers.findByEmail(updates.email);
    if (clash && clash.id !== adminId) throw new AppError("Cet email est déjà utilisé.", 409);
  }
  if (updates.role !== undefined && !ROLES[updates.role]) throw new AppError("Rôle inconnu: " + updates.role, 400);
  if (updates.password) {
    if (String(updates.password).length < 8) throw new AppError("Mot de passe trop court (≥ 8 caractères).", 400);
    updates.password = await bcrypt.hash(updates.password, env.bcryptRounds);
  }
  const updated = await repos.adminUsers.update(adminId, updates);
  return toPublic(updated);
}

module.exports = { list, create, update };