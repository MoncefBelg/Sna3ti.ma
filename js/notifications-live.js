/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/notifications-live.js
   Live bridge between the backend ADMIN notifications feed
   (GET /admin/notifications — see backend routes/index.js) and
   the topbar bell + Notifications page.
   Backend rows are {id,type,title,message,readAt,createdAt,
   entityType,entityId}. The UI consumes the demo record shape
   {id,type,text,when,unread,route}. This module normalises one
   to the other, keeps a shared cache (window.__LIVE_NOTIFS),
   periodicaly polls so the bell count stays fresh without SSE,
   and routes every "mark read" to the backend.
   Exposes `Sna3tiNotificationsLive`.
   ============================================================ */

(function (global) {
  "use strict";

  var API = global.Sna3tiNotificationsApi;
  if (!API) throw new Error("notifications-api.js must load before notifications-live.js");

  var ROUTES = {
    registration: "registrations",
    verification: "registrations",
    payment: "payments",
    report: "reports",
    review: "reviews",
    subscription: "subscriptions",
    support: "support",
    user: "users",
    match: "match-requests",
    search: "",
    system: ""
  };

  function whenText(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var diff = Date.now() - d.getTime();
    if (Number.isNaN(diff)) return String(iso);
    var m = Math.floor(diff / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return "il y a " + m + " min";
    var h = Math.floor(m / 60);
    if (h < 24) return "il y a " + h + " h";
    return d.toLocaleDateString("fr-MA", { day: "numeric", month: "short" });
  }

  function normalize(row) {
    var type = String((row && row.type) || "system").toLowerCase();
    return {
      id: row.id,
      type: type,
      text: row.message || row.title || "",
      when: whenText(row.createdAt),
      unread: !row.readAt,
      route: ROUTES[type] || ""
    };
  }

  function isReady() { return !!global.__LIVE_NOTIFS_READY; }

  function list() { return (global.__LIVE_NOTIFS || []).slice(); }

  function unreadCount() { return list().filter(function (n) { return n.unread; }).length; }

  function remember(rows, unreadCount) {
    global.__LIVE_NOTIFS = rows;
    if (typeof unreadCount === "number") global.__LIVE_NOTIF_UNREAD = unreadCount;
    else global.__LIVE_NOTIF_UNREAD = rows.filter(function (n) { return n.unread; }).length;
    global.__LIVE_NOTIFS_READY = true;
    emit();
    return list();
  }

  function refresh() {
    return API.list({ limit: 60 }).then(function (res) {
      var rows = (res && res.data && Array.isArray(res.data)) ? res.data : [];
      return remember(rows.map(normalize), res && res.unreadCount);
    }).catch(function (err) {
      // Network/API failure: keep the last good snapshot, never block the UI.
      global.__LIVE_NOTIFS_FAILED = true;
      return list();
    });
  }

  function unreadCount() {
    if (typeof global.__LIVE_NOTIF_UNREAD === "number") return global.__LIVE_NOTIF_UNREAD;
    return list().filter(function (n) { return n.unread; }).length;
  }

  var hooks = [];
  function onChange(fn) {
    if (typeof fn === "function") hooks.push(fn);
  }
  function emit() {
    hooks.slice().forEach(function (h) {
      try { h(list()); } catch (e) { /* hook must never break the feed */ }
    });
  }

  function markRead(id) {
    return API.markRead(id).then(function () { return refresh(); }).catch(function () { return list(); });
  }

  function markAllRead() {
    return API.markAllRead().then(function () { return refresh(); }).catch(function () { return list(); });
  }

  global.Sna3tiNotificationsLive = {
    refresh: refresh,
    list: list,
    normalize: normalize,
    isReady: isReady,
    unreadCount: unreadCount,
    onChange: onChange,
    markRead: markRead,
    markAllRead: markAllRead
  };

  // Periodic poll so the bell dot stays accurate without a websocket.
  if (global.setInterval) {
    global.setInterval(function () {
      if (isReady()) refresh();
    }, 20000);
  }

})(window);