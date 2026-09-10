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
  // Customer scope: the user's own feed.
  if (userId) return repos.notifications.listForUser(userId);
  // Admin scope (GET /admin/notifications): FULL history of the broadcast feed
  // (userId null), newest first, plus the live unread counter so the bell can
  // show "n non lues" without polling the whole store twice.
  const [rows, unreadCount] = await Promise.all([
    repos.notifications.list({ userId: null }, { orderBy: { createdAt: "desc" } }),
    repos.notifications.count({ userId: null, readAt: null })
  ]);
  return { rows, unreadCount };
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

// Admin feed notification: a broadcast (userId null) surfaced in the admin
// notifications centre (GET /admin/notifications -> listUnread). Every
// UI-originated event that mutates state should raise one so the dashboard
// never misses a request, review or payment. Id is minted server-side.
async function notifyAdmin(repos, data) {
  return create(repos, {
    userId: null,
    type: data.type || "system",
    title: data.title,
    message: data.message,
    entityType: data.entityType,
    entityId: data.entityId
  });
}

module.exports = { list, markRead, markAllRead, create, notifyAdmin };
