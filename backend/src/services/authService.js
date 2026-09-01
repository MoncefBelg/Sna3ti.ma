const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { AppError } = require("../utils/AppError");

function signToken(admin) {
  return jwt.sign(
    { sub: admin.id, role: admin.role, name: admin.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

async function login(repos, { email, password }) {
  const adminUser = await repos.adminUsers.findByEmail(email);
  if (!adminUser) throw new AppError("Identifiants invalides.", 401);
  if (adminUser.status !== "active") throw new AppError("Compte inactif.", 403);

  const valid = await bcrypt.compare(password, adminUser.password);
  if (!valid) throw new AppError("Identifiants invalides.", 401);

  await repos.adminUsers.update(adminUser.id, { lastLogin: new Date() });
  await repos.auditLogs.log({
    adminId: adminUser.id,
    adminName: adminUser.name,
    action: "LOGIN",
    entity: "Admin",
    entityId: adminUser.email,
    result: "Success"
  });

  return { token: signToken(adminUser), user: pickPublic(adminUser) };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (e) {
    return null;
  }
}

async function getMe(repos, adminId) {
  const admin = await repos.adminUsers.get(adminId);
  if (!admin || admin.status !== "active") return null;
  return pickPublic(admin);
}

function pickPublic(a) {
  return { id: a.id, name: a.name, email: a.email, role: a.role, status: a.status };
}

module.exports = { login, verifyToken, getMe, signToken, pickPublic };