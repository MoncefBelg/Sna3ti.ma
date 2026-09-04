/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/admin-router.js
   Hash-based router for /admin routes.
   Guards routes by auth + role permissions.
   ============================================================ */

(function (global) {
  "use strict";

  var AUTH = global.Sna3tiAuth;

  // Route table: path (relative to /admin) -> view id + permission
  var ROUTES = [
    { path:"login", view:"login", public:true },
    { path:"dashboard", view:"dashboard", perm:["dashboard","read"] },
    { path:"professionals", view:"professionals", perm:["professionals","read"] },
    { path:"professionals/:id", view:"professionalDetail", perm:["professionals","read"] },
    { path:"users", view:"users", perm:["users","read"] },
    { path:"verification", view:"verification", perm:["verification","read"] },
    { path:"categories", view:"categories", perm:["categories","read"] },
    { path:"cities", view:"cities", perm:["cities","read"] },
    { path:"reviews", view:"reviews", perm:["reviews","read"] },
    { path:"reports", view:"reports", perm:["reports","read"] },
    { path:"match-requests", view:"matchRequests", perm:["matchRequests","read"] },
    { path:"support", view:"support", perm:["support","read"] },
    { path:"subscriptions", view:"subscriptions", perm:["subscriptions","read"] },
    { path:"payments", view:"payments", perm:["payments","read"] },
    { path:"payments/:id", view:"paymentDetail", perm:["payments","read"] },
    { path:"analytics", view:"analytics", perm:["analytics","read"] },
    { path:"ai", view:"ai", perm:["ai","read"] },
    { path:"notifications", view:"notifications", perm:["notifications","read"] },
    { path:"settings", view:"settings", perm:["settings","read"] },
    { path:"legal", view:"legal", perm:["legal","read"] },
    { path:"admin-users", view:"adminUsers", perm:["adminUsers","read"] },
    { path:"audit-logs", view:"auditLogs", perm:["auditLogs","read"] }
  ];

  function currentPath(){
    var hash = location.hash || "#/admin/dashboard";
    var clean = hash.replace(/^#\/?/, "");   // -> "admin/dashboard"
    clean = clean.replace(/^admin\/?/, "");  // -> "dashboard"
    return clean;
  }

  function decodeSafe(str){
    try { return decodeURIComponent(str); } catch(e){ return str; }
  }

  function parseQuery(q){
    var out = {};
    if(!q) return out;
    String(q).replace(/^\?/,"").split("&").forEach(function(pair){
      if(!pair) return;
      var kv = pair.split("=");
      var k = decodeSafe(kv[0]);
      var v = kv.length>1 ? decodeSafe(kv.slice(1).join("=")) : "";
      out[k] = v;
    });
    return out;
  }

  // Return matched route or null
  function matchRoute(){
    var path = currentPath();
    var qIdx = path.indexOf("?");
    var query = qIdx>-1 ? parseQuery(path.slice(qIdx)) : {};
    if(qIdx>-1) path = path.slice(0,qIdx);
    var parts = path.split("/").filter(Boolean);
    if(parts.length === 0){ parts = ["dashboard"]; }
    for(var i=0;i<ROUTES.length;i++){
      var r = ROUTES[i];
      var rp = r.path.split("/");
      if(rp.length !== parts.length) continue;
      var params = {};
      var ok = true;
      for(var j=0;j<rp.length;j++){
        if(rp[j].startsWith(":")){ params[rp[j].slice(1)] = decodeSafe(parts[j]); }
        else if(rp[j] !== parts[j]){ ok = false; break; }
      }
      if(ok){ return { route:r, params:params, query:query }; }
    }
    return null;
  }

  var onNotFound = null;
  var onBeforeLeave = null;
  var previousHash = location.hash;

  // Navigation guard: a caller can register a function that returns true to
  // cancel navigation (e.g. warn about unsaved Settings changes). `toPath` is
  // the cleaned route path about to be shown.
  function setBeforeLeave(fn){ onBeforeLeave = fn; }

  function navigate(path){
    location.hash = "#/admin/" + path.replace(/^\/?/, "");
  }

  function start(resolve){
    onNotFound = resolve.notFound;
    function handle(){
      var m = matchRoute();
      var authed = AUTH.isAuthenticated();

      if(!m){ if(onNotFound) onNotFound(); return; }

      var route = m.route;

      // Unsaved-changes guard: if leaving a protected form, ask first.
      if(onBeforeLeave){
        var toPath = currentPath();
        var cancel = onBeforeLeave(route.view, toPath);
        if(cancel){
          // Restore the previous hash and abort this render.
          location.hash = previousHash;
          return;
        }
      }
      previousHash = location.hash;

      // Route requires auth?
      if(!route.public && !authed){
        // redirect to login
        if(location.hash !== "#/admin/login") location.hash = "#/admin/login";
        else { if(resolve.login) resolve.login(); }
        return;
      }
      // Public login while already authed -> go dashboard
      if(route.public && authed){
        if(location.hash !== "#/admin/dashboard") location.hash = "#/admin/dashboard";
        return;
      }
      // Permission guard
      if(route.perm){
        var resource = route.perm[0], action = route.perm[1];
        if(!AUTH.requirePermission(resource, action)){
          if(resolve.forbidden){ resolve.forbidden(m); }
          return;
        }
      }
      if(resolve.route){ resolve.route(m); }
    }

    window.addEventListener("hashchange", handle);
    handle();
  }

  global.Sna3tiRouter = {
    start: start,
    navigate: navigate,
    currentPath: currentPath,
    matchRoute: matchRoute,
    setBeforeLeave: setBeforeLeave
  };

})(window);
