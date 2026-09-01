const { AppError } = require("../utils/AppError");

async function update(repos, docId, data, admin) {
  const doc = await repos.legalDocs.get(docId);
  if (!doc) throw new AppError("Document légal introuvable.", 404);
  await repos.legalDocs.update(docId, { ...data, updatedAt: new Date(), updatedBy: admin.name });
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "LEGAL_UPDATED", entity: "LegalDocument",
    entityId: docId, result: "Updated"
  });
  return repos.legalDocs.get(docId);
}

module.exports = { update };