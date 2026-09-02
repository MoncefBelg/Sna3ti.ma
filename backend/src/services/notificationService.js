// Notification service (req 25). Notifications are per-user, ordered newest
// first. Fields: id, userId, type, title, message, entityType, entityId,
// readAt, createdAt.

const { isTest } = require("../config/env");
const { ID_PREFIXES } = require("../constants/statuses");

let localSeqSeed = null;
function prefixId(prefix) {
  // Fallback id generator for environments without a sequence store.
  const base = ID_PREFIXES[prefix] || prefix.toUpperCase();
  return `${base}-${Date.now().toString().slice(-5)}`;
}

async function list(repos, userId) {
  if (userId) return repos.notifications.listForUser(userId);
  return repos.notifications.listUnread();
}

async function markRead(repos, id, userId) {
  await repos.notifications.markRead(id, userId);
  return repos.notifications.get(id);
}

async function markAllRead(repos, userId) {
  await repos.notifications.markAllRead(userId);
  return { ok: true };
}

async function create(repos, data) {
  const { ids } = repos;
  const id = ids && typeof ids.nextId === "function"
    ? await ids.nextId("notification")
    : prefixId("notification");
  return repos.notifications.create({
    id,
    userId: data.userId || null,
    type: data.type || "system",
    title: data.title || null,
    message: data.message,
    entityType: data.entityType || null,
    entityId: data.entityId || null,
    readAt: null,
    createdAt: new Date()
  });
}

module.exports = { list, markRead, markAllRead, create };
