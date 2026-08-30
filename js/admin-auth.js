/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/admin-auth.js
   Authentication, session, roles, permissions (RBAC).
   PROTOTYPE: demo-only auth. NO real passwords, NO production
   credentials. Future: backend Auth API -> JWT -> role -> perms.
   ============================================================ */

(function (global) {
  "use strict";

  var DATA = global.Sna3tiData;
  var ROLES = DATA.roles;
  var PERM_CATALOG = DATA.permissionsCatalog;

  var SESSION_KEY = "sna3ti_admin_session";
  var SESSION_DURATION_MS = 60 * 60 * 1000; // 60 min

  // Private demo login — only this credential is accepted.
  // NOTE: prototype only; change the password here/in the DOM for your own use.
  var DEMO_PASSWORD = { email: "mbelgas@sna3ti.ma", password: "Sna3ti@@2030" };

  // Internal profiles (roles) that sessions may resolve to.
  var DEMO_ACCOUNTS = [
    { email: "mbelgas@sna3ti.ma", name: "Admin User", role: "super_admin" },
    { email: "admin@sna3ti.ma", name: "Admin User", role: "super_admin" },
    { email: "admin@example.com", name: "Admin User", role: "super_admin" },
    { email: "finance@sna3ti.ma", name: "Finance Manager", role: "finance" },
    { email: "mod@sna3ti.ma", name: "Moderator Team", role: "moderator" },
    { email: "support@sna3ti.ma", name: "Support Agent", role: "support" }
  ];

  var session = null;

  function loadSession(){
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if(!raw){ raw = localStorage.getItem(SESSION_KEY); }
      if(raw){ session = JSON.parse(raw); }
    } catch(e){ session = null; }
    if(session && session.expiresAt && Date.now() > session.expiresAt){
      session = null;
      clearStoredSession();
    }
    return session;
  }

  function clearStoredSession(){
    try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch(e){}
  }

  function saveSession(s, remember){
    s.expiresAt = Date.now() + SESSION_DURATION_MS;
    s.remember = !!remember;
    try {
      var store = s.remember ? localStorage : sessionStorage;
      store.setItem(SESSION_KEY, JSON.stringify(s));
      if(s.remember) sessionStorage.removeItem(SESSION_KEY);
      else localStorage.removeItem(SESSION_KEY);
    } catch(e){}
  }

  function login(email, password, remember){
    return new Promise(function(resolve, reject){
      // Simulate network latency
      setTimeout(function(){
        if(!email || !password){ reject({ code:"invalid", message:"Veuillez saisir votre email et mot de passe." }); return; }
        email = email.toLowerCase().trim();
        var ok = (email === DEMO_PASSWORD.email && password === DEMO_PASSWORD.password);
        var account = DEMO_ACCOUNTS.find(function(a){ return a.email === email; });
        if(!ok || !account){
          reject({ code:"invalid", message:"Identifiants invalides." });
          return;
        }
        session = {
          email: account.email,
          name: account.name,
          role: account.role,
          loginAt: new Date().toISOString()
        };
        saveSession(session, remember);
        DATA.logAudit({ admin: session.name, action:"LOGIN", entity:"Admin", entityId: account.email, result:"Success" });
        resolve(clonePublic(session));
      }, 600);
    });
  }

  function clonePublic(s){ return { email:s.email, name:s.name, role:s.role }; }

  function logout(){
    DATA.logAudit({ admin: session ? session.name : "unknown", action:"LOGOUT", entity:"Admin", entityId: session ? session.email : "", result:"Success" });
    session = null;
    clearStoredSession();
  }

  function getSession(){ return session ? clonePublic(session) : null; }
  function isAuthenticated(){ return !!session; }
  function getRole(){ return session ? session.role : null; }
  function getRoleLabel(){ return session ? (ROLES[session.role] ? ROLES[session.role].label : session.role) : ""; }

  // Permission helper. NOTE: prototype only; backend must enforce.
  function can(resource, action){
    if(!session || !ROLES[session.role]) return false;
    var perms = ROLES[session.role].permissions;
    var allowed = perms[resource];
    if(!allowed) return false;
    // catalog validate
    return allowed.indexOf(action) > -1;
  }

  function hasAny(resource){
    if(!session || !ROLES[session.role]) return false;
    return !!ROLES[session.role].permissions[resource];
  }

  function requirePermission(resource, action){
    if(!can(resource, action)) { return false; }
    return true;
  }

  loadSession();

  global.Sna3tiAuth = {
    login: login,
    logout: logout,
    getSession: getSession,
    isAuthenticated: isAuthenticated,
    getRole: getRole,
    getRoleLabel: getRoleLabel,
    getRoleColor: function(){ return session && ROLES[session.role] ? ROLES[session.role].color : "gray"; },
    can: can,
    hasAny: hasAny,
    requirePermission: requirePermission,
    roles: ROLES,
    permissionsCatalog: PERM_CATALOG
  };

})(window);
