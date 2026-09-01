// Professional management — Scenario D: suspend / activate.

const { AppError } = require("../utils/AppError");

async function suspend(repos, professionalId, admin, reason) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  if (pro.status === "suspended") throw new AppError("Déjà suspendu.", 409);
  await repos.professionals.update(professionalId, { status: "suspended" });
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "SUSPEND_PROFESSIONAL", entity: "Professional",
    entityId: professionalId, result: "Suspended", note: reason || null
  });
  return repos.professionals.get(professionalId);
}

async function activate(repos, professionalId, admin) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  if (pro.status !== "suspended") throw new AppError("Le compte n'est pas suspendu.", 409);
  await repos.professionals.update(professionalId, { status: "active" });
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "ACTIVATE_PROFESSIONAL", entity: "Professional",
    entityId: professionalId, result: "Activated"
  });
  return repos.professionals.get(professionalId);
}

async function update(repos, professionalId, data, admin) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  await repos.professionals.update(professionalId, data);
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "UPDATE_PROFESSIONAL", entity: "Professional",
    entityId: professionalId, result: "Updated"
  });
  return repos.professionals.get(professionalId);
}

module.exports = { suspend, activate, update };