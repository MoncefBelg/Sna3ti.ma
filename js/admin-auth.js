/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/admin-auth.js
   Authentication, session, roles, permissions (RBAC).

   REQ 47 — connects the existing auth UI to the real backend:
     UI -> Sna3tiAuth -> auth-api (Sna3tiAuthApi) -> REST /api/v1/auth
       register   POST /auth/register
       login      POST /auth/login      -> JWT -> GET /auth/me
       refresh    POST /auth/refresh
       logout     POST /auth/logout
       me         GET  /auth/me

   - JWT is sent as `Authorization: Bearer <token>` (never in URLs/logs).
   - Session is restored on page load via GET /auth/me without re-login.
   - Refresh tokens are used to obtain a new access token when it expires.
   - API-first with a local demo fallback so the panel still works offline
     (the backend is optional in dev).
   ============================================================ */

(function (global) {
  "use strict";

  var I18N = global.Sna3tiI18n || { t:function(s){ return s; } };
  function T(s){ return I18N.t(s); }

  var DATA = global.Sna3tiData;
  var ROLES = DATA.roles;
  var PERM_CATALOG = DATA.permissionsCatalog;

  // Real backend auth API (js/auth-api.js). Optional in dev.
  var AuthApi = global.Sna3tiAuthApi || null;
  var Api = global.Sna3tiApi || null;

  var SESSION_KEY = "sna3ti_admin_session";
  var SESSION_DURATION_MS = 60 * 60 * 1000; // 60 min

  // Private demo login — used ONLY as an offline fallback when the backend
  // is unreachable. PROTOTYPE: never store a real password.
  var DEMO_PASSWORD = { email: "mbelgas@sna3ti.ma", password: "Sna3ti@@2030" };

  var DEMO_ACCOUNTS = [
    { id: "AU-1", email: "mbelgas@sna3ti.ma", name: "Admin User", role: "super_admin" },
    { id: "AU-1", email: "admin@sna3ti.ma", name: "Admin User", role: "super_admin" },
    { id: "AU-1", email: "admin@example.com", name: "Admin User", role: "super_admin" },
    { id: "AU-2", email: "finance@sna3ti.ma", name: "Finance Manager", role: "finance" },
    { id: "AU-3", email: "mod@sna3ti.ma", name: "Moderator Team", role: "moderator" },
    { id: "AU-4", email: "support@sna3ti.ma", name: "Support Agent", role: "support" }
  ];

  var session = null;

  /* ---------- Persistence (local/session storage) ---------- */

  function storageGet(key){
    try { return sessionStorage.getItem(key) || localStorage.getItem(key); } catch(e){ return null; }
  }
  function storageSet(key, val, remember){
    try {
      if(remember){ localStorage.setItem(key, val); sessionStorage.removeItem(key); }
      else { sessionStorage.setItem(key, val); localStorage.removeItem(key); }
    } catch(e){}
  }
  function storageRemove(key){
    try { sessionStorage.removeItem(key); localStorage.removeItem(key); } catch(e){}
  }

  function loadSession(){
    try {
      var raw = storageGet(SESSION_KEY);
      if(raw) session = JSON.parse(raw);
    } catch(e){ session = null; }
    if(session && session.expiresAt && Date.now() > session.expiresAt){
      session = null;
      storageRemove(SESSION_KEY);
    }
    return session;
  }

  function saveSession(s, remember){
    s.expiresAt = Date.now() + SESSION_DURATION_MS;
    s.remember = !!remember;
    storageSet(SESSION_KEY, JSON.stringify(s), s.remember);
  }

  function clearStoredSession(){ storageRemove(SESSION_KEY); }

  /* ---------- Helpers ---------- */

  function isNetworkError(err){
    if(!err) return false;
    return err.code === "NETWORK_ERROR" || err.code === "UNSUPPORTED" ||
           err.code === "HTTP_0" || err.name === "TypeError";
  }

  // Normalize a backend user/admin object into the session shape the UI expects.
  function sessionFromUser(u){
    if(!u) return null;
    return {
      id: u.id || "",
      adminId: u.id || "",
      email: u.email || "",
      name: u.name || u.firstName || "",
      role: u.role || "user",
      status: u.status || "active",
      api: true
    };
  }

  function clonePublic(s){
    return { id:s.id, adminId:s.id, email:s.email, name:s.name, role:s.role };
  }

  /* ---------- Login ---------- */

  function demoLogin(email, password){
    return new Promise(function(resolve, reject){
      setTimeout(function(){
        if(!email || !password){ reject({ code:"invalid", message:T("Veuillez saisir votre email et mot de passe.") }); return; }
        email = email.toLowerCase().trim();
        var ok = (email === DEMO_PASSWORD.email && password === DEMO_PASSWORD.password);
        var account = DEMO_ACCOUNTS.find(function(a){ return a.email === email; });
        if(!ok || !account){
          reject({ code:"invalid", message:T("Identifiants invalides.") });
          return;
        }
        session = {
          id: account.id || "",
          adminId: account.id || "",
          email: account.email,
          name: account.name,
          role: account.role,
          loginAt: new Date().toISOString(),
          api: false
        };
        saveSession(session, false);
        resolve(clonePublic(session));
      }, 300);
    });
  }

  function login(email, password, remember){
    // API-first: try the real backend.
    if(AuthApi){
      return AuthApi.login(email, password)
        .then(function(res){
          // res = { success, token, refreshToken, user }
          if(!res || !res.user){
            return Promise.reject({ code:"invalid", message:T("Réponse de connexion invalide.") });
          }
          session = sessionFromUser(res.user);
          session.loginAt = new Date().toISOString();
          saveSession(session, remember);
          try {
            if(Api) Api.setTokens(res.token, res.refreshToken || null);
          } catch(e){ /* best-effort token storage */ }
          try { if(DATA.logAudit) DATA.logAudit({ admin:session.name, action:"LOGIN", entity:"Admin", entityId: session.email, result:"Success" }); } catch(e){}
          return clonePublic(session);
        })
        .catch(function(err){
          // Backend reachable but rejected credentials (401/403) -> surface error.
          if(!isNetworkError(err)){
            var msg = err.message || T("Identifiants invalides.");
            return Promise.reject({ code: err.code || "invalid", message: msg });
          }
          // Backend unreachable -> offline demo fallback.
          return demoLogin(email, password);
        });
    }
    return demoLogin(email, password);
  }

  /* ---------- Logout ---------- */

  function logout(){
    var s = session;
    try {
      if(DATA.logAudit) DATA.logAudit({ admin: s ? s.name : "unknown", action:"LOGOUT", entity:"Admin", entityId: s ? s.email : "", result:"Success" });
    } catch(e){}
    if(AuthApi){
      // Best-effort backend logout (stateless); always clear local state.
      AuthApi.logout().catch(function(){});
    }
    session = null;
    clearStoredSession();
    if(Api) Api.clearTokens();
  }

  /* ---------- Session restoration ---------- */

  // Called at boot. If we have a token, validate via GET /auth/me and refresh
  // the local session (never forces an unnecessary re-login). Invalid/expired
  // -> clear. If no token (offline demo), keep the local session.
  function restoreSession(){
    // If already authenticated synchronously, still validate in background.
    var prev = session;
    if(!AuthApi || !Api || !Api.hasToken()){
      // No real token -> nothing to validate against the backend.
      return Promise.resolve(session ? clonePublic(session) : null);
    }
    return AuthApi.me()
      .then(function(res){
        var u = res && res.data ? res.data : null;
        if(u && u.id){
          session = sessionFromUser(u);
          session.loginAt = (prev && prev.loginAt) || new Date().toISOString();
          session.remember = prev ? prev.remember : false;
          saveSession(session, session.remember);
          return clonePublic(session);
        }
        // Account missing/inactive -> clear.
        clearStoredSession();
        session = null;
        if(Api) Api.clearTokens();
        return null;
      })
      .catch(function(err){
        // Unauthorized/expired -> try a refresh, else clear.
        if(isNetworkError(err)){
          // Offline: keep whatever we had (don't force re-login).
          return prev ? clonePublic(prev) : null;
        }
        var rt = Api.getRefreshToken();
        if(rt){
          return AuthApi.refresh().then(function(res2){
            if(res2 && res2.user){
              session = sessionFromUser(res2.user);
              session.loginAt = (prev && prev.loginAt) || new Date().toISOString();
              session.remember = prev ? prev.remember : false;
              saveSession(session, session.remember);
              return clonePublic(session);
            }
            session = null; clearStoredSession(); Api.clearTokens();
            return null;
          }).catch(function(){
            session = null; clearStoredSession(); Api.clearTokens();
            return null;
          });
        }
        session = null; clearStoredSession(); Api.clearTokens();
        return null;
      });
  }

  /* ---------- Session accessors (sync, for the router/UI) ---------- */

  function getSession(){ return session ? clonePublic(session) : null; }
  function isAuthenticated(){ return !!session; }
  function getRole(){ return session ? session.role : null; }
  function getRoleLabel(){ return session ? (ROLES[session.role] ? ROLES[session.role].label : session.role) : ""; }
  function getRoleColor(){ return session && ROLES[session.role] ? ROLES[session.role].color : "gray"; }

  // Permission helper. NOTE: prototype only; the backend enforces RBAC.
  function can(resource, action){
    if(!session || !ROLES[session.role]) return false;
    var perms = ROLES[session.role].permissions;
    var allowed = perms[resource];
    if(!allowed) return false;
    return allowed.indexOf(action) > -1;
  }

  function hasAny(resource){
    if(!session || !ROLES[session.role]) return false;
    return !!ROLES[session.role].permissions[resource];
  }

  function requirePermission(resource, action){
    return can(resource, action);
  }

  // Kick off session restoration right away (module load).
  loadSession();
  restoreSession().catch(function(){});

  global.Sna3tiAuth = {
    login: login,
    logout: logout,
    restore: restoreSession,
    getSession: getSession,
    isAuthenticated: isAuthenticated,
    getRole: getRole,
    getRoleLabel: getRoleLabel,
    getRoleColor: getRoleColor,
    can: can,
    hasAny: hasAny,
    requirePermission: requirePermission,
    roles: ROLES,
    permissionsCatalog: PERM_CATALOG
  };

})(window);
