/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/sna3ti-bridge.js
   Sync-cache bridge between the Sna3tiData facade and the REST API.

   DESIGN (as chosen):
     - Sna3tiData stays SYNCHRONOUS. The admin UI reads it and renders
       immediately — the bridge must never break that.
     - Read paths are already served by Sna3tiData's local (rich, demo)
       store. The bridge overlays AUTHORITATIVE backend status on top,
       rather than replacing the rich store with lean API records that
       would break badge/media/KPI rendering.
     - Core admin WRITE methods are intercepted fire-and-forget: they
       return their normal synchronous result IMMEDIATELY (zero render
       breakage) and a background request pushes the change to the REST
       API, then reconciles the local record's authoritative fields.

   Intercepted writes (core admin, backend-supported):
     professionals  -> Sna3tiProfessionalsApi (including suspend/activate)
     subscriptions  -> Sna3tiSubscriptionsApi / Sna3tiPaymentFlow
     payments       -> Sna3tiPaymentsApi
     verifications  -> Sna3tiVerification
     reviews        -> Sna3tiReviewsApi
     reports        -> Sna3tiReportsApi

   Additional data pulls on syncNow():
     admin users, audit logs, notifications, settings (GET /admin/*)

   Async data access:
     getDashboard()      -> GET /admin/dashboard  (KPI counts)
     searchPublic(params) -> GET /search          (public marketplace)

   Security:
     onForbidden(fn)     -> register a 403 callback
     isForbidden(err)    -> check if an error is 403

   Exposes `Sna3tiBridge`: { install(), syncNow(), isReachable(),
   pending(), queue(), primed, getDashboard(), searchPublic(),
   onForbidden(), isForbidden() } and a helper to re-prime.

   Load AFTER admin-data.js (Sna3tiData must exist) and AFTER the
   *-api modules.
   ============================================================ */

(function (global) {
  "use strict";

  var DATA = global.Sna3tiData || null;
  var Api = global.Sna3tiApi || null;
  var Fallback = global.Sna3tiFallback || null;
  var ProApi = global.Sna3tiProfessionalsApi || null;
  var SubApi = global.Sna3tiSubscriptionsApi || null;
  var PayApi = global.Sna3tiPaymentsApi || null;
  var VerSvc = global.Sna3tiVerification || null;
  var RevApi = global.Sna3tiReviewsApi || null;
  var RepApi = global.Sna3tiReportsApi || null;
  var Flow = global.Sna3tiPaymentFlow || null;
  var DashApi = global.Sna3tiDashboardApi || null;
  var SettingsApi = global.Sna3tiSettingsApi || null;
  var AdminUsersApi = global.Sna3tiAdminUsersApi || null;
  var AuditApi = global.Sna3tiAuditApi || null;
  var NotifApi = global.Sna3tiNotificationsApi || null;
  var SearchApi = global.Sna3tiSearchApi || null;

  var primed = false;
  var syncQueue = [];
  var reachable = false;
  var forbiddenCallback = null;
  // Safe-fallback gating (REQ: production NEVER silently falls back to demo
  // data). lastSyncError records the most recent authoritative-sync failure in
  // production so the UI can show an offline/API error instead of stale demo.
  var lastSyncError = null;

  /**
   * Centralized mock-fallback decision. NEVER scatter env checks elsewhere;
   * always consult this single helper.
   *   browser: reads window.SNA3TI_ENV / SNA3TI_ALLOW_MOCK_FALLBACK
   *   node:    reads process.env (tests)
   */
  function canUseMockFallback() {
    return Fallback ? Fallback.canUseMockFallback() : false;
  }

  function envGateDetails() {
    return Fallback ? Fallback.reasoning() : { env: "unknown", canFallback: false, reason: "fallback gate unavailable" };
  }

  function enabled() {
    return !!(DATA && Api && ProApi && SubApi && PayApi && RevApi && RepApi);
  }

  /** Access the live mutations reference used by Sna3tiData. */
  function store() {
    return (DATA && DATA._store) || null;
  }

  // ------------------------------------------------------------------
  // Fire-and-forget: run an async op, keep a pending queue, reconcile.
  // ------------------------------------------------------------------
  function enqueue(label, fn) {
    var task = { label: label, status: "pending", at: new Date().toISOString() };
    syncQueue.push(task);
    Promise.resolve()
      .then(fn)
      .then(function (res) {
        if (res && res.success === false && (res.code === "FORBIDDEN" || res.status === 403)) {
          task.status = "forbidden";
          if (forbiddenCallback) forbiddenCallback(res, label);
        } else {
          task.status = res && res.success === false ? "error" : "ok";
        }
      })
      .catch(function (err) {
        if (err && (err.code === "FORBIDDEN" || err.status === 403)) {
          task.status = "forbidden";
          if (forbiddenCallback) forbiddenCallback(err, label);
        } else {
          task.status = "error";
          task.message = (err && err.message) || String(err);
        }
      });
    return task;
  }

  /** Patch an entity in a local collection by id with authoritative fields. */
  function reconcile(storeKey, id, patch) {
    var s = store();
    if (!s || !Array.isArray(s[storeKey])) return;
    var rec = s[storeKey].find(function (x) { return x.id === id; });
    if (!rec) return;
    Object.keys(patch || {}).forEach(function (k) {
      if (patch[k] !== undefined) rec[k] = patch[k];
    });
  }

  // ------------------------------------------------------------------
  // Field mappers from API -> local Sna3tiData shape.
  // ------------------------------------------------------------------
  function mapProfessional(remote) {
    if (!remote) return null;
    // Keep only authoritative status-bearing fields; let the rich local
    // shape hold onto media/leads/details. Opaque IDs pass through.
    var out = {
      id: remote.id,
      name: remote.name,
      job: remote.job,
      city: remote.city,
      phone: remote.phone,
      email: remote.email,
      description: remote.description
    };
    if (remote.package) out.package = remote.package;
    if (remote.status) out.status = remote.status;
    if (remote.subscriptionStatus) out.subscriptionStatus = remote.subscriptionStatus;
    if (remote.verificationStatus) out.verificationStatus = remote.verificationStatus;
    if (remote.verification) out.verificationStatus = remote.verification;
    return out;
  }

  function mapSubscription(remote) {
    if (!remote) return null;
    return {
      id: remote.id,
      professionalId: remote.professionalId,
      planId: remote.planId,
      planName: remote.planName || remote.plan && remote.plan.name,
      planCode: remote.plan && remote.plan.code,
      status: remote.status,
      paymentStatus: remote.paymentStatus,
      price: remote.price,
      since: remote.startDate || remote.since
    };
  }

  function mapPayment(remote) {
    if (!remote) return null;
    return {
      id: remote.id,
      reference: remote.reference,
      professionalId: remote.professionalId,
      planName: remote.planName || remote.plan && remote.plan.name,
      amount: remote.amount,
      currency: remote.currency || "MAD",
      method: remote.method,
      status: remote.status,
      rejectionReason: remote.rejectionReason,
      bankRef: remote.bankRef,
      date: remote.createdAt || remote.date
    };
  }

  function mapVerification(remote) {
    if (!remote) return null;
    return {
      id: remote.id,
      professionalId: remote.professionalId,
      level: remote.level,
      status: remote.status,
      reason: remote.reason,
      infoRequested: remote.infoRequested
    };
  }

  function unwrapList(res) { return res && res.data ? res.data : (Array.isArray(res) ? res : []); }

  /** Merge API lists into the local store by id, adding new and patching
   *  authoritative status, without flattening richer local records. */
  function mergeList(storeKey, list, mapFn) {
    var s = store();
    if (!s || !Array.isArray(list)) return;
    var src = s[storeKey] || (s[storeKey] = []);
    list.forEach(function (remote) {
      var head = mapFn ? mapFn(remote) : remote;
      if (!head) return;
      var idx = src.findIndex(function (x) { return x.id === head.id; });
      if (idx === -1) { src.push(head); return; }
      Object.keys(head).forEach(function (k) {
        if (head[k] !== undefined) src[idx][k] = head[k];
      });
    });
  }

  function pullPlans() {
    if (!SubApi || !SubApi.plans) return Promise.resolve();
    return SubApi.plans.list()
      .then(function (res) {
        var list = unwrapList(res);
        var own = store();
        if (own) own.subscriptionPlans = own.subscriptionPlans || [];
        list.forEach(function (p) {
          var local = {
            id: p.id, code: p.code, name: p.name, price: p.price,
            currency: p.currency, active: p.active !== false
          };
          mergeList("subscriptionPlans", [local], null);
        });
      })
      .catch(function (err) { recordSyncFailure(err, "plans"); });
  }

  /**
   * Record an authoritative-sync failure. In production mock fallback is
   * forbidden, so a failure MUST be surfaced as an offline/error state rather
   * than silently falling back to demo data. In explicitly-enabled development
   * the failure is noted but the demo fallback remains permitted.
   */
  function recordSyncFailure(err, label) {
    var code = (err && (err.code || err.status)) || "NETWORK_ERROR";
    var message = (err && err.message) || "Impossible de joindre le serveur.";
    // A successful empty response must NOT be treated as a failure (REQ: do
    // not confuse [] with an error).
    lastSyncError = { label: label || "sync", code: code, message: message, at: new Date().toISOString() };
    if (!canUseMockFallback()) {
      // In production, surface the failure through the pending queue so the
      // UI can render an offline/API-error state instead of demo data.
      syncQueue.push({ label: label || "sync", status: "error", message: message });
    }
  }

  /** Run a sync job; a rejected job becomes an error state (not silent). */
  function track(jobLabel, promise) {
    return Promise.resolve(promise)
      .catch(function (err) { recordSyncFailure(err, jobLabel); return { success: false }; });
  }

  /** Pull authoritative read collections from the API into the local cache. */
  function syncNow() {
    if (!enabled()) return Promise.resolve({ success: false, code: "UNSUPPORTED" });
    reachable = true;
    lastSyncError = null;
    var jobs = [];

    jobs.push(track("plans", pullPlans()));

    if (ProApi.list) {
      jobs.push(track("professionals", ProApi.list({ limit: 500 }).then(function (res) { mergeList("professionals", unwrapList(res), mapProfessional); })));
    }
    if (SubApi.list) {
      jobs.push(track("subscriptions", SubApi.list({ limit: 500 }).then(function (res) { mergeList("subscriptions", unwrapList(res), mapSubscription); })));
    }
    if (PayApi.list) {
      jobs.push(track("payments", PayApi.list().then(function (res) { mergeList("payments", unwrapList(res), mapPayment); })));
    }
    if (VerSvc && VerSvc.list) {
      jobs.push(track("verifications", VerSvc.list({ limit: 500 }).then(function (res) { mergeList("verificationRequests", unwrapList(res.data || { data: unwrapList(res) }), mapVerification); })));
    }
    if (RevApi.list) {
      jobs.push(track("reviews", RevApi.list().then(function (res) { mergeList("reviews", unwrapList(res), null); })));
    }
    if (RepApi.list) {
      jobs.push(track("reports", RepApi.list().then(function (res) { mergeList("reports", unwrapList(res), null); })));
    }

    // ---- Admin users, audit logs, notifications, settings ----
    if (AdminUsersApi && AdminUsersApi.list) {
      jobs.push(track("adminUsers", AdminUsersApi.list().then(function (res) { mergeList("adminUsers", unwrapList(res), null); })));
    }
    if (AuditApi && AuditApi.list) {
      jobs.push(track("auditLogs", AuditApi.list().then(function (res) { mergeList("auditLogs", unwrapList(res), null); })));
    }
    if (NotifApi && NotifApi.list) {
      jobs.push(track("notifications", NotifApi.list().then(function (res) { mergeList("notifications", unwrapList(res), null); })));
    }
    if (SettingsApi && SettingsApi.get) {
      jobs.push(track("settings", SettingsApi.get().then(function (res) {
        var s = store();
        var d = res && res.data ? res.data : res;
        if (s && d && typeof d === "object") {
          if (d.siteName) s.config.platformName = d.siteName;
          if (d.currency) s.config.currency = d.currency;
          if (d.locale) s.config.defaultLanguage = d.locale;
        }
      })));
    }

    return Promise.all(jobs).then(function () {
      primed = true;
      if (DATA && DATA.persist) DATA.persist();
      return { success: true, primed: true, lastSyncError: lastSyncError };
    });
  }

  // ------------------------------------------------------------------
  // Intercept a Sna3tiData method to also push to the backend, while
  // returning the original (sync) value unchanged.
  // bound is the original sync method (this-bound to DATA).
  // ------------------------------------------------------------------
  function intercept(name, backendCall) {
    if (!DATA || typeof DATA[name] !== "function") return;
    var orig = DATA[name];
    var self = DATA;
    DATA[name] = function () {
      var args = Array.prototype.slice.call(arguments);
      var syncResult = orig.apply(self, args);
      // Fire-and-forget backend push using captured args (this keeps the
      // sync return contract intact — zero render breakage).
      enqueue(name, function () { return backendCall.apply(null, args.slice()); });
      return syncResult;
    };
  }

  /** Install write-path wrappers mapped onto the backend modules. */
  function installWrites() {
    if (!enabled()) return;

    // ---- Professionals ----
    if (DATA.addProfessional && ProApi.create) {
      intercept("addProfessional", function (pro) {
        return ProApi.create({
          name: pro.name, job: pro.job, city: pro.city, phone: pro.phone,
          email: pro.email, description: pro.description
        }).then(function (res) {
          var remote = res && res.data ? res.data : (res.professional || res);
          if (remote && remote.id && pro.id) reconcile("professionals", pro.id, { id: remote.id });
          return { success: true };
        });
      });
    }
    if ((DATA.updateProfessional) && (ProApi.adminUpdate || ProApi.update)) {
      intercept("updateProfessional", function (id, data) {
        // Suspend / activate are dedicated admin endpoints.
        if (data && data.status === "suspended" && ProApi.suspend) return ProApi.suspend(id);
        if (data && data.status === "active" && ProApi.activate) return ProApi.activate(id);
        var head = {};
        ["name","job","city","phone","email","description","package"].forEach(function (k) {
          if (data[k] !== undefined) head[k] = data[k];
        });
        // REQ 52: admin edits go through the admin-scoped endpoint (RBAC).
        return (ProApi.adminUpdate || ProApi.update)(id, head);
      });
    }
    if (DATA.deleteProfessional && ProApi.remove) {
      intercept("deleteProfessional", function (id) { return ProApi.remove(id); });
    }

    // ---- Subscriptions ----
    if (DATA.setSubscription && SubApi.create) {
      intercept("setSubscription", function (proId, planId) {
        return SubApi.create({ professionalId: proId, planId: planId, status: "active", paymentStatus: "confirmed" });
      });
    }
    // REQ 52 biz rules: renew / Back-to-Free push to the admin API. The backend
    // enforces the one-month lifecycle (extend active from current expiry,
    // expired from today; downgrade reverts to FREE) — the sync mirror in
    // Sna3tiData is only optimistic.
    if (DATA.renewSubscription && SubApi.adminRenew) {
      intercept("renewSubscription", function (subId) {
        return SubApi.adminRenew(subId).then(function (res) {
          var remote = res && res.data ? res.data : res;
          if (remote && remote.id) reconcile("subscriptions", remote.id, {
            status: remote.status, expiresAt: remote.expiresAt, renewalAt: remote.renewalAt
          });
          return { success: true };
        });
      });
    }
    if (DATA.downgradeSubscriptionToFree && SubApi.adminDowngrade) {
      intercept("downgradeSubscriptionToFree", function (subId) {
        return SubApi.adminDowngrade(subId).then(function (res) {
          var remote = res && res.data ? res.data : res;
          if (remote && remote.id) reconcile("subscriptions", remote.id, {
            status: remote.status, expiresAt: remote.expiresAt, cancelledAt: remote.cancelledAt
          });
          return { success: true };
        });
      });
    }
    if (DATA.confirmPayment && PayApi.confirm) {
      intercept("confirmPayment", function (id) {
        return PayApi.confirm(id).then(function (res) {
          var remote = res && res.data ? res.data : res;
          if (remote) {
            reconcile("payments", id, { status: remote.status || "confirmed" });
            if (remote.subscription) reconcile("subscriptions", remote.subscription.id, remote.subscription);
          }
          return { success: true };
        });
      });
    }
    if (DATA.rejectPayment && PayApi.reject) {
      intercept("rejectPayment", function (id, reason) {
        return PayApi.reject(id, reason).then(function () { return { success: true }; });
      });
    }
    if (DATA.addPayment && PayApi.create) {
      intercept("addPayment", function (data) {
        return PayApi.create({
          professionalId: data.professionalId, planId: data.planId,
          bankReference: data.bankRef, receiptUrl: data.receipt
        }).then(function (res) {
          var remote = res && res.data ? res.data : res;
          if (remote && remote.id && data.id) reconcile("payments", data.id, { id: remote.id });
          return { success: true };
        });
      });
    }

    // ---- Verifications ----
    if (DATA.approveVerification && VerSvc && VerSvc.approve) {
      intercept("approveVerification", function (id) { return VerSvc.approve(id); });
    }
    if (DATA.rejectVerification && VerSvc && VerSvc.reject) {
      intercept("rejectVerification", function (id, reason) { return VerSvc.reject(id, reason); });
    }
    if (DATA.requestMoreInfo && VerSvc && VerSvc.requestInfo) {
      intercept("requestMoreInfo", function (id, note) { return VerSvc.requestInfo(id, note); });
    }

    // ---- Reviews ----
    if (DATA.setReviewStatus && RevApi) {
      intercept("setReviewStatus", function (id, status) {
        if (status === "flagged" && RevApi.flag) return RevApi.flag(id);
        if ((status === "published" || status === "active") && RevApi.publish) return RevApi.publish(id);
        if (status === "hidden" && RevApi.hide) return RevApi.hide(id);
        return Promise.resolve({ success: true });
      });
    }
    if (DATA.deleteReview && RevApi && RevApi.remove) {
      intercept("deleteReview", function (id) { return RevApi.remove(id); });
    }

    // ---- Reports ----
    if (DATA.setReportStatus && RepApi) {
      intercept("setReportStatus", function (id, status) {
        if (status === "resolved") return RepApi.resolve(id);
        return Promise.resolve({ success: true });
      });
    }
    if (DATA.warnReport && RepApi && RepApi.warn) {
      intercept("warnReport", function (id, reason) { return RepApi.warn(id, reason); });
    }
    if (DATA.suspendProfessionalByReport && RepApi && RepApi.suspend) {
      intercept("suspendProfessionalByReport", function (id) { return RepApi.suspend(id); });
    }

    // ---- Notifications (read / read-all) ----
    if (DATA.markNotificationRead && NotifApi && NotifApi.markRead) {
      intercept("markNotificationRead", function (id) { return NotifApi.markRead(id); });
    }
    if (DATA.markNotificationsRead && NotifApi && NotifApi.markAllRead) {
      intercept("markNotificationsRead", function () { return NotifApi.markAllRead(); });
    }
  }

  /** Install wrappers + prime from the backend. Safe to call on load. */
  function install() {
    if (!enabled()) return { success: false, code: "UNSUPPORTED" };
    installWrites();
    // Non-blocking prime: do not block first paint / render.
    if (Api && typeof Api.isReachable === "function" && !reachabilityCheck()) {
      return { success: false, code: "OFFLINE", reason: envGateDetails() };
    }
    if (!primed) {
      syncNow();
    }
    return { success: true, primed: primed, gate: envGateDetails() };
  }

  /** True when the bridge is NOT allowed to fall back to demo data. */
  function authoritativeOnly() {
    return !canUseMockFallback();
  }

  /** Whether current data may (per the gate) be demo fallback data. */
  function usingMockData() {
    return canUseMockFallback() === true;
  }

  /** Raw reachability check (avoids double-invoking the promise). */
  function reachabilityCheck() {
    var p = Api && typeof Api.isReachable === "function" ? Api.isReachable() : Promise.resolve(false);
    // isReachable returns a promise; resolve synchronously is impossible, so
    // prime is left to syncNow's own failure tracking. Return true to proceed
    // and let syncNow surface offline errors (production) correctly.
    return !!p && typeof p.then === "function" ? true : !!p;
  }

  global.Sna3tiBridge = {
    install: install,
    syncNow: syncNow,
    installWrites: installWrites,
    isReachable: function () { return Api ? Api.isReachable() : false; },
    pending: function () { return syncQueue.slice(); },
    get primed() { return primed; },
    // Safe-fallback gating API (REQ). Central: consult these, not scattered env.
    get gate() { return envGateDetails(); },
    canUseMockFallback: canUseMockFallback,
    authoritativeOnly: authoritativeOnly,
    usingMockData: usingMockData,
    lastSyncError: function () { return lastSyncError; },
    resetSyncError: function () { lastSyncError = null; },

    /** Async: fetch dashboard KPI counts from GET /admin/dashboard. */
    getDashboard: function () {
      if (!DashApi || !DashApi.get) return Promise.resolve({ success: false, code: "UNSUPPORTED" });
      return DashApi.get().then(function (res) {
        var d = res && res.data ? res.data : res;
        return { success: true, data: d && d.counts ? d.counts : d };
      }).catch(function (err) {
        return { success: false, code: err && err.code || "NETWORK_ERROR", message: err && err.message };
      });
    },

    /** Async: public search via GET /search. */
    searchPublic: function (params) {
      if (!SearchApi || !SearchApi.search) return Promise.resolve({ success: false, code: "UNSUPPORTED" });
      return SearchApi.search(params).then(function (res) {
        return { success: true, data: unwrapList(res), pagination: res && res.pagination ? res.pagination : null };
      }).catch(function (err) {
        return { success: false, code: err && err.code || "NETWORK_ERROR", message: err && err.message };
      });
    },

    /** Register a callback for 403 Forbidden responses. */
    onForbidden: function (fn) { if (typeof fn === "function") forbiddenCallback = fn; },

    /** Check if an error object represents a 403. */
    isForbidden: function (err) { return !!(err && (err.code === "FORBIDDEN" || err.status === 403)); }
  };

})(window);