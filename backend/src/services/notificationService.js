const { AppError } = require("../utils/AppError");

async function markAllRead(repos) { return repos.notifications.markAllRead(); }
async function markRead(repos, id) { return repos.notifications.markRead(id); }
async function list(repos, filter) {
  if (filter === "unread") return repos.notifications.listUnread();
  return repos.notifications.list({}, { orderBy: { createdAt: "desc" } });
}

module.exports = { markAllRead, markRead, list };