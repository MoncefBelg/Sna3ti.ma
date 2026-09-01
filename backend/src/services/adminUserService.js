const bcrypt = require("bcrypt");
const { AppError } = require("../utils/AppError");
const { makeId } = require("../utils/id");
const env = require("../config/env");
const { ROLES } = require("../constants/roles");

async function list(repos) {
  return repos.adminUsers.list({}, { orderBy: { createdAt: "desc" } });
}

async function create(repos, data) {
  if (!data.password || data.password.length < 8) throw new AppError("Mot de passe trop court (≥ 8 caractères).", 400);
  const existing = await repos.adminUsers.findByEmail(data.email);
  if (existing) throw new AppError("Cet email est déjà utilisé.", 409);
  if (!ROLES[data.role]) throw new AppError("Rôle inconnu: " + data.role, 400);
  const id = makeId("adminUser");
  const password = await bcrypt.hash(data.password, env.bcryptRounds);
  return repos.adminUsers.create({ id, name: data.name, email: data.email, role: data.role, status: "active", password, createdAt: new Date() });
}

async function update(repos, adminId, data) {
  const admin = await repos.adminUsers.get(adminId);
  if (!admin) throw new AppError("Admin introuvable.", 404);
  const updates = { ...data };
  if (data.password) {
    if (data.password.length < 8) throw new AppError("Mot de passe trop court.", 400);
    updates.password = await bcrypt.hash(data.password, env.bcryptRounds);
  }
  return repos.adminUsers.update(adminId, updates);
}

module.exports = { list, create, update };