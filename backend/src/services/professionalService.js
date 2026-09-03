// Professional management — Scenario D: suspend / activate + full CRUD API.

const { AppError } = require("../utils/AppError");
const searchSvc = require("./searchService");
const subscriptionSvc = require("./subscriptionService");

// Public, paginated, searchable list (envelope from searchService).
async function list(repos, query) {
  // Lazy-expire any paid subscriptions whose period has elapsed so the badge
  // reflects an EFFECTIVE FREE account at read time.
  await subscriptionSvc.reconcileExpiredAcross(repos);
  return searchSvc.search(repos, query);
}

async function get(repos, professionalId) {
  await subscriptionSvc.reconcileExpiredForProfessional(repos, professionalId);
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  return pro;
}

async function create(repos, data, actor) {
  const id = await repos.ids.nextId("professional");
  const professional = await repos.professionals.create({
    ...data,
    id,
    status: data.status || "active",
    createdAt: new Date()
  });
  if (actor) {
    await repos.auditLogs.log({
      adminId: actor.id, adminName: actor.name,
      action: "CREATE_PROFESSIONAL", entity: "Professional",
      entityId: id, result: "Created", metadata: { name: data.name }
    });
  }
  return professional;
}

async function remove(repos, professionalId, actor) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  await repos.professionals.remove(professionalId);
  await repos.auditLogs.log({
    adminId: actor && actor.id, adminName: actor && actor.name,
    action: "DELETE_PROFESSIONAL", entity: "Professional",
    entityId: professionalId, result: "Deleted"
  });
  return { id: professionalId, deleted: true };
}

async function suspend(repos, professionalId, admin, reason) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  if (pro.status === "suspended") throw new AppError("Déjà suspendu.", 409);
  await repos.professionals.update(professionalId, { status: "suspended" });
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "PROFESSIONAL_SUSPENDED", entity: "Professional",
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
    action: "PROFESSIONAL_ACTIVATED", entity: "Professional",
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

module.exports = { suspend, activate, update, list, create, remove, get };