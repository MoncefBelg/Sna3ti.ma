// Legal content service (req 24). Documents are keyed by (type, language)
// where type ∈ terms|privacy|about and language ∈ en|fr|ar. Each edit bumps
// the version. Publishing is admin-only.

const { AppError } = require("../utils/AppError");

const LEGAL_TYPES = ["terms", "privacy", "about"];
const LEGAL_LANGUAGES = ["en", "fr", "ar"];

function docId(type, language) { return `${type}-${language}`; }

async function list(repos, { published } = {}) {
  const docs = published
    ? repos.legalDocs.findPublished()
    : repos.legalDocs.list({}, { orderBy: { createdAt: "asc" } });
  return docs;
}

async function getByTypeAndLanguage(repos, type, language, { publishedOnly = false } = {}) {
  if (!LEGAL_TYPES.includes(type)) throw new AppError("Type de document légal invalide.", 400);
  if (!LEGAL_LANGUAGES.includes(language)) throw new AppError("Langue invalide (en|fr|ar).", 400);
  let doc = await repos.legalDocs.findByTypeAndLanguage(type, language);
  if (publishedOnly && doc && !doc.published) doc = null;
  return doc;
}

async function create(repos, { type, language, title, content }, admin) {
  if (!LEGAL_TYPES.includes(type)) throw new AppError("Type de document légal invalide.", 400);
  if (!LEGAL_LANGUAGES.includes(language)) throw new AppError("Langue invalide (en|fr|ar).", 400);
  if (!title || !title.trim()) throw new AppError("title requis.", 400);
  if (!content || !content.trim()) throw new AppError("content requis.", 400);

  const existing = await repos.legalDocs.findByTypeAndLanguage(type, language);
  if (existing) throw new AppError("Ce document légal existe déjà.", 409);

  const id = docId(type, language);
  const doc = await repos.legalDocs.create({
    id, type, language, title, content, version: 1, published: false, createdAt: new Date()
  });
  await repos.auditLogs.log({
    adminId: admin && admin.id, action: "LEGAL_CREATED",
    entity: "LegalDocument", entityId: id, note: `${type}/${language}`
  });
  return doc;
}

async function update(repos, id, data, admin) {
  const doc = await repos.legalDocs.get(id);
  if (!doc) throw new AppError("Document légal introuvable.", 404);

  const updates = { ...data, updatedAt: new Date() };
  if (data.content !== undefined || data.title !== undefined) {
    // Bump version whenever the body/title changes (new revision published).
    updates.version = (doc.version || 1) + 1;
  }
  delete updates.id;
  delete updates.type;
  delete updates.language;

  const updated = await repos.legalDocs.update(id, updates);
  await repos.auditLogs.log({
    adminId: admin && admin.id, action: "LEGAL_UPDATED",
    entity: "LegalDocument", entityId: id, reason: data.reason || null
  });
  return updated;
}

module.exports = { list, getByTypeAndLanguage, create, update, docId, LEGAL_TYPES, LEGAL_LANGUAGES };
