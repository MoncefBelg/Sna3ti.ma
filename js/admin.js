/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/admin.js
   Entry point + view controllers for every Admin module.
   Boot sequence, login, and per-route renderers.
   ============================================================ */

(function (global) {
  "use strict";

  var DATA = global.Sna3tiData;
  var AUTH = global.Sna3tiAuth;
  var ROUTER = global.Sna3tiRouter;
  var UI = global.Sna3tiUI;

  var esc = UI.esc, initials = UI.initials;

  var I18N = global.Sna3tiI18n || { t:function(s){ return s; } };
  function T(s){ return I18N.t(s); }

  /* ============================================================
     LOGIN VIEW
     ============================================================ */
  function renderLogin(error){
    UI.setTitle(T("Connexion"));
    var root = document.getElementById("admin-root");
    var show = error ? '<div class="form-error">'+esc(error)+'</div>' : "";
    root.innerHTML =
      '<div class="login-wrap"><div class="login-card">' +
        '<div class="login-brand"><div class="brand-logo">S</div></div>' +
        '<div class="login-title">Sna3ti</div>' +
        '<div class="login-sub">'+T("Administration")+'</div>' +
        show +
        '<form class="form" id="loginForm">' +
          '<div class="frm"><label for="email">Email</label><input id="loginEmail" type="email" placeholder="admin@sna3ti.ma" autocomplete="username" required /></div>' +
          '<div class="frm"><label for="password">'+T("Mot de passe")+'</label><div class="pw-wrap"><input id="loginPassword" type="password" placeholder="Sna3ti@@2030" autocomplete="current-password" required /><button type="button" class="pw-toggle" id="pwToggle" aria-label="'+T("Afficher le mot de passe")+'">👁️</button></div></div>' +
          '<label class="field-check"><input type="checkbox" id="loginRemember" /> '+T("Se souvenir de moi")+'</label>' +
          '<button class="btn btn-primary btn-block" id="loginBtn" type="submit" style="justify-content:center">'+T("Se connecter")+'</button>' +
        '</form>' +
        '<div class="login-foot">'+T("Prototype — authentification de démonstration uniquement.")+'</div>' +
        '<div class="demo-box"><div class="demo-row"><span><b>'+T("Connexion")+'</b></span><code>mbelgas@sna3ti.ma</code></div><div class="demo-row"><span class="muted">'+T("Mot de passe")+'</span><span class="muted">Sna3ti@@2030</span></div><div class="demo-row"><span class="muted">'+T("Rôles illustrés")+'</span><span class="muted">Super Admin · Finance · Moderator · Support</span></div></div>' +
      '</div></div>';

    document.getElementById("pwToggle").addEventListener("click", function(){
      var p = document.getElementById("loginPassword");
      p.type = p.type === "password" ? "text" : "password";
    });

    var btn = document.getElementById("loginBtn");
    document.getElementById("loginForm").addEventListener("submit", function(e){
      e.preventDefault();
      btn.disabled = true; btn.textContent = T("Connexion...");
      AUTH.login(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value, document.getElementById("loginRemember").checked)
        .then(function(){
          UI.buildAppShell();
          UI.afterShell();
          location.hash = "#/admin/dashboard";
        })
        .catch(function(err){
          btn.disabled = false; btn.textContent = T("Se connecter");
          renderLogin(err.message);
        });
    });
  }

  /* ============================================================
     DASHBOARD — actionable, clickable
     ============================================================ */
  function renderDashboard(){
    UI.setTitle(T("Tableau de bord"));
    UI.renderSkeleton(4, true);
    setTimeout(function(){
      var k = DATA.getKPIs();
      var alerts = DATA.getAlerts();
      var activity = DATA.getActivity();
      var html =
        '<div class="page-head"><h1>'+T("Tableau de bord")+'</h1><div class="spacer"></div>'+
          '<span class="muted">'+new Date().toLocaleDateString("fr-MA",{weekday:"long",day:"numeric",month:"long",year:"numeric"})+'</span></div>'+
        '<div class="kpi-grid grid-4">' +
          dashKpi(T("Utilisateurs"),"👥", k.users, "8,2%", T("vs mois dernier"), true, "users") +
          dashKpi(T("Professionnels"),"🧑‍🔧", k.professionals, "12,4%", T("vs mois dernier"), true, "professionals") +
          dashKpi(T("Vérifiés"),"✅", k.verified, "4,1%", T("vs mois dernier"), true, "professionals?ver=verified") +
          dashKpi(T("Vérifications en attente"),"⏳", k.pendingVerification, null, T("à traiter"), null, "verification?status=pending") +
          dashKpi(T("Abonnements actifs"),"📦", k.activeSubscriptions, "6,2%", T("vs mois dernier"), true, "subscriptions") +
          dashKpi(T("Paiements en attente"),"💰", k.pendingPayments, null, T("à confirmer"), null, "payments") +
          dashKpi(T("Recherches"),"🔍", secara(k.searches), "18%", T("vs hier"), true, "analytics") +
          dashKpi(T("Revenus mensuels"),"💵", secara(k.monthlyRevenue)+" DH", "9,7%", T("vs mois dernier"), true, "payments") +
        '</div>' +
        '<div class="grid-2" style="margin-top:22px;align-items:stretch">' +
          workQueueCard() +
          '<div class="card"><div class="card-head"><div class="card-title">'+T("Alertes")+'</div></div>' +
            alerts.map(function(a){ return '<div class="alert '+a.type+'" data-route="'+a.route+'"><span class="a-ico">'+a.icon+'</span><div><div class="a-title">'+esc(a.title)+'</div><div class="a-sub">'+esc(a.sub)+'</div></div></div>'; }).join("") +
          '</div>' +
        '</div>' +
        '<div class="card"><div class="card-head"><div class="card-title">'+T("Activité récente")+'</div><a class="btn btn-ghost btn-small" href="#/admin/audit-logs">'+T("Audit complet")+'</a></div><div class="feed">' +
          activity.map(function(a){ return '<div class="feed-item"><div class="feed-dot '+a.type+'"></div><div class="f-txt">'+esc(a.text)+'</div><div class="f-when">'+esc(a.when)+'</div></div>'; }).join("") +
        '</div></div>';
      UI.setContent(html);
      UI.getContent().querySelectorAll(".alert[data-route], .kpi-link[data-route]").forEach(function(el){
        el.addEventListener("click", function(){ if(el.dataset.route) ROUTER.navigate(el.dataset.route); });
      });
    }, 350);
  }

  // dashKpi(title, ico, value, trend%, comparisonText, isUp, route)
  function dashKpi(title, ico, val, trend, cmp, up, route){
    var resource = (route||"").split("?")[0];
    var allowed = !route || AUTH.can(resource, "read");
    var trendHtml;
    if(trend){
      trendHtml = '<span class="chg '+(up?"up":"down")+'">'+(up?'▲':'▼')+' '+esc(trend)+'</span> <span class="cmp">'+esc(cmp||"")+'</span>';
    } else {
      trendHtml = '<span class="cmp">'+esc(cmp||"")+'</span>';
    }
    var link = allowed && route ? '<a class="kpi-view" href="#/admin/'+route+'">'+T("Voir →")+'</a>' : '';
    return '<div class="kpi'+(allowed&&route?' kpi-link':'')+'" data-route="'+(allowed?route:'')+'">' +
      '<div class="k-top"><span class="k-title">'+esc(title)+'</span><span class="k-ico">'+ico+'</span></div>' +
      '<div class="k-val">'+val+'</div>' +
      '<div class="k-delta">'+trendHtml+'</div>' +
      link +
    '</div>';
  }

  // Admin work queue — actionable tasks requiring a human decision
  function workQueueCard(){
    var q = DATA.getWorkQueue();
    var order = { critical:0, high:1, medium:2, low:3 };
    q.sort(function(a,b){ return (order[a.pclass]||9)-(order[b.pclass]||9) || String(a.created).localeCompare(String(b.created)); });
    var rows = q.slice(0,8).map(function(w){
      return '<tr>' +
        '<td><div class="pro"><div class="p-avatar" style="'+wqIcoColor(w.type)+'">'+wqIco(w.type)+'</div><div><div class="pro-name">'+esc(w.label)+'</div><div class="pro-job">'+esc(w.ref||w.id)+'</div></div></div></td>' +
        '<td><span class="badge '+prioClass(w.pclass)+'">'+esc(w.priority)+'</span></td>' +
        '<td>'+esc(w.created)+'</td>' +
        '<td>'+esc(w.assigned||"—")+'</td>' +
        '<td>'+statusBadge(w.status)+'</td>' +
        '<td class="actions-cell"><button class="btn btn-primary btn-small" data-wq="'+w.route+'">'+T("Traiter")+'</button></td>' +
      '</tr>';
    }).join("");
    return '<div class="card"><div class="card-head"><div class="card-title">'+T("File de travail Admin")+' <small>'+T("Actions humaines requises")+'</small></div>' +
      '<span class="badge orange">'+q.length+' '+T("en attente")+'</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>'+T("Type")+'</th><th>'+T("Priorité")+'</th><th>'+T("Créé")+'</th><th>'+T("Assigné")+'</th><th>'+T("Statut")+'</th><th>'+T("Action")+'</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6"><div class="empty">'+T("Aucune tâche en attente.")+' 🎉</div></td></tr>') +
      '</tbody></table></div></div>';
  }
  function wqIco(t){ return { verification:"✅", payment:"💰", report:"🚩", review:"⭐", subscription:"📦", support:"🧰" }[t] || "📋"; }
  function wqIcoColor(t){ var m={ verification:"background:var(--mint)", payment:"background:var(--amber-bg)", report:"background:var(--red-bg)", review:"background:var(--purple-bg)", support:"background:var(--amber-bg)" }; return m[t]||""; }
  function prioClass(p){ var m={ critical:"red", high:"amber", medium:"blue", low:"gray" }; return m[p]||"gray"; }

  function secara(n){ return typeof n === "number" ? n.toLocaleString("fr-MA") : n; }

  function kpiCard(title, ico, val, delta, cls){
    return '<div class="kpi"><div class="k-top"><span class="k-title">'+esc(title)+'</span><span class="k-ico">'+ico+'</span></div>' +
           '<div class="k-val">'+esc(val)+'</div><div class="k-delta '+cls+'"><span class="chg">'+delta+'</span></div></div>';
  }

  /* ============================================================
     PROFESSIONALS (list)
     ============================================================ */
  var proState = { page:1, q:"", city:"", category:"", job:"", verification:"", package:"", rating:"", created:"", status:"", sort:"name", dir:1, perPage:6, selected:{} };
  function renderProfessionals(q){
    UI.setTitle(T("Professionnels"));
    q = q || {};
    if(q.ver) proState.verification = q.ver;
    if(q.pkg) proState.package = q.pkg;
    if(q.status) proState.status = q.status;
    if(q.city) proState.city = q.city;
    if(q.category) proState.category = q.category;
    proState.page = 1;
    var cities = unique(DATA.getProfessionals().map(function(p){ return p.city; }));
    var cats = unique(DATA.getProfessionals().map(function(p){ return p.category; }));
    var jobs = unique(DATA.getProfessionals().map(function(p){ return p.job; }));
    var html =
      '<div class="page-head"><h1>'+T("Professionnels")+'</h1><div class="spacer"></div>' +
        (AUTH.can("professionals","update") ? '<button class="btn btn-primary" id="btnNewPro">+ '+T("Nouveau professionnel")+'</button>' : "") +
        (AUTH.can("professionals","read") ? '<button class="btn btn-ghost" id="btnExportPro">⬇ '+T("Exporter CSV")+'</button>' : "") +
        (AUTH.can("professionals","export") ? "" : "") +
      '</div>' +
      '<div class="card">' +
        '<div class="toolbar">' +
          '<div class="field"><label>'+T("Recherche")+'</label><input type="search" id="proQ" placeholder="'+T("Nom, métier, ville...")+'" value="'+esc(proState.q)+'" /></div>' +
          '<div class="field"><label>'+T("Ville")+'</label><select id="proCity"><option value="">'+T("Toutes")+'</option>'+opts(cities, proState.city)+'</select></div>' +
          '<div class="field"><label>'+T("Catégorie")+'</label><select id="proCat"><option value="">'+T("Toutes")+'</option>'+opts(cats, proState.category)+'</select></div>' +
          '<div class="field"><label>'+T("Profession")+'</label><select id="proJob"><option value="">'+T("Toutes")+'</option>'+opts(jobs, proState.job)+'</select></div>' +
          '<div class="field"><label>'+T("Vérification")+'</label><select id="proVer"><option value="">'+T("Tous")+'</option><option value="verified" '+sel(proState.verification,"verified")+'>'+T("Vérifiés")+'</option><option value="unverified" '+sel(proState.verification,"unverified")+'>'+T("Non vérifiés")+'</option></select></div>' +
          '<div class="field"><label>'+T("Abonnement")+'</label><select id="proPkg"><option value="">'+T("Tous")+'</option><option value="free" '+sel(proState.package,"free")+'>'+T("GRATUIT")+'</option><option value="verified" '+sel(proState.package,"verified")+'>'+T("VÉRIFIÉ")+'</option><option value="gold" '+sel(proState.package,"gold")+'>'+T("GOLD")+'</option></select></div>' +
          '<div class="field"><label>'+T("Note min.")+'</label><select id="proRating"><option value="">'+T("Toutes")+'</option><option value="4" '+sel(proState.rating,"4")+'>'+T("4★ et +")+'</option><option value="4.5" '+sel(proState.rating,"4.5")+'>'+T("4.5★ et +")+'</option></select></div>' +
          '<div class="field"><label>'+T("Inscrit")+'</label><select id="proCreated"><option value="">'+T("Toute date")+'</option><option value="7d" '+sel(proState.created,"7d")+'>'+T("7 derniers jours")+'</option><option value="30d" '+sel(proState.created,"30d")+'>'+T("30 derniers jours")+'</option><option value="older" '+sel(proState.created,"older")+'>'+T("Plus de 30 jours")+'</option></select></div>' +
          '<div class="field"><label>'+T("Statut")+'</label><select id="proStatus"><option value="">'+T("Tous")+'</option>'+["active","pending","suspended","rejected"].map(function(s){return '<option '+sel(proState.status,s)+'>'+s+'</option>';}).join("")+'</select></div>' +
          '<div style="flex:1"></div>' +
          (AUTH.hasAny("professionals") ? '<button class="btn btn-soft" id="btnBulk">'+T("Sélection groupée")+'</button>' : "") +
        '</div>' +
        '<div class="table-wrap"><table><thead><tr>' +
          '<th style="width:30px"><input type="checkbox" id="proCheckAll"></th>' +
          '<th class="sortable" data-sort="name">'+T("Nom")+'</th><th>'+T("Profession")+'</th><th>'+T("Ville")+'</th>' +
          '<th class="sortable" data-sort="rating">'+T("Note")+'</th><th class="sortable" data-sort="reviewsCount">'+T("Avis")+'</th>' +
          '<th>'+T("Vérification")+'</th><th>'+T("Abonnement")+'</th><th class="sortable" data-sort="created">'+T("Inscrit")+'</th><th class="sortable" data-sort="status">'+T("Statut")+'</th><th>'+T("Actions")+'</th>' +
        '</tr></thead><tbody id="proBody"></tbody></table></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><span id="proCount" class="muted"></span><div id="proPager"></div></div>' +
        '<div id="bulkBar" class="hidden" style="margin-top:12px;padding:12px;background:var(--mint);border-radius:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>'+proCountSelected()+' '+T("sélectionné(s)")+'</b>' +
          (AUTH.can("professionals","verify")?'<button class="btn btn-primary btn-small" id="bulkVerify">'+T("Vérifier")+'</button>':"") +
          (AUTH.can("professionals","suspend")?'<button class="btn btn-warn btn-small" id="bulkSuspend">'+T("Suspendre")+'</button>':"") +
          (AUTH.can("professionals","activate")?'<button class="btn btn-soft btn-small" id="bulkActivate">'+T("Activer")+'</button>':"") +
          (AUTH.can("professionals","read")?'<button class="btn btn-ghost btn-small" id="bulkExport">⬇ '+T("Exporter")+'</button>':"") +
          '<button class="btn btn-ghost btn-small" id="bulkClose">'+T("Fermer")+'</button></div>' +
      '</div>';
    UI.setContent(html);

    // wire events
    document.getElementById("proQ").addEventListener("input", UI.debounce(function(){ proState.q = this.value; proState.page=1; drawPros(); }, 220));
    document.getElementById("proCity").addEventListener("change", function(){ proState.city=this.value; proState.page=1; drawPros(); });
    document.getElementById("proCat").addEventListener("change", function(){ proState.category=this.value; proState.page=1; drawPros(); });
    document.getElementById("proVer").addEventListener("change", function(){ proState.verification=this.value; proState.page=1; drawPros(); });
    document.getElementById("proPkg").addEventListener("change", function(){ proState.package=this.value; proState.page=1; drawPros(); });
    document.getElementById("proJob").addEventListener("change", function(){ proState.job=this.value; proState.page=1; drawPros(); });
    document.getElementById("proRating").addEventListener("change", function(){ proState.rating=this.value; proState.page=1; drawPros(); });
    document.getElementById("proCreated").addEventListener("change", function(){ proState.created=this.value; proState.page=1; drawPros(); });
    document.getElementById("proStatus").addEventListener("change", function(){ proState.status=this.value; proState.page=1; drawPros(); });
    var head = document.querySelector("thead");
    head.querySelectorAll("th.sortable").forEach(function(th){
      th.addEventListener("click", function(){ var s=th.dataset.sort; if(proState.sort===s) proState.dir*=-1; else { proState.sort=s; proState.dir=1; } drawPros(); });
    });
    var newBtn = document.getElementById("btnNewPro"); if(newBtn) newBtn.addEventListener("click", function(){ openProModal(0); });
    var ex = document.getElementById("btnExportPro"); if(ex) ex.addEventListener("click", exportPros);
    var b = document.getElementById("btnBulk"); if(b) b.addEventListener("click", toggleBulk);
    document.getElementById("proCheckAll").addEventListener("change", function(){ var c=this.checked; document.querySelectorAll("#proBody .row-check").forEach(function(ch){ ch.checked=c; }); refreshSelected(); });
    bindBulk();
    drawPros();
  }

  function proCountSelected(){ return Object.keys(proState.selected).filter(function(k){ return proState.selected[k]; }).length; }
  function toggleBulk(){ document.getElementById("bulkBar").classList.toggle("hidden"); document.getElementById("proCheckAll").checked=false; proState.selected={}; refreshSelected(); }
  function refreshSelected(){
    var any = document.querySelectorAll("#proBody .row-check");
    var all = any.length>0 && Array.prototype.every.call(any, function(ch){ return ch.checked; });
    document.getElementById("proCheckAll").checked = all;
    document.getElementById("bulkBar").classList.toggle("hidden", proCountSelected()===0);
  }
  function selectedProIds(){ return Object.keys(proState.selected).filter(function(k){ return proState.selected[k]; }); }
  function bindBulk(){
    var bv = document.getElementById("bulkVerify"); if(bv) bv.addEventListener("click", function(){ bulkAction("verify"); });
    var bs = document.getElementById("bulkSuspend"); if(bs) bs.addEventListener("click", function(){ bulkAction("suspend"); });
    var ba = document.getElementById("bulkActivate"); if(ba) ba.addEventListener("click", function(){ bulkAction("activate"); });
    var be = document.getElementById("bulkExport"); if(be) be.addEventListener("click", function(){ var ids=selectedProIds(); if(ids.length===0){ UI.toast(T("Aucun professionnel sélectionné.")); return; } exportPros(ids); });
    document.getElementById("bulkClose").addEventListener("click", toggleBulk);
  }
  function bulkAction(action){
    var ids = selectedProIds();
    if(ids.length===0){ UI.toast(T("Aucun professionnel sélectionné.")); return; }
    if(action==="suspend"){
      UI.confirmAction({ title:T("Suspendre ")+ids.length+T(" professionnel(s)?"), message:T("Cette action est réversible."), reasonRequired:true, reasonLabel:T("Raison de la suspension"), confirmLabel:T("Suspendre"), onConfirm:function(reason){
        ids.forEach(function(id){ DATA.updateProfessional(id, { status:"suspended" }); DATA.logAudit({admin:AUTH.getSession().name, action:"SUSPEND_PROFESSIONAL", entity:"Professional", entityId:id, result:"Suspended", note:reason}); });
        UI.toast(ids.length+T(" professionnel(s) suspendu(s).")); drawPros(); UI.updatePills && global.Sna3tiUI && global.Sna3tiUI.setActiveNav("professionals");
      }});
    } else if(action==="verify"){
      UI.confirmAction({ title:T("Vérifier ")+ids.length+T(" professionnel(s)?"), message:T("Vérification professionnelle groupée."), confirmLabel:T("Vérifier"), onConfirm:function(){
        ids.forEach(function(id){ DATA.updateProfessional(id, { verificationStatus:"approved", verified:true, professionStatus:"verified" }); DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFY_PROFESSIONAL", entity:"Professional", entityId:id, result:"Approved"}); });
        UI.toast(ids.length+T(" professionnel(s) vérifié(s).")); drawPros();
      }});
    } else if(action==="activate"){
      ids.forEach(function(id){ DATA.updateProfessional(id, { status:"active" }); DATA.logAudit({admin:AUTH.getSession().name, action:"ACTIVATE_PROFESSIONAL", entity:"Professional", entityId:id, result:"Active"}); });
      UI.toast(ids.length+T(" professionnel(s) activé(s).")); drawPros();
    }
  }

  function opts(list, cur){ return list.map(function(o){ return '<option value="'+esc(o)+'" '+sel(o,cur)+'>'+esc(o)+'</option>'; }).join(""); }
  function sel(a, b){ return a === b ? "selected" : ""; }
  function proCreatedText(p){
    var d = p.created ? new Date(p.created) : null;
    if(!d || isNaN(d)) return "—";
    return d.toLocaleDateString("fr-MA",{day:"2-digit",month:"short",year:"numeric"});
  }
  function unique(arr){ return arr.filter(function(v,i){ return arr.indexOf(v)===i; }); }

  function drawPros(){
    var list = DATA.getProfessionals({
      q: proState.q, city: proState.city, category: proState.category,
      job: proState.job, verification: proState.verification, subscription: proState.package,
      minRating: proState.rating, created: proState.created, status: proState.status
    });
    list.sort(function(a,b){
      var va=a[proState.sort], vb=b[proState.sort];
      if(typeof va==="string"){ return proState.dir * va.localeCompare(vb); }
      return proState.dir * ((va||0) - (vb||0));
    });
    var pg = UI.paginate(list.length, proState.page, proState.perPage);
    var slice = list.slice(pg.from, pg.to);
    document.getElementById("proCount").textContent = list.length + T(" professionnel(s) — page ")+pg.page+"/"+pg.total;
    document.getElementById("proBody").innerHTML = slice.length ? slice.map(function(p){
      return '<tr id="row-'+p.id+'">' +
        '<td><input type="checkbox" class="row-check" data-id="'+p.id+'" '+((proState.selected[p.id])?"checked":"")+'></td>' +
        '<td><div class="pro"><div class="p-avatar">'+initials(p.name)+'</div><div><div class="pro-name">'+esc(p.name)+'</div><div class="pro-job">'+esc(p.id)+'</div></div></div></td>' +
        '<td>'+esc(p.job)+'</td><td>'+esc(p.city)+'</td>' +
        '<td><span class="star">★</span> '+p.rating+'</td><td>'+p.reviewsCount+'</td>' +
        '<td>'+verBadge(p)+'</td><td>'+pkgBadge(p)+'</td>' +
        '<td>'+esc(proCreatedText(p))+'</td>' +
        '<td>'+statusBadge(p.status)+'</td>' +
        '<td class="actions-cell">' +
          '<button class="icon-act" title="'+T("Voir le profil")+'" data-view="professionals/'+p.id+'">👁️</button>' +
          (AUTH.can("professionals","update")?'<button class="icon-act" title="'+T("Modifier")+'" data-edit="'+p.id+'">✏️</button>':"") +
          (AUTH.can("professionals","verify")?'<button class="icon-act" title="'+T("Vérifier")+'" data-verify="'+p.id+'" style="color:var(--teal)">✅</button>':"") +
          (AUTH.can("professionals","suspend") && (p.status==="active"||p.status==="pending") ?'<button class="icon-act" title="'+T("Suspendre")+'" data-suspend="'+p.id+'" style="color:var(--amber)">⏸️</button>':"") +
          (AUTH.can("professionals","activate") && p.status==="suspended" ?'<button class="icon-act" title="'+T("Activer")+'" data-activate="'+p.id+'" style="color:var(--green)">▶️</button>':"") +
          (AUTH.can("professionals","delete") ?'<button class="icon-act danger" title="'+T("Supprimer")+'" data-del="'+p.id+'">🗑️</button>':"") +
        '</td></tr>';
    }).join("") : '<tr><td colspan="11"><div class="empty" style="padding:30px">'+T("Aucun professionnel trouvé.")+'</div></td></tr>';

    document.querySelectorAll("#proBody .row-check").forEach(function(ch){
      ch.addEventListener("change", function(){ proState.selected[ch.dataset.id] = ch.checked; refreshSelected(); });
    });
    document.querySelectorAll("#proBody [data-view]").forEach(function(b){ b.addEventListener("click", function(){ ROUTER.navigate(b.dataset.view); }); });
    document.querySelectorAll("#proBody [data-edit]").forEach(function(b){ b.addEventListener("click", function(){ openProModal(b.dataset.edit); }); });
    document.querySelectorAll("#proBody [data-verify]").forEach(function(b){ b.addEventListener("click", function(){ openProModal(b.dataset.verify, true); }); });

    var act;
    document.querySelectorAll("#proBody [data-suspend]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.suspend;
      UI.confirmAction({ title:T("Suspendre ce professionnel ?"), message:T("Le professionnel ne sera plus visible dans les recherches."), reasonRequired:true, reasonLabel:T("Raison de la suspension"), confirmLabel:T("Suspendre"), onConfirm:function(reason){
        DATA.updateProfessional(id, { status:"suspended" });
        DATA.logAudit({ admin:AUTH.getSession().name, action:"SUSPEND_PROFESSIONAL", entity:"Professional", entityId:id, result:"Suspended", note:reason });
        UI.toast(T("Professionnel suspendu.")); drawPros();
      }});
    }); });
    document.querySelectorAll("#proBody [data-activate]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.activate;
      DATA.updateProfessional(id, { status:"active" });
      DATA.logAudit({ admin:AUTH.getSession().name, action:"ACTIVATE_PROFESSIONAL", entity:"Professional", entityId:id, result:"Active" });
      UI.toast(T("Professionnel activé.")); drawPros();
    }); });
    document.querySelectorAll("#proBody [data-del]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.del;
      UI.confirmAction({ title:T("Supprimer définitivement ?"), message:T("Cette action est irréversible."), confirmLabel:T("Supprimer"), onConfirm:function(){
        DATA._store.professionals = DATA._store.professionals.filter(function(p){ return p.id!==id; });
        DATA.persist();
        DATA.logAudit({ admin:AUTH.getSession().name, action:"DELETE_PROFESSIONAL", entity:"Professional", entityId:id, result:"Deleted" });
        UI.toast(T("Professionnel supprimé.")); drawPros();
      }});
    }); });
    (act = document.getElementById("proCheckAll")) && act.removeEventListener("change", refreshSelected);

    UI.renderPagination("proPager", pg.page, pg.total, function(p){ proState.page = p; drawPros(); });
  }

  function verBadge(p){
    if(p.verificationStatus==="approved") return '<span class="badge green">✅ '+T("Vérifié")+'</span>';
    if(p.verificationStatus==="rejected") return '<span class="badge red">'+T("Rejeté")+'</span>';
    if(p.verificationStatus==="needs_info") return '<span class="badge amber">'+T("Infos demandées")+'</span>';
    return '<span class="badge amber">'+T("En attente")+'</span>';
  }
  function pkgBadge(p){
    var map = { free:["gray",T("GRATUIT")], verified:["teal",T("VÉRIFIÉ")], gold:["orange","👑 "+T("GOLD")] };
    var m = map[p.package] || ["gray", p.package];
    return '<span class="badge '+m[0]+'">'+m[1]+'</span>';
  }
  function statusBadge(s){
    var m = { active:["green",T("Actif")], pending:["amber",T("En attente")], suspended:["red",T("Suspendu")], rejected:["red",T("Rejeté")], deleted:["gray",T("Supprimé")], expired:["amber",T("Expiré")], cancelled:["gray",T("Annulé")] };
    var e = m[s] || ["gray", s];
    return '<span class="badge '+e[0]+'">'+e[1]+'</span>';
  }
  function rateBadge(p){
    return '<span class="badge" style="background:var(--purple-bg)"><b style="color:var(--purple)">★ '+p.rating+'</b> ('+p.reviewsCount+' '+T("avis")+')</span>';
  }

  function exportPros(idsOnly){
    var rows = [[T("Nom"),T("Profession"),T("Ville"),T("Catégorie"),T("Note"),T("Avis"),T("Vérification"),T("Package"),T("Statut"),"ID"]];
    var list;
    if(idsOnly && idsOnly.length){ list = DATA.getProfessionals().filter(function(p){ return idsOnly.indexOf(p.id)>-1; }); }
    else { list = DATA.getProfessionals({ q: proState.q, city: proState.city, category: proState.category, job: proState.job, verification: proState.verification, subscription: proState.package, minRating: proState.rating, created: proState.created, status: proState.status }); }
    list.forEach(function(p){
      rows.push([p.name, p.job, p.city, p.category, p.rating, p.reviewsCount, p.verificationStatus, p.package, p.status, p.id]);
    });
    UI.exportCSV(idsOnly && idsOnly.length ? "professionnels-selection.csv" : "professionnels-sna3ti.csv", rows);
    UI.toast(T("Export CSV généré."));
  }

  /* ---------- Professional create/edit modal ---------- */
  function openProModal(id, verifyMode){
    var p = id ? DATA.getProfessional(id) : { id:0, name:"", job:"", category:"", city:"", area:"", price:0, phone:"", email:"", verified:false, package:"free", status:"active", rating:0, reviewsCount:0 };
    var cats = DATA.getCategories();
    var regions = DATA.getRegions();
    var cityOpts = regions.reduce(function(a,r){ return a.concat(r.cities); },[])
      .map(function(c){ return '<option value="'+esc(c.name.fr)+'" '+sel(c.name.fr, p.city)+'>'+esc(c.name.fr)+'</option>'; }).join("");

    var modalHtml =
      '<h3>'+(id?T("Modifier"):T("Nouveau"))+' '+T("professionnel")+'</h3>' +
      (verifyMode ? '<div class="form-error" style="margin-bottom:10px">⚠️ '+T("La vérification ne remplace pas l'approbation du centre de vérification.")+'</div>' : "") +
      '<div class="frm">' +
        '<div class="frm"><label>'+T("Nom complet")+'</label><input id="pmName" value="'+esc(p.name)+'"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div class="frm"><label>'+T("Métier")+'</label><input id="pmJob" value="'+esc(p.job)+'"></div>' +
          '<div class="frm"><label>'+T("Catégorie")+'</label><select id="pmCat">'+cats.map(function(c){ return '<option '+sel(c.label.fr, p.category)+'>'+esc(c.label.fr)+'</option>'; }).join("")+'</select></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div class="frm"><label>'+T("Ville")+'</label><select id="pmCity">'+cityOpts+'</select></div>' +
          '<div class="frm"><label>'+T("Quartier")+'</label><input id="pmArea" value="'+esc(p.area)+'"></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div class="frm"><label>'+T("Tarif (DH)")+'</label><input id="pmPrice" type="number" value="'+p.price+'"></div>' +
          '<div class="frm"><label>'+T("Téléphone")+'</label><input id="pmPhone" value="'+esc(p.phone)+'"></div>' +
        '</div>' +
        '<div class="frm"><label>Email</label><input id="pmEmail" type="email" value="'+esc(p.email)+'"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div class="frm"><label>'+T("Package")+'</label><select id="pmPkg"><option value="free">'+T("GRATUIT")+'</option><option value="verified" '+sel(p.package,"verified")+'>'+T("VÉRIFIÉ")+'</option><option value="gold" '+sel(p.package,"gold")+'>'+T("GOLD")+'</option></select></div>' +
          '<div class="frm"><label>'+T("Statut")+'</label><select id="pmStatus">'+["active","pending","suspended","rejected"].map(function(s){return '<option '+sel(p.status,s)+'>'+s+'</option>';}).join("")+'</select></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">'+T("Annuler")+'</button><button class="btn btn-primary" id="pmSave">'+(verifyMode?T("Vérifier & enregistrer"):T("Enregistrer"))+'</button></div>';

    UI.openModal(modalHtml);
    document.getElementById("pmSave").addEventListener("click", function(){
      var data = {
        name: document.getElementById("pmName").value.trim() || T("Sans nom"),
        job: document.getElementById("pmJob").value.trim(),
        category: document.getElementById("pmCat").value,
        city: document.getElementById("pmCity").value,
        area: document.getElementById("pmArea").value.trim(),
        price: parseInt(document.getElementById("pmPrice").value)||0,
        phone: document.getElementById("pmPhone").value.trim(),
        email: document.getElementById("pmEmail").value.trim(),
        package: document.getElementById("pmPkg").value,
        status: document.getElementById("pmStatus").value
      };
      if(verifyMode){ data.verified = true; data.verificationStatus = "approved"; data.professionStatus = "verified"; }
      if(id){
        DATA.updateProfessional(id, data);
        UI.toast(T("Professionnel mis à jour."));
      } else {
        var np = Object.assign({ id: DATA.nextProfessionalId(), professionId:"", categoryId:"", cityId:"", rating:0, reviewsCount:0, languages:[], created:new Date().toISOString().slice(0,10), verificationStatus:"pending", identityStatus:"pending", professionStatus:"pending", verified:false, available:true, verifiedStatus:false }, data, {verified:false});
        DATA._store.professionals.push(np); DATA.persist();
        UI.toast(T("Professionnel créé."));
      }
      UI.closeModal(); renderProfessionals();
    });
  }

  /* ============================================================
     PROFESSIONAL DETAIL
     ============================================================ */
  function renderProfessionalDetail(id){
    UI.renderSkeleton(6, false);
    setTimeout(function(){
      var p = DATA.getProfessional(id);
      if(!p){ UI.renderEmpty(T("Professionnel introuvable."), "🔍"); return; }
      var uid = DATA._store.users.find(function(u){ return u.id===p.userId; });
      var reviews = DATA.getReviews().filter(function(r){ return r.professionalId===p.id; });
      var sub = DATA.getSubscriptions().find(function(s){ return s.professionalId===p.id; });
      var payments = DATA.getPayments().filter(function(pa){ return pa.professionalId===p.id; });
      var verifs = DATA.getVerificationRequests().filter(function(v){ return v.professionalId===p.id; });

      UI.setTitle(p.name);
      var html =
        '<div class="page-head"><h1>'+esc(p.name)+'</h1><div class="spacer">'+
          (AUTH.can("professionals","suspend") && p.status!=="suspended" ? '<button class="btn btn-warn" id="dSuspend">⏸️ '+T("Suspendre")+'</button>' : "") +
          (AUTH.can("professionals","activate") && p.status==="suspended" ? '<button class="btn btn-soft" id="dActivate">▶️ '+T("Activer")+'</button>' : "") +
          (AUTH.can("professionals","verify") && p.verificationStatus!=="approved" ? '<button class="btn btn-primary" id="dVerify">✅ '+T("Vérifier")+'</button>' : "") +
          (AUTH.can("professionals","verify") && p.verificationStatus!=="approved" ? '<button class="btn btn-danger" id="dReject">✖ '+T("Rejeter vérification")+'</button>' : "") +
          (AUTH.can("professionals","update") ? '<button class="btn btn-ghost" id="dEdit">✏️ '+T("Modifier")+'</button>' : "") +
          (AUTH.can("professionals","delete") ? '<button class="btn btn-danger" id="dDelete">🗑️ '+T("Supprimer")+'</button>' : "") +
        '</div></div>' +
        '<div class="card" style="margin-top:0"><div class="pro" style="align-items:flex-start"><div class="p-avatar" style="width:64px;height:64px;font-size:24px">'+initials(p.name)+'</div>' +
          '<div><div style="font-size:18px;font-weight:800;font-family:var(--font-head)">'+esc(p.job)+'</div>' +
          '<div class="muted">'+esc(p.city)+' · '+esc(p.area)+' · ID '+esc(p.id)+'</div>' +
          '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+rateBadge(p)+verBadge(p)+pkgBadge(p)+statusBadge(p.status)+'</div></div></div></div>' +

        '<div class="grid-2" style="margin-top:20px;align-items:start">' +
          '<div class="card"><div class="card-title">'+T("Identité")+'</div><div class="detail-grid" style="margin-top:12px">' +
            drow(T("Nom complet"), p.name) + drow(T("Téléphone"), p.phone) + drow("Email", p.email) +
            drow(T("WhatsApp"), '<a href="https://wa.me/'+esc(String(p.whatsapp||p.phone||"").replace(/\D/g,""))+'" target="_blank" rel="noopener">💬 '+esc(p.whatsapp||p.phone||"—")+'</a>') +
            drow(T("Identité"), '<span class="badge '+(p.identityStatus==="verified"?"green":"amber")+'">'+(p.identityStatus==="verified"?T("✓ Vérifiée"):p.identityStatus)+'</span>') +
            drow("CIN", p.identityStatus==="verified"?T("Fourni"):"—") +
          '</div></div>' +
          '<div class="card"><div class="card-title">'+T("Professionnel")+'</div><div class="detail-grid" style="margin-top:12px">' +
            drow(T("Métier"), p.job) + drow(T("Expérience"), p.experience||"—") +
            (p.description ? '<div class="drow"><div class="dlabel">'+T("Description")+'</div><div class="dvalue" style="line-height:1.55">'+esc(p.description)+'</div></div>' : "") +
            ((p.services&&p.services.length) ? '<div class="drow"><div class="dlabel">'+T("Services")+'</div><div class="dvalue">'+p.services.map(function(s){ return '<span class="badge blue">'+esc(s)+'</span>'; }).join(" ")+'</div></div>' : "") +
            ((p.serviceAreas&&p.serviceAreas.length) ? '<div class="drow"><div class="dlabel">'+T("Zones d'intervention")+'</div><div class="dvalue">'+p.serviceAreas.map(function(s){ return '<span class="badge gray">'+esc(s)+'</span>'; }).join(" ")+'</div></div>' : "") +
            drow(T("Langues"), (p.languages||[]).join(", ")) +
            drow(T("Vérification pro"), p.professionStatus==="verified"?T("🛡️ Professionnel Vérifié"):p.professionStatus) +
            '<div class="drow"><div class="dlabel">'+T("Disponibilité")+'</div><div class="dvalue"><span class="badge '+(p.available?"green":"gray")+'">'+(p.available?T("Disponible"):T("Sur rendez-vous"))+'</span>'+
              (AUTH.can("professionals","update") ? '<button class="btn btn-ghost btn-small" id="dAvail" style="margin-left:8px">'+(p.available?T("Marquer sur rendez-vous"):T("Marquer disponible"))+'</button>' : '') +
            '</div></div>' +
          '</div></div>' +
        '</div>' +

        '<div class="grid-2" style="margin-top:20px;align-items:start">' +
          '<div class="card"><div class="card-title">'+T("Abonnement")+'</div>' + subSection(sub, p.id) + '</div>' +
          '<div class="card"><div class="card-title">'+T("Leads & performance")+'</div><div class="feed" style="margin-top:10px">' +
            leadRow("📞",T("Clics téléphone"), p.leads?p.leads.phoneClicks:842) +
            leadRow("💬",T("Clics WhatsApp"), p.leads?p.leads.whatsappClicks:1240) +
            leadRow("👁️",T("Vues profil"), p.leads?p.leads.profileViews:(p.leads&&p.leads.phone)||820) +
            leadRow("🤝",T("Demandes de contact"), p.leads?p.leads.contactRequests:437) +
            leadRow("📈",T("Taux de conversion"), (p.leads&&p.leads.conversion!==undefined?p.leads.conversion:3.4)+"%") +
          '</div></div>' +
        '</div>' +

        (p.portfolio && p.portfolio.length ? '<div class="card"><div class="card-head"><div class="card-title">'+T("Portfolio")+' ('+p.portfolio.length+')</div></div><div class="portfolio-grid">' +
          p.portfolio.map(function(w){ return '<div class="port-item"><div class="port-thumb">🖼️</div><div class="port-body"><b>'+esc(w.title||w.name||w.label||"")+'</b><div class="muted">'+esc(w.desc||w.description||"")+'</div></div></div>'; }).join("") +
        '</div></div>' : "") +

        mediaSection(p) +

        verificationSection(verifs) +

        activityTimeline(p, verifs, payments, sub) +

        '<div class="card"><div class="card-head"><div class="card-title">'+T("Paiements")+' ('+payments.length+')</div><a class="btn btn-ghost btn-small" href="#/admin/payments">'+T("Tous les paiements")+'</a></div><div class="table-wrap"><table><thead><tr><th>'+T("Référence")+'</th><th>'+T("Date")+'</th><th>'+T("Montant")+'</th><th>'+T("Méthode")+'</th><th>'+T("Statut")+'</th></tr></thead><tbody>' +
          (payments.length ? payments.slice(0,6).map(function(pa){
            return '<tr><td>'+esc(pa.reference||pa.id)+'</td><td>'+esc(pa.date)+'</td><td>'+pa.amount+' DH</td><td>'+esc(pa.method||"—")+'</td><td>'+statusBadge(pa.status)+'</td></tr>';
          }).join("") : '<tr><td colspan="5"><div class="empty">'+T("Aucun paiement.")+'</div></td></tr>') +
        '</tbody></table></div></div>' +

        '<div class="card"><div class="card-head"><div class="card-title">'+T("Avis")+' ('+reviews.length+')</div><div style="display:flex;gap:8px;flex-wrap:wrap">'+reviewSummary(p, reviews)+'</div></div><div class="feed" style="margin-top:10px">' +
          (reviews.length ? reviews.slice(0,6).map(function(r){
            return '<div class="feed-item"><div style="flex:1"><div>'+mkStars(r.rating)+' '+esc(r.customer)+' <span class="badge '+(r.status==="flagged"?"red":r.status==="pending"?"amber":"green")+'">'+esc(r.status)+'</span></div><div class="muted">'+esc(r.comment)+'</div></div></div>';
          }).join("") : '<div class="empty">'+T("Aucun avis.")+'</div>') +
        '</div></div>';

      UI.setContent(html);
      bindMedia(p);

      var ds = document.getElementById("dSuspend"); if(ds) ds.addEventListener("click", function(){
        UI.confirmAction({ title:T("Suspendre ce professionnel ?"), reasonRequired:true, reasonLabel:T("Raison"), confirmLabel:T("Suspendre"), onConfirm:function(reason){
          DATA.updateProfessional(p.id, { status:"suspended" }); DATA.logAudit({admin:AUTH.getSession().name, action:"SUSPEND_PROFESSIONAL", entity:"Professional", entityId:p.id, result:"Suspended", note:reason}); UI.toast(T("Professionnel suspendu.")); renderProfessionalDetail(id);
        }});
      });
      var da = document.getElementById("dActivate"); if(da) da.addEventListener("click", function(){
        DATA.updateProfessional(p.id, { status:"active" }); DATA.logAudit({admin:AUTH.getSession().name, action:"ACTIVATE_PROFESSIONAL", entity:"Professional", entityId:p.id, result:"Active"}); UI.toast(T("Professionnel activé.")); renderProfessionalDetail(id);
      });
      var dv = document.getElementById("dVerify"); if(dv) dv.addEventListener("click", function(){
        UI.confirmAction({ title:T("Vérifier ce professionnel ?"), message:T("Approuve la vérification professionnelle."), confirmLabel:T("Vérifier"), onConfirm:function(){
          DATA.updateProfessional(p.id, { verificationStatus:"approved", verified:true, professionStatus:"verified" }); DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFY_PROFESSIONAL", entity:"Professional", entityId:p.id, result:"Approved"}); UI.toast(T("Professionnel vérifié.")); renderProfessionalDetail(id);
        }});
      });
      var de = document.getElementById("dEdit"); if(de) de.addEventListener("click", function(){ openProModal(p.id); });
      var dav = document.getElementById("dAvail"); if(dav) dav.addEventListener("click", function(){
        var next = !p.available;
        UI.confirmAction({ title: next ? T("Marquer « ")+p.name+T(" » disponible ?") : T("Marquer « ")+p.name+T(" » sur rendez-vous ?"), message: next ? T("Le professionnel apparaîtra comme disponible aux visiteurs.") : T("Le professionnel sera affiché comme sur rendez-vous aux visiteurs."), confirmLabel: next ? T("Disponible") : T("Sur rendez-vous"), onConfirm:function(){
          DATA.updateProfessional(p.id, { available: next });
          DATA.logAudit({admin:AUTH.getSession().name, action: next ? "PROFESSIONAL_MARKED_AVAILABLE" : "PROFESSIONAL_MARKED_UNAVAILABLE", entity:"Professional", entityId:p.id, result:next? T("Disponible"):T("Sur rendez-vous")});
          UI.toast(next ? p.name+T(" est maintenant disponible.") : p.name+T(" est maintenant sur rendez-vous.")); renderProfessionalDetail(id);
        }});
      });
      var drj = document.getElementById("dReject"); if(drj) drj.addEventListener("click", function(){
        var pend = verifs.filter(function(v){ return v.status==="pending" || v.status==="needs_info"; });
        UI.confirmAction({ title:T("Rejeter la vérification de ce professionnel ?"), reasonRequired:true, options:verReasonOptions(), otherLabel:T("Précision (si « Autre »)"), otherPlaceholder:T("Détaillez le motif..."), reasonLabel:T("Raison du rejet"), confirmLabel:T("Rejeter"), onConfirm:function(reason){
          pend.forEach(function(v){ if(v) DATA.rejectVerification(v.id, reason, AUTH.getSession().name); });
          DATA.updateProfessional(p.id, { verificationStatus:"rejected", verified:false, professionStatus:"rejected" });
          DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFICATION_REJECTED", entity:"Professional", entityId:p.id, result:"Rejected", note:reason});
          UI.toast(T("Vérification rejetée.")); renderProfessionalDetail(id); updatePillsSafe();
        }});
      });
      var ddel = document.getElementById("dDelete"); if(ddel) ddel.addEventListener("click", function(){
        UI.confirmAction({ title:T("Supprimer ce professionnel ?"), message:T("Action irréversible. Le profil, ses abonnements, paiements, avis et demandes seront retirés de la plateforme."), confirmLabel:T("Supprimer"), onConfirm:function(){
          DATA.deleteProfessional(p.id);
          DATA.logAudit({admin:AUTH.getSession().name, action:"DELETE_PROFESSIONAL", entity:"Professional", entityId:p.id, result:"Deleted"});
          UI.toast(T("Professionnel supprimé.")); ROUTER.navigate("professionals");
        }});
      });
      var dcp = document.getElementById("dChangePlan"); if(dcp) dcp.addEventListener("click", function(){ changePlanModal(p.id, sub); });
    }, 300);
  }

  function changePlanModal(proId, sub){
    var plans = DATA.getSubscriptionPlans().filter(function(pl){ return pl.active; });
    var current = sub ? sub.planId : "";
    var radio = plans.map(function(pl){
      var checked = pl.id===current ? " checked" : "";
      return '<label class="plan-radio"><input type="radio" name="newplan" value="'+pl.id+'"'+checked+' data-price="'+pl.price+'">'+
        '<span class="promo '+(pl.badge||"gray")+'">'+(String(pl.name).toUpperCase()==="GOLD"?"👑 ":"")+esc(pl.name)+'</span> '+
        '<span class="muted">'+pl.price+' DH / '+T("mois")+'</span><div class="muted small">'+esc(pl.description||"")+'</div></label>';
    }).join("");
    UI.openModal(
      '<h3>'+T("Changer l'abonnement")+'</h3>'+
      '<p class="muted" style="font-size:13px">'+T("Sélectionnez le nouveau plan de ce professionnel.")+'</p>'+
      '<div class="plan-grid" style="margin:14px 0">'+radio+'</div>'+
      '<div class="modal-actions">'+
        '<button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">'+T("Annuler")+'</button>'+
        '<button class="btn btn-primary" id="cpApply">'+T("Appliquer le plan")+'</button>'+
      '</div>');
    var apply=document.getElementById("cpApply"); if(apply) apply.addEventListener("click", function(){
      var sel=document.querySelector('input[name="newplan"]:checked');
      var plan=sel && DATA.getSubscriptionPlans().filter(function(x){return x.active;}).find(function(x){return x.id===sel.value;});
      if(!plan){ UI.toast(T("Sélectionnez un plan."), true); return; }
      DATA.setSubscription(proId, plan.id);
      DATA.logAudit({admin:AUTH.getSession().name, action:"CHANGE_SUBSCRIPTION", entity:"Professional", entityId:proId, result:plan.name, note:plan.price+" DH/"+T("mois")});
      UI.closeModal(); UI.toast(T("Abonnement changé vers ")+plan.name+".");
      renderProfessionalDetail(proId);
    });
  }

  function subSection(sub, proId){
    if(!sub) return '<div class="empty" style="padding:20px">'+T("Aucun abonnement.")+'</div>';
    return '<div class="detail-grid" style="margin-top:12px">' +
      drow(T("Plan"), pkgBadge({package: sub.planName.toLowerCase()==="gold"?"gold":sub.planName.toLowerCase()==="vérifié"?"verified":"free"})) +
      drow(T("Prix"), sub.price+" DH") + drow(T("Début"), sub.since) + drow(T("Renouvellement"), sub.renewal) +
      drow(T("Statut"), statusBadge(sub.status)) + drow(T("Paiement"), '<span class="badge '+ (sub.paymentStatus==="confirmed"?"green":"amber")+'">'+esc(sub.paymentStatus)+'</span>') +
      (AUTH.can("subscriptions","update") && proId ? '<div class="drow"><div class="dk"></div><div class="dv"><button class="btn btn-soft btn-small" id="dChangePlan">🔄 '+T("Changer d'abonnement")+'</button></div></div>' : "") +
    '</div>';
  }
  function drow(k, v){ return '<div class="detail-row"><div class="dk">'+esc(k)+'</div><div class="dv">'+v+'</div></div>'; }
  function leadRow(ico,k,v){ return '<div class="feed-item"><div class="feed-dot teal"></div><div class="f-txt">'+ico+' '+esc(k)+' — <b>'+esc(v)+'</b></div></div>'; }
  function mkStars(r){ var h=""; for(var i=1;i<=5;i++){ h+='<span class="star">'+(i<=Math.round(r)?"★":"☆")+'</span>'; } return h; }
  function todayShort(){ var d=new Date(),p=function(n){return String(n).padStart(2,"0");}; return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }

  function verDecisionBadge(v){
    if(v.status==="approved") return '<span class="badge green">'+T("Approuvée")+'</span>';
    if(v.status==="rejected") return '<span class="badge red">'+T("Rejetée")+'</span>';
    if(v.status==="needs_info") return '<span class="badge amber">'+T("Infos demandées")+'</span>';
    return '<span class="badge amber">'+T("En attente")+'</span>';
  }
  function verificationSection(verifs){
    if(!verifs || !verifs.length){
      return '<div class="card"><div class="card-title">'+T("Vérification")+'</div><div class="empty" style="padding:20px">'+T("Aucune demande de vérification.")+'</div></div>';
    }
    return '<div class="card"><div class="card-head"><div class="card-title">'+T("Vérification")+' ('+verifs.length+')</div>'+
      '<a class="btn btn-ghost btn-small" href="#/admin/verification">'+T("Centre de vérification")+'</a></div>'+
      verifs.map(function(v){
        var reviewer = v.reviewerId ? DATA.adminName(v.reviewerId) : "—";
        var decidedOn = v.reviewedAt ? new Date(v.reviewedAt).toLocaleDateString("fr-MA") : "—";
        var reason = v.reason || (v.status==="pending" ? T("En attente de décision.") : "—");
        return '<div class="detail-grid" style="margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:12px">' +
          '<div class="drow"><div class="dk">'+T("Demande")+'</div><div class="dv"><b>'+esc(v.id)+'</b> · '+esc(v.level)+' '+verDecisionBadge(v)+'</div></div>' +
          '<div class="drow"><div class="dk">'+T("Statut")+'</div><div class="dv">'+verDecisionBadge(v)+'</div></div>' +
          '<div class="drow"><div class="dk">'+T("Documents soumis")+'</div><div class="dv">'+(v.documents&&v.documents.length?v.documents.map(function(x){ return '<span class="badge gray">'+esc(x)+'</span>'; }).join(" "):"—")+'</div></div>' +
          '<div class="drow"><div class="dk">'+T("Relecteur")+'</div><div class="dv">'+esc(reviewer)+'</div></div>' +
          '<div class="drow"><div class="dk">'+T("Décision")+'</div><div class="dv">'+verDecisionBadge(v)+'</div></div>' +
          '<div class="drow"><div class="dk">'+T("Date de décision")+'</div><div class="dv">'+esc(decidedOn)+'</div></div>' +
          (v.reason ? '<div class="drow"><div class="dk">'+T("Raison")+'</div><div class="dv">'+esc(v.reason)+'</div></div>' : "") +
        '</div>';
      }).join("") + '</div>';
  }

  function activityTimeline(p, verifs, payments, sub){
    var events = [];
    var push = function(when, ico, text, type){ events.push({ when: when, ico: ico, text: text, type: type||"teal" }); };
    if(p.created) push(p.created, "📝", T("Compte professionnel créé"), "blue");
    if(sub && sub.since) push(sub.since, "📦", T("Abonnement ")+(sub.planName||"")+" ("+sub.price+" DH) — "+sub.status, "teal");
    (payments||[]).forEach(function(pa){ push(pa.date, "💰", T("Paiement ")+(pa.reference||pa.id)+" "+pa.amount+" DH — "+pa.status, "orange"); });
    (verifs||[]).forEach(function(v){
      push(v.submitted, "✅", T("Demande de vérification ")+v.id+" ("+v.level+") soumise — "+v.status, "teal");
      (v.history||[]).forEach(function(h){ push(h.date, "🕒", h.text, "gray"); });
    });
    events.sort(function(a,b){ return String(a.when).localeCompare(String(b.when)); });
    return '<div class="card"><div class="card-head"><div class="card-title">'+T("Activité")+'</div><span class="muted small">'+T("Chronologique")+'</span></div><div class="feed" style="margin-top:10px">' +
      (events.length ? events.map(function(e){
        return '<div class="feed-item"><div class="feed-dot '+e.type+'"></div><div class="f-txt">'+e.ico+' '+esc(e.text)+'</div><div class="f-when">'+esc(e.when)+'</div></div>';
      }).join("") : '<div class="empty">'+T("Aucune activité.")+'</div>') +
    '</div></div>';
  }

  function reviewSummary(p, reviews){
    var flagged = reviews.filter(function(r){ return r.status==="flagged"; }).length;
    return '<span class="badge" style="background:var(--purple-bg)">★ '+p.rating+' / 5</span>' +
      '<span class="badge blue">'+T("Total")+': '+p.reviewsCount+'</span>' +
      '<span class="badge red">🚩 '+T("Signalés")+': '+flagged+'</span>';
  }

  /* ============================================================
     MEDIA / UPLOADS (visibility + package quotas)
     ============================================================ */
  function mediaSection(p){
    var pkg = String(p.package||"free").toLowerCase();
    var lim = DATA.packageLimits(pkg);
    var use = DATA.getMediaUsage(p.id);
    var media = (p.media||[]);
    var profile = media.filter(function(m){ return m.kind==="profile"; });
    var echant = media.filter(function(m){ return m.kind==="echantillon"; });
    var echantPct = lim.echantillonTotal>0 ? Math.min(100, Math.round(use.echantillonTotal/lim.echantillonTotal*100)) : 100;
    var badge = pkg==="gold" ? "orange" : pkg==="verified" ? "teal" : "gray";
    var grant = lim.kind;

    // Profile photo block
    var profHtml = '<h4>'+T("Photo de profil")+'</h4>' +
      '<div class="media-grid" style="margin-top:10px">' +
        (profile.length ? profile.map(function(m){ return '<div class="media-item"><div class="media-thumb">👤</div><div class="media-body"><b>'+T("Photo de profil")+'</b><div class="muted">'+esc(m.added||"")+'</div>'+
          '<button class="icon-act" data-mdel="'+p.id+'" data-mid="'+m.id+'" title="'+T("Retirer")+'">🗑️</button></div></div>'; }).join("")
          : '<div class="media-item"><div class="media-thumb">➕</div><div class="media-body"><b>'+T("Photo de profil")+'</b><div class="muted">'+T("1 requise (tous les packs)")+'</div></div></div>') +
      '</div>';

    // Échantillons block
    var echantHtml = '<h4 style="margin-top:20px">'+T("Échantillons de travail")+'</h4>' +
      '<div class="muted" style="margin:8px 0">'+T("Quota échantillons : ")+'<b>'+use.echantillonTotal+'</b> / '+lim.echantillonTotal+' ('+T("photos ou vidéos")+') · '+T("vidéos")+' <b>'+use.echantillonVideos+'</b> / '+lim.echantillonVideos+'</div>' +
      '<div class="usage-bar"><div class="usage-fill" style="width:'+echantPct+'%"></div></div>' +
      '<div class="media-grid" id="mediaGrid">' +
        (echant.length ? echant.map(function(m){ return '<div class="media-item"><div class="media-thumb">'+(m.type==="video"?"🎬":"🖼️")+'</div><div class="media-body"><b>'+esc(m.label||(m.type==="video"?T("Vidéo"):T("Photo")))+'</b><div class="muted">'+(m.type==="video"?T("Vidéo"):T("Photo"))+' · '+esc(m.added||"")+'</div>'+
          '<button class="icon-act" data-mdel="'+p.id+'" data-mid="'+m.id+'" title="'+T("Retirer")+'">🗑️</button></div></div>'; }).join("")
          : '<div class="empty">'+T("Aucun échantillon téléversé.")+'</div>') +
      '</div>' +
      '<div class="toolbar" style="margin-top:16px">' +
        '<div class="field grow"><label>'+T("Libellé")+'</label><input type="text" id="medLabel" placeholder="'+T("Ex : Cuisine rénovée")+'"></div>' +
        '<div class="field"><label>&nbsp;</label><button class="btn btn-ghost" id="medProfile">👤 '+T("Ajouter photo de profil")+'</button></div>' +
        '<div class="field"><label>&nbsp;</label><button class="btn btn-ghost" id="medPhoto">🖼️ '+T("Ajouter échantillon")+'</button></div>' +
        '<div class="field"><label>&nbsp;</label><button class="btn btn-ghost" id="medVideo">🎬 '+T("Ajouter vidéo")+'</button></div>' +
      '</div>';

    return '<div class="card"><div class="card-head"><div class="card-title">'+T("Uploads & médias")+' ('+pkg+')</div>'+
      '<span class="badge '+badge+'">'+grant+'</span></div>'+
      '<div style="margin-top:14px">'+profHtml+echantHtml+'</div></div>';
  }
  function bindMedia(p){
    document.querySelectorAll("[data-mdel]").forEach(function(btn){ btn.addEventListener("click", function(){
      DATA.removeMedia(btn.dataset.mdel, btn.dataset.mid); UI.toast(T("Média retiré.")); renderProfessionalDetail(p.id);
    }); });
    var pf = document.getElementById("medProfile"); if(pf) pf.addEventListener("click", function(){ tryUpload(p, "profile"); });
    var ph = document.getElementById("medPhoto"); if(ph) ph.addEventListener("click", function(){ tryUpload(p, "echantillon-photo"); });
    var vd = document.getElementById("medVideo"); if(vd) vd.addEventListener("click", function(){ tryUpload(p, "echantillon-video"); });
  }
  function tryUpload(p, kind){
    var label = (document.getElementById("medLabel")&&document.getElementById("medLabel").value)||"";
    var isProfile = kind==="profile";
    var type = kind==="echantillon-video" ? "video" : "photo";
    var k = kind==="echantillon-video"||kind==="echantillon-photo" ? "echantillon" : "profile";
    var gate = DATA.canUploadMedia(p.id, { kind: k, type: type });
    if(!gate.ok){
      UI.confirmAction({
        title: isProfile ? T("Photo de profil") : (type==="video" ? T("Vidéo non autorisée sur ce pack") : T("Limite d'échantillons atteinte")),
        message: gate.reason + (gate.upgrade ? T(" Faites évoluer votre pack pour débloquer davantage de médias.") : ""),
        confirmLabel: gate.upgrade ? T("Voir les packs") : T("Fermer"),
        cancelLabel: gate.upgrade ? T("Annuler") : "",
        onConfirm: gate.upgrade ? function(){ ROUTER.navigate("subscriptions"); } : function(){}
      });
      return;
    }
    var res = DATA.addMedia(p.id, { kind: k, type: type, label: isProfile ? T("Photo de profil") : (label || (type==="video"?T("Vidéo"):T("Échantillon"))) });
    if(res.ok){
      var u = res.usage;
      UI.toast((isProfile?T("Photo de profil"):T("Média"))+T(" ajouté (profil ")+(u.profileCount||0)+T(", échantillons ")+u.echantillonTotal+").");
      renderProfessionalDetail(p.id);
    }
  }
  function qcCount(p){
    try { return DATA.getMediaUsage(p.id).echantillonTotal || (p.portfolio?p.portfolio.length:0) || 6; } catch(e){ return 6; }
  }

  /* ============================================================
     USERS
     ============================================================ */
  var _userSort = "name", _userPage = 1, _userPer = 6;
  function renderUsers(){
    UI.setTitle(T("Utilisateurs"));
    _userSort = "name"; _userPage = 1;
    var html =
      '<div class="page-head"><h1>'+T("Utilisateurs")+'</h1><div class="spacer"><button class="btn btn-ghost" id="uExport">⬇ '+T("Exporter")+'</button></div></div>' +
      '<div class="card"><div class="toolbar">' +
        '<div class="field"><label>'+T("Recherche")+'</label><input type="search" id="uQ" placeholder="'+T("Nom, email, téléphone...")+'"></div>' +
        '<div class="field"><label>'+T("Statut")+'</label><select id="uStatus"><option value="">'+T("Tous")+'</option>'+["active","suspended","blocked","deleted"].map(function(s){return '<option>'+s+'</option>';}).join("")+'</select></div>' +
        '<div class="field"><label>'+T("Trier")+'</label><select id="uSort">'+
          '<option value="name">'+T("Nom")+'</option>'+
          '<option value="city">'+T("Ville")+'</option>'+
          '<option value="date">'+T("Inscription")+'</option>'+
        '</select></div>' +
      '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>'+T("Utilisateur")+'</th><th>Email</th><th>'+T("Téléphone")+'</th><th>'+T("Ville")+'</th><th>'+T("Inscrit")+'</th><th>'+T("Statut")+'</th><th>'+T("Actions")+'</th></tr></thead><tbody id="uBody"></tbody></table></div>' +
      '<div class="pager" style="display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:10px 14px" id="uPager"></div></div>';
    UI.setContent(html);
    document.getElementById("uQ").addEventListener("input", UI.debounce(function(){ _userPage=1; drawUsers(); }, 220));
    document.getElementById("uStatus").addEventListener("change", function(){ _userPage=1; drawUsers(); });
    document.getElementById("uSort").addEventListener("change", function(){ _userSort=document.getElementById("uSort").value; _userPage=1; drawUsers(); });
    document.getElementById("uExport").addEventListener("click", function(){
      var q=(document.getElementById("uQ").value||"").toLowerCase();
      var st=document.getElementById("uStatus").value;
      var list=DATA.getUsers({q:q, status:st||undefined});
      var rows=[[T("Nom"),"Email",T("Téléphone"),T("Ville"),T("Inscrit"),T("Statut")]]; list.forEach(function(u){ rows.push([u.name,u.email,u.phone||"",cityFr(u.cityId),u.registered,u.status]); });
      UI.exportCSV("utilisateurs-sna3ti.csv", rows); UI.toast(T("Export généré."));
    });
    drawUsers();
  }
  function cityFr(id){ var n=SUBCITY(id); return n; }
  function SUBCITY(id){ var c=DATA.getRegions().reduce(function(a,r){return a.concat(r.cities);},[]).find(function(x){return x.id===id;}); return c?c.name.fr:"—"; }
  var userSortPrio = { active:0, suspended:1, blocked:2, deleted:3 };
  function sortUsers(list){
    var cmp;
    if(_userSort==="city") cmp=function(a,b){ return cityFr(a.cityId).localeCompare(cityFr(b.cityId)); };
    else if(_userSort==="date") cmp=function(a,b){ return String(a.registered).localeCompare(String(b.registered)); };
    else cmp=function(a,b){ return a.name.localeCompare(b.name); };
    return list.slice().sort(cmp);
  }
  function drawUsers(){
    var q=(document.getElementById("uQ").value||"").toLowerCase();
    var st=document.getElementById("uStatus").value;
    var list=sortUsers(DATA.getUsers({q:q, status:st||undefined}));
    var total=Math.max(1, Math.ceil(list.length/_userPer));
    if(_userPage>total) _userPage=total;
    var page=list.slice((_userPage-1)*_userPer, _userPage*_userPer);
    document.getElementById("uBody").innerHTML = page.length ? page.map(function(u){
      return '<tr><td><div class="pro"><div class="p-avatar">'+initials(u.name)+'</div><div class="pro-name">'+esc(u.name)+'</div></div></td>' +
        '<td>'+esc(u.email)+'</td><td>'+esc(u.phone||"—")+'</td><td>'+esc(cityFr(u.cityId))+'</td><td>'+u.registered+'</td>' +
        '<td>'+userStatusBadge(u.status)+'</td>' +
        '<td class="actions-cell">' +
          '<button class="icon-act" title="'+T("Voir le profil")+'" data-view="'+u.id+'" style="color:var(--blue)">👁</button>' +
          (AUTH.can("users","suspend") && u.status==="active" ? '<button class="icon-act" title="'+T("Suspendre")+'" data-susp="'+u.id+'" style="color:var(--amber)">⏸️</button>':"") +
          (AUTH.can("users","suspend") && u.status!=="active" ? '<button class="icon-act" title="'+T("Activer")+'" data-act="'+u.id+'" style="color:var(--green)">▶️</button>':"") +
          (AUTH.can("users","delete") ? '<button class="icon-act danger" title="'+T("Supprimer")+'" data-del="'+u.id+'">🗑️</button>':"") +
        '</td></tr>';
    }).join("") : '<tr><td colspan="7"><div class="empty">'+T("Aucun utilisateur.")+'</div></td></tr>';

    var pager=document.getElementById("uPager");
    pager.innerHTML = list.length>_userPer ?
      '<button class="btn btn-ghost btn-small" id="uPrev" '+( _userPage<=1?"disabled":"")+'>‹ '+T("Précédent")+'</button>'+
      '<span class="muted" style="font-size:12px">'+T("Page")+' '+_userPage+' / '+total+' · '+list.length+' '+T("utilisateurs")+'</span>'+
      '<button class="btn btn-ghost btn-small" id="uNext" '+( _userPage>=total?"disabled":"")+'>'+T("Suivant")+' ›</button>'
      : '<span class="muted" style="font-size:12px">'+list.length+' '+T("utilisateurs")+'</span>';
    if(document.getElementById("uPrev")) document.getElementById("uPrev").addEventListener("click", function(){ if(_userPage>1){ _userPage--; drawUsers(); } });
    if(document.getElementById("uNext")) document.getElementById("uNext").addEventListener("click", function(){ if(_userPage<total){ _userPage++; drawUsers(); } });

    document.querySelectorAll("#uBody [data-view]").forEach(function(b){ b.addEventListener("click", function(){ showUserDetail(b.dataset.view); }); });
    document.querySelectorAll("#uBody [data-susp]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.susp;
      UI.confirmAction({title:T("Suspendre cet utilisateur ?"), reasonRequired:true, reasonLabel:T("Raison de la suspension"), confirmLabel:T("Suspendre"), onConfirm:function(reason){
        DATA.updateUser(id, {status:"suspended"}); DATA.logAudit({admin:AUTH.getSession().name, action:"SUSPEND_USER", entity:"User", entityId:id, result:"Suspended", note:reason}); UI.toast(T("Utilisateur suspendu.")); drawUsers();
      }});
    }); });
    document.querySelectorAll("#uBody [data-act]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.act; DATA.updateUser(id, {status:"active"}); DATA.logAudit({admin:AUTH.getSession().name, action:"ACTIVATE_USER", entity:"User", entityId:id, result:"Active"}); UI.toast(T("Utilisateur activé.")); drawUsers();
    }); });
    document.querySelectorAll("#uBody [data-del]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.del;
      UI.confirmAction({title:T("Supprimer cet utilisateur ?"), message:T("Action irréversible."), confirmLabel:T("Supprimer"), onConfirm:function(){
        DATA._store.users=DATA._store.users.filter(function(u){return u.id!==id;}); DATA.persist();
        DATA.logAudit({admin:AUTH.getSession().name, action:"DELETE_USER", entity:"User", entityId:id, result:"Deleted"});
        UI.toast(T("Utilisateur supprimé.")); drawUsers();
      }});
    }); });
  }
  function showUserDetail(id){
    var u=DATA.getUsers().find(function(x){return x.id===id;});
    if(!u) return;
    var d=DATA.getUserDetail(id);
    var acts=DATA.getUserActivity(id);
    var hired=DATA._store.professionals.filter(function(p){return p.userId===id;});
    UI.openModal(
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">'+
        '<div class="p-avatar" style="width:46px;height:46px;font-size:18px">'+initials(u.name)+'</div>'+
        '<div><h3 style="margin:0">'+esc(u.name)+'</h3>'+userStatusBadge(u.status)+'</div>'+
      '</div>'+
      '<div class="info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0">'+
        '<div><label class="muted" style="font-size:11px">'+T("Email")+'</label><div>'+esc(u.email)+'</div></div>'+
        '<div><label class="muted" style="font-size:11px">'+T("Téléphone")+'</label><div>'+esc(u.phone||"—")+'</div></div>'+
        '<div><label class="muted" style="font-size:11px">'+T("Ville")+'</label><div>'+esc(cityFr(u.cityId))+'</div></div>'+
        '<div><label class="muted" style="font-size:11px">'+T("Inscrit le")+'</label><div>'+esc(u.registered)+'</div></div>'+
      '</div>'+
      '<div class="card-title" style="margin:6px 0 4px">🕘 '+T("Activité")+'</div>'+
      '<div class="feed" style="margin:8px 0">'+
        (acts.length?acts.map(function(a){ return '<div class="feed-item"><div class="feed-dot '+(a.type||"teal")+'"></div><div class="f-txt">'+esc(a.text)+'</div><div class="f-when">'+esc(a.when)+'</div></div>'; }).join(""):'<div class="empty">'+T("Aucune activité.")+'</div>')+
      '</div>'+
      '<div class="card-title" style="margin:6px 0 4px">🔎 '+T("Activité de recherche")+'</div>'+
      '<div class="chip-grid" style="margin:8px 0">'+(d.recentSearches.map(function(s){return '<span class="chip">'+esc(s)+'</span>';}).join("")||'<span class="muted">—</span>')+'</div>'+
      '<div class="muted" style="font-size:12px;margin:2px 0 10px">'+d.searches.length+' '+T("recherches récentes enregistrées")+'</div>'+
      '<div class="card-title" style="margin:6px 0 4px">👁 '+T("Professionnels consultés")+'</div>'+
      (d.viewed.length? '<div class="chip-grid" style="margin:8px 0">'+d.viewed.map(function(v){ return '<span class="chip">'+esc(v.name)+' · '+esc(v.job)+' <span class="muted">('+esc(v.city)+')</span></span>'; }).join("")+'</div>':'<div class="muted" style="margin:8px 0">—</div>')+
      '<div class="card-title" style="margin:6px 0 4px">📨 '+T("Demandes de contact")+'</div>'+
      '<div style="margin:8px 0">'+d.contactRequests+' '+T("demandes de contact envoyées")+'</div>'+
      (hired.length?'<div class="card-title" style="margin:6px 0 4px">🏢 '+T("Profils gérés")+'</div><div style="margin:8px 0">'+hired.map(function(p){return '<span class="chip">'+esc(p.name)+' · '+esc(p.job)+'</span>';}).join("")+'</div>':'')+
      '<div class="card-title" style="margin:6px 0 4px">⭐ '+T("Avis")+'</div>'+
      (d.reviews.length? d.reviews.map(function(r){ return '<div class="feed-item" style="margin:6px 0"><div class="f-txt">'+mkStars(r.rating)+' — '+esc(r.comment)+'</div><div class="f-when">'+esc(r.date)+' · '+revStatus(r.status)+'</div></div>'; }).join("") : '<div class="muted" style="margin:8px 0">'+T("Aucun avis.")+'</div>')+
      '<div class="card-title" style="margin:6px 0 4px">🚩 '+T("Signalements")+'</div>'+
      (d.reports.length? d.reports.map(function(r){ return '<div class="feed-item" style="margin:6px 0"><div class="f-txt">#'+esc(r.id)+' — '+esc(r.reason)+'</div><div class="f-when">'+esc(r.date)+' · '+reportStatusBadge(r.status)+'</div></div>'; }).join("") : '<div class="muted" style="margin:8px 0">'+T("Aucun signalement.")+'</div>')+
      '<div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">'+T("Fermer")+'</button></div>'
    , true);
  }
  function userStatusBadge(s){ var m={active:["green",T("Actif")],suspended:["amber",T("Suspendu")],blocked:["red",T("Bloqué")],deleted:["gray",T("Supprimé")]}; var e=m[s]||["gray",s]; return '<span class="badge '+e[0]+'">'+e[1]+'</span>'; }

  /* ============================================================
     VERIFICATION CENTER
     ============================================================ */
  function renderVerification(initialFilter){
    UI.setTitle(T("Centre de vérification"));
    var valid = { all:1, pending:1, needs_info:1, approved:1, rejected:1 };
    var filter = (initialFilter && valid[initialFilter]) ? initialFilter : "all";
    var all = DATA.getVerificationRequests();
    var citySet={}, profSet={}, revSet={};
    all.forEach(function(v){
      var p = DATA.getProfessional(v.professionalId);
      if(p && p.city) citySet[p.city]=1;
      if(p && p.job) profSet[p.job]=1;
      if(v.reviewerId) revSet[DATA.adminName(v.reviewerId)]=1;
    });
    var cityOpts = Object.keys(citySet).sort().map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join("");
    var profOpts = Object.keys(profSet).sort().map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join("");
    var revOpts = Object.keys(revSet).sort().map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join("");
    var html =
      '<div class="page-head"><h1>'+T("Vérification")+'</h1><div class="spacer muted">'+T("Vérification et abonnement sont indépendants.")+'</div></div>' +
      '<div class="tabs">' +
        tabBtn("all", T("Toutes"), all.length) + tabBtn("pending", T("En attente"), count(all,"pending")) +
        tabBtn("needs_info", T("Infos demandées"), count(all,"needs_info")) + tabBtn("approved", T("Approuvées"), count(all,"approved")) + tabBtn("rejected", T("Rejetées"), count(all,"rejected")) +
      '</div>' +
      '<div class="vfilter-bar"><div class="vf-grid">' +
        '<label class="vf-field">'+T("Ville")+'<select id="vfCity"><option value="">'+T("Toutes")+'</option>'+cityOpts+'</select></label>' +
        '<label class="vf-field">'+T("Métier")+'<select id="vfProf"><option value="">'+T("Tous")+'</option>'+profOpts+'</select></label>' +
        '<label class="vf-field">'+T("Date de soumission")+'<input type="date" id="vfDate"></label>' +
        '<label class="vf-field">'+T("Priorité")+'<select id="vfPrio"><option value="">'+T("Toutes")+'</option><option value="high">'+T("Haute")+'</option><option value="medium">'+T("Moyenne")+'</option><option value="low">'+T("Basse")+'</option></select></label>' +
        '<label class="vf-field">'+T("Relecteur")+'<select id="vfRev"><option value="">'+T("Tous")+'</option>'+revOpts+'</select></label>' +
      '</div><div class="vf-sort">' +
        '<span class="muted">'+T("Trier :")+'</span>' +
        '<button class="btn btn-soft btn-small" data-sort="old">⏫ '+T("Plus ancien d'abord")+'</button>' +
        '<button class="btn btn-soft btn-small" data-sort="new">⏬ '+T("Plus récent d'abord")+'</button>' +
        '<button class="btn btn-soft btn-small" data-sort="prio">🔥 '+T("Priorité la plus haute")+'</button>' +
        '<button class="btn btn-ghost btn-small" id="vfReset">'+T("Réinitialiser")+'</button>' +
      '</div></div><div id="verList"></div>';
    UI.setContent(html);
    drawVerification(filter);
  }
  function count(list, s){ return list.filter(function(v){ return v.status===s; }).length; }
  function tabBtn(id, label, n){ return '<button class="tab" data-tab="'+id+'">'+label+' <span class="cnt">'+n+'</span></button>'; }
  function drawVerification(filter){
    document.querySelectorAll("#content .tab").forEach(function(t){
      t.classList.toggle("active", t.dataset.tab===filter);
      t.onclick=function(){ drawVerification(t.dataset.tab); };
    });
    var list = sortVer( applyVerFilters( DATA.getVerificationRequests({ status: filter==="all"?"":filter }) ), _verSort );
    var el = document.getElementById("verList");
    if(!list.length){ el.innerHTML='<div class="empty">'+T("Aucune demande.")+'</div>'; return; }
    el.innerHTML = list.map(function(v){
      var p = DATA.getProfessional(v.professionalId);
      var isPlan = v.level === "plan";
      var isJoin = v.level === "join";
      var steps = isPlan
        ? '<div class="muted" style="margin-top:8px">'+T("Demande plan")+' · '+
            '<span class="badge '+(String(v.requestedPlan).toLowerCase()==="gold"?"orange":"teal")+'">'+(String(v.requestedPlan).toUpperCase()==="GOLD"?"👑 "+T("GOLD"):"🛡️ "+T("Vérifié"))+'</span> '+
            '<span class="muted">· '+v.price+' DH / '+T("mois")+'</span></div>'
        : isJoin
          ? '<div class="muted" style="margin-top:8px">'+T("Adhésion pack")+' <span class="badge gray">'+T("GRATUIT")+'</span> · 0 DH</div>'
          : '<div class="verif-steps">' +
            '<span class="step '+(v.level==="identity"||v.level==="professionnel"?"done":"")+'">1. '+T("Identité")+'</span>' +
            '<span class="step '+(v.level==="professionnel"?"done":"")+'">2. '+T("Professionnel")+'</span>' +
            '</div>';
      var waiting = slaDays(v.submitted);
      var slaBadge = v.status==="pending" || v.status==="needs_info"
        ? '<span class="badge '+(waiting<=1?"green":waiting<=3?"amber":"red")+'">SLA '+waiting+' j</span>' : "";
      var prio = v.priority ? '<span class="badge '+(v.priority==="high"?"red":"blue")+'">'+ (v.priority==="high"?T("Priorité haute"):T("Priorité")) +'</span>' : "";
      var kindBadge = isPlan ? '<span class="badge purple">'+T("Abonnement")+'</span>' : (isJoin ? '<span class="badge gray">'+T("Adhésion")+'</span>' : '<span class="badge gray">'+T("Vérification")+'</span>');
      var isGold = String(v.requestedPlan||"").toUpperCase()==="GOLD";
      var corner = isPlan
        ? '<div class="req-corner '+(isGold?"gold":"verified")+'"><span class="star">'+(isGold?"👑":"🛡️")+'</span> '+(isGold?T("GOLD"):T("Vérifié"))+'</div>'
        : isJoin ? '<div class="req-corner join"><span class="star">🤝</span> '+T("GRATUIT")+'</div>' : "";
      return '<div class="req">'+ corner + '<div class="req-top'+(isPlan||isJoin?' req-top-pad':'')+'"><div class="grow">' +
        '<div class="pro"><div class="p-avatar">'+initials(p?p.name:"?")+'</div><div><div class="pro-name">'+esc(p?p.name:"?")+'</div><div class="pro-job">'+esc(p?p.job+" · "+p.city:"")+'</div></div></div></div>' +
        kindBadge + slaBadge + prio +
        '<span class="badge '+(v.status==="pending"?"amber":v.status==="approved"?"green":"red")+'">'+esc(v.status)+'</span></div>' +
        steps +
        '<div class="muted" style="margin-top:8px">'+T("Soumis le")+' '+v.submitted+' · '+v.level+'</div>' +
        '<div class="req-actions">' +
          '<button class="btn btn-ghost btn-small" data-audit="'+v.id+'">📜 '+T("Historique")+'</button>' +
          (AUTH.can("verification","reject") ? '<button class="btn btn-danger btn-small" data-reject="'+v.id+'">✖ '+T("Rejeter")+'</button>' : "") +
          (AUTH.can("verification","approve") && v.status!=="approved" ? '<button class="btn btn-primary btn-small" data-approve="'+(isJoin?"j":"")+v.id+'">'+(isJoin?"🤝 "+T("Confirmer adhésion"):"✓ "+T("Approuver"))+'</button>' : "") +
          (AUTH.can("verification","approve") ? '<button class="btn btn-soft btn-small" data-review="'+v.id+'">🔍 '+T("Réviser")+'</button>' : "") +
          (AUTH.can("verification","approve") && v.status!=="approved" && v.status!=="rejected" ? '<button class="btn btn-soft btn-small" data-info="'+v.id+'">💡 '+T("Demander des informations")+'</button>' : "") +
          (isPlan && v.status!=="approved" ? '<button class="btn btn-soft btn-small" data-gopay="'+v.id+'" title="'+T("Voir le paiement")+'">💰 '+T("Voir paiement")+'</button>' : "") +
        '</div></div>';
    }).join("");
    bindVerification();
    bindVerFilters();
  }
  var _verSort = "new";
  function applyVerFilters(list){
    var g=function(id){ var e=document.getElementById(id); return e?e.value:""; };
    var city=g("vfCity"), prof=g("vfProf"), date=g("vfDate"), prio=g("vfPrio"), rev=g("vfRev");
    return list.filter(function(v){
      var p = DATA.getProfessional(v.professionalId) || {};
      if(city && p.city!==city) return false;
      if(prof && p.job!==prof) return false;
      if(prio && v.priority!==prio) return false;
      if(rev && DATA.adminName(v.reviewerId)!==rev) return false;
      if(date && String(v.submitted||"").slice(0,10)!==date) return false;
      return true;
    });
  }
  function sortVer(list, mode){
    var pr={ high:0, medium:1, low:2 };
    var arr = list.slice();
    arr.sort(function(a,b){
      if(mode==="old") return String(a.submitted).localeCompare(String(b.submitted));
      if(mode==="prio"){
        var pa = pr[a.priority]!==undefined?pr[a.priority]:3;
        var pb = pr[b.priority]!==undefined?pr[b.priority]:3;
        if(pa!==pb) return pa-pb;
        return String(b.submitted).localeCompare(String(a.submitted));
      }
      return String(b.submitted).localeCompare(String(a.submitted));
    });
    return arr;
  }
  function bindVerFilters(){
    ["vfCity","vfProf","vfDate","vfPrio","vfRev"].forEach(function(id){
      var e=document.getElementById(id); if(e) e.addEventListener("change", function(){ drawVerification(currentFilter()); });
    });
    document.querySelectorAll("[data-sort]").forEach(function(b){
      b.addEventListener("click", function(){ _verSort=b.dataset.sort; drawVerification(currentFilter()); });
    });
    var r=document.getElementById("vfReset"); if(r) r.addEventListener("click", function(){
      ["vfCity","vfProf","vfDate","vfPrio","vfRev"].forEach(function(id){ var e=document.getElementById(id); if(e) e.value=""; });
      _verSort="new"; drawVerification(currentFilter());
    });
  }
  // store checklist progress per professional
  global.__verCheck = {};
  function bindVerification(){
    document.querySelectorAll("[data-audit]").forEach(function(b){ b.addEventListener("click", function(){ showVerHistory(b.dataset.audit); }); });
    document.querySelectorAll("[data-approve]").forEach(function(b){ b.addEventListener("click", function(){ quickApprove(b.dataset.approve); }); });
    document.querySelectorAll("[data-reject]").forEach(function(b){ b.addEventListener("click", function(){ rejectVer(b.dataset.reject); }); });
    document.querySelectorAll("[data-review]").forEach(function(b){ b.addEventListener("click", function(){ openReview(b.dataset.review); }); });
    document.querySelectorAll("[data-info]").forEach(function(b){ b.addEventListener("click", function(){ requestInfo(b.dataset.info); }); });
    document.querySelectorAll("[data-gopay]").forEach(function(b){ b.addEventListener("click", function(){ ROUTER.navigate("payments"); }); });
  }
  function showVerHistory(id){
    var v = DATA.getVerificationRequests().find(function(x){ return x.id===id; });
    var p = DATA.getProfessional(v.professionalId);
    UI.openModal('<h3>'+T("Historique de vérification")+'</h3><p class="muted" style="font-size:13px">'+esc(p.name)+' — '+esc(v.id)+'</p><div class="timeline" style="margin:14px 0">'+
      (v.history||[]).map(function(h){ return '<div class="tl-item"><div class="t-txt">'+esc(h.text)+'</div><div class="t-when">'+esc(h.date)+'</div></div>'; }).join("") +
      '</div><div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">'+T("Fermer")+'</button></div>');
  }
  function quickApprove(id){
    var isJoin = String(id).charAt(0)==="j";
    if(isJoin) id = id.slice(1);
    var verb = isJoin ? T("Confirmer cette adhésion GRATUIT ?") : T("Approuver cette vérification ?");
    UI.confirmAction({ title: verb, confirmLabel: isJoin ? T("Confirmer adhésion") : T("Approuver"), onConfirm:function(){
      if(isJoin){ DATA.approveJoin(id, AUTH.getSession().name); DATA.logAudit({admin:AUTH.getSession().name, action:"JOIN_APPROVED", entity:"VerificationRequest", entityId:id, result:T("Admis (Gratuit)")}); UI.toast(T("Adhésion GRATUIT confirmée — professionnel admis.")); }
      else { DATA.approveVerification(id, AUTH.getSession().name); DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFY_PROFESSIONAL", entity:"VerificationRequest", entityId:id, result:"Approved"}); UI.toast(T("Vérification approuvée.")); }
      drawVerification(currentFilter()); updatePillsSafe();
    }});
  }
  function currentFilter(){ var a=document.querySelector(".tab.active"); return a?a.dataset.tab:"all"; }
  function slaDays(dateStr){
    var d = new Date(dateStr);
    if(isNaN(d)) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime())/864e5));
  }
  function updatePillsSafe(){ try{ UI.setActiveNav("verification"); }catch(e){} }
  function verReasonOptions(){
    return [ T("Document d'identité invalide"), T("Incohérence d'informations"), T("Preuves insuffisantes"), T("Portfolio insuffisant"), T("Activité suspecte"), T("Autre") ];
  }
  function rejectVer(id){
      UI.confirmAction({ title:T("Rejeter cette vérification ?"), reasonRequired:true, options:verReasonOptions(), otherLabel:T("Précision (si « Autre »)"), otherPlaceholder:T("Détaillez le motif..."), reasonLabel:T("Raison du rejet"), confirmLabel:T("Rejeter"), onConfirm:function(reason){
      DATA.rejectVerification(id, reason, AUTH.getSession().name);
      DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFICATION_REJECTED", entity:"VerificationRequest", entityId:id, result:"Rejected", note:reason});
      UI.toast(T("Vérification rejetée.")); drawVerification(currentFilter()); updatePillsSafe();
    }});
  }
  function requestInfo(id){
    var v = DATA.getVerificationRequests().find(function(x){ return x.id===id; });
    UI.confirmAction({ title:T("Demander des informations"), message: v ? esc((DATA.getProfessional(v.professionalId)||{}).name||"")+" — "+esc(v.id) : "", reasonLabel:T("Informations demandées"), reasonRequired:true, confirmLabel:T("Envoyer la demande"), onConfirm:function(note){
      DATA.requestMoreInfo(id, note, AUTH.getSession().name);
      DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFICATION_INFO_REQUESTED", entity:"VerificationRequest", entityId:id, result:"Needs info", note:note});
      UI.toast(T("Demande d'informations envoyée au professionnel.")); drawVerification(currentFilter()); updatePillsSafe();
    }});
  }
  function openReview(id){
    var v = DATA.getVerificationRequests().find(function(x){ return x.id===id; });
    if(!v) return;
    var p = DATA.getProfessional(v.professionalId);
    if(v.level==="join"){
      UI.openModal(
        '<h3>'+T("Examen de l'adhésion GRATUIT")+'</h3>' +
        '<div class="review-workspace" style="grid-template-columns:1fr 1fr;gap:16px">' +
          '<div class="rw-col"><h4>'+T("Professionnel")+'</h4><div class="pro"><div class="p-avatar" style="width:44px;height:44px">'+initials(p.name)+'</div><div><div class="pro-name">'+esc(p.name)+'</div><div class="pro-job">'+esc(p.job)+'</div></div></div>' +
            '<div class="detail-grid" style="margin-top:14px">'+drow(T("Ville"), p.city)+drow(T("Métier"), p.job)+drow(T("Pack"), pkgBadge({package:"free"}))+'</div></div>' +
          '<div class="rw-col"><h4>'+T("Pack Gratuit")+' — 0 DH / '+T("mois")+'</h4>' +
            '<p class="muted" style="margin-top:8px;font-size:13px">'+T("Admission sur la plateforme Sna3ti.ma")+' · '+T("Constat")+' : <b>'+T("3 photos max, aucune vidéo")+'</b>.</p>' +
            (v.documents||[]).map(function(d){ return '<div class="doc">📄 '+esc(d)+'</div>'; }).join("") +
            '<div class="modal-actions" style="justify-content:flex-start;margin-top:16px">' +
              (AUTH.can("verification","reject")?'<button class="btn btn-danger" id="rvReject">'+T("Rejeter")+'</button>':"") +
              (AUTH.can("verification","approve")?'<button class="btn btn-primary" id="rvApprove">🤝 '+T("Confirmer l'adhésion")+'</button>':"") +
            '</div></div>' +
        '</div>');
      var app = document.getElementById("rvApprove"); if(app) app.addEventListener("click", function(){
        UI.closeModal(); DATA.approveJoin(id, AUTH.getSession().name);
        DATA.logAudit({admin:AUTH.getSession().name, action:"JOIN_APPROVED", entity:"VerificationRequest", entityId:id, result:T("Admis (Gratuit)")});
        UI.toast(T("Adhésion GRATUIT confirmée.")); drawVerification(currentFilter()); updatePillsSafe();
      });
      var rj = document.getElementById("rvReject"); if(rj) rj.addEventListener("click", function(){ UI.closeModal(); rejectVer(id); });
      return;
    }
    if(v.level==="plan"){
      UI.openModal(
        '<h3>'+T("Examen de la demande d'abonnement")+'</h3>' +
        '<div class="review-workspace" style="grid-template-columns:220px 1fr;gap:16px">' +
          '<div class="rw-col"><h4>'+T("Professionnel")+'</h4><div class="pro"><div class="p-avatar" style="width:44px;height:44px">'+initials(p.name)+'</div><div><div class="pro-name">'+esc(p.name)+'</div><div class="pro-job">'+esc(p.job)+'</div></div></div>' +
            '<div class="detail-grid" style="margin-top:14px">'+drow(T("Ville"), p.city)+drow(T("Expérience"), p.experience||"—")+'</div></div>' +
          '<div class="rw-col"><h4>'+T("Plan demandé")+'</h4>' +
            '<div style="display:flex;gap:10px;align-items:center;margin:10px 0">' +
              '<span class="badge '+(String(v.requestedPlan).toLowerCase()==="gold"?"orange":"teal")+'" style="font-size:14px;padding:6px 10px">'+(String(v.requestedPlan).toUpperCase()==="GOLD"?"👑 "+T("GOLD"):"🛡️ "+T("Vérifié"))+'</span>' +
              '<span class="muted">'+v.price+' DH / '+T("mois")+'</span></div>' +
            (v.documents||[]).map(function(d){ return '<div class="doc">📄 '+esc(d)+'</div>'; }).join("") +
            '<p class="muted" style="margin-top:12px">'+T("Vuirement bancaire reçu. Le badge ")+(String(v.requestedPlan).toUpperCase()==="GOLD"?T("GOLD"):T("VÉRIFIÉ"))+T(" est activé sur le profil dès la confirmation du paiement dans Paiements.")+'</p>' +
            '<div class="modal-actions" style="justify-content:flex-start;margin-top:16px">' +
              (AUTH.can("verification","reject")?'<button class="btn btn-danger" id="rvReject">'+T("Rejeter")+'</button>':"") +
              (AUTH.can("verification","approve")?'<button class="btn btn-primary" id="rvApprove">✓ '+T("Approuver (éligibilité)")+'</button>':"") +
            '</div></div>' +
        '</div>');
      var app = document.getElementById("rvApprove"); if(app) app.addEventListener("click", function(){
        UI.closeModal(); DATA.approveVerification(id, AUTH.getSession().name);
        DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFY_PROFESSIONAL", entity:"VerificationRequest", entityId:id, result:"Approved"});
        UI.toast(T("Éligibilité validée. Le badge s'activera à la confirmation du paiement.")); drawVerification(currentFilter()); updatePillsSafe();
      });
      var rj = document.getElementById("rvReject"); if(rj) rj.addEventListener("click", function(){ UI.closeModal(); rejectVer(id); });
      return;
    }
    var cfg = DATA.getConfig().verification;
    var checks = global.__verCheck[id] || {};
    var html =
      '<h3>'+T("Examen de vérification")+'</h3>' +
      '<div class="review-workspace" style="grid-template-columns:220px 1fr 260px;gap:16px">' +
        '<div class="rw-col"><h4>'+T("Professionnel")+'</h4><div class="pro"><div class="p-avatar" style="width:44px;height:44px">'+initials(p.name)+'</div><div><div class="pro-name">'+esc(p.name)+'</div><div class="pro-job">'+esc(p.job)+'</div></div></div>' +
          '<div class="detail-grid" style="margin-top:14px">'+drow(T("Ville"), p.city)+drow(T("Expérience"), p.experience||"—")+drow(T("Niveau"), v.level)+'</div></div>' +
        '<div class="rw-col"><h4>'+T("Photo de profil")+'</h4>' +
          '<div class="prof-photo"><div class="p-avatar" style="width:96px;height:96px;font-size:34px">'+initials(p.name)+'</div>' +
          '<div class="muted small" style="margin-top:8px">'+T("1 photo de profil requise (tous les packs).")+'</div></div>' +
          '<h4 style="margin-top:18px">'+T("Échantillons de travail")+'</h4>' +
          '<div class="muted" style="font-size:12.5px;margin-top:6px">'+qcCount(p)+' '+T("échantillon(s) fourni(s). Vérifiez : clarté, cadrage, travail conforme.")+'</div>' +
          '<div class="muted small" style="font-size:12px;margin-top:6px">'+T("Documents attendus : ")+T("Photo de profil · Échantillons").split(" · ").map(function(d){ return '<span class="doc" style="padding:6px 10px;font-size:12px">📄 '+esc(d)+'</span>'; }).join(" ")+'</div></div>' +
        '<div class="rw-col"><h4>'+T("Liste de contrôle")+'</h4><div class="checklist" id="verChecks">' +
          cfg.requiredChecks.map(function(c){
            return '<label><input type="checkbox" data-check="'+c+'" '+(checks[c]?"checked":"")+'><span>'+esc(cfg.checkLabels[c]||c)+'</span></label>';
          }).join("") +
        '</div>' +
          '<div class="modal-actions" style="justify-content:flex-start;margin-top:16px">' +
            (AUTH.can("verification","reject")?'<button class="btn btn-danger" id="rvReject">'+T("Rejeter")+'</button>':"") +
            (AUTH.can("verification","approve")?'<button class="btn btn-primary" id="rvApprove" '+(allChecksDone(checks)?"":"disabled")+'>'+T("Approuver")+'</button>':"") +
          '</div></div>' +
      '</div>';
    UI.openModal(html, true);
    function allChecksDone(c){ return cfg.requiredChecks.every(function(x){ return !!c[x]; }); }
    document.querySelectorAll("#verChecks input").forEach(function(inp){
      inp.addEventListener("change", function(){
        var idk = v.id;
        global.__verCheck[idk] = global.__verCheck[idk] || {};
        global.__verCheck[idk][inp.dataset.check] = inp.checked;
        var done = cfg.requiredChecks.every(function(x){ return global.__verCheck[idk][x]; });
        var btn = document.getElementById("rvApprove"); if(btn){ btn.disabled = !done; }
        var lab = inp.closest("label"); if(lab) lab.classList.toggle("c-checked", inp.checked);
      });
    });
    var app = document.getElementById("rvApprove"); if(app) app.addEventListener("click", function(){
      if(!allChecksDone(global.__verCheck[v.id]||{})){ UI.toast(T("Complétez d'abord la liste de contrôle."), true); return; }
      UI.closeModal();
      DATA.approveVerification(id, AUTH.getSession().name);
      DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFY_PROFESSIONAL", entity:"VerificationRequest", entityId:id, result:"Approved"});
      UI.toast(T("Vérification approuvée.")); drawVerification(currentFilter()); updatePillsSafe();
    });
    var rj = document.getElementById("rvReject"); if(rj) rj.addEventListener("click", function(){
      UI.closeModal(); rejectVer(id);
    });
  }

  /* ============================================================
     CATEGORIES & CITIES
     ============================================================ */
  function renderCategories(){
    UI.setTitle(T("Catégories"));
    var cats = DATA.getCategories().slice().sort(function(a,b){ return a.order-b.order; });
    var canU = AUTH.can("categories","update");
    function svcBadge(s){ return '<span class="badge '+(s.status==="active"?"green":"gray")+'">'+(s.status==="active"?T("Actif"):T("Inactif"))+'</span>'; }
    function svcRows(c, sc){
      return (sc.services||[]).slice().sort(function(a,b){ return a.order-b.order; }).map(function(s,i){
        return '<div class="row-item cat-svc"><div class="grow"><b style="display:flex;gap:8px"><span>'+s.icon+'</span> '+esc(s.label.fr)+'</b>'+
          '<div class="muted">FR: '+esc(s.label.fr)+' · AR: '+esc(s.label.ar)+' · EN: '+esc(s.label.en)+'</div>'+
          (s.description?'<div class="muted" style="font-size:12px">'+esc(s.description)+'</div>':"")+
          '<div class="muted" style="font-size:11px">'+T("Ordre")+': '+s.order+' · '+T("Code")+': '+esc(s.code||"—")+'</div></div>'+
          svcBadge(s)+
          (canU? ('<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-svcid="'+s.id+'" data-act="svc-up" title="'+T("Monter")+'">↑</button>'+
            '<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-svcid="'+s.id+'" data-act="svc-dn" title="'+T("Descendre")+'">↓</button>'+
            '<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-svcid="'+s.id+'" data-act="svc-edit" title="'+T("Modifier")+'">✏️</button>'+
            '<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-svcid="'+s.id+'" data-act="svc-dup" title="'+T("Dupliquer")+'">⧉</button>'+
            '<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-svcid="'+s.id+'" data-act="svc-tog" title="'+(s.status==="active"?T("Désactiver"):T("Activer"))+'">'+(s.status==="active"?"⏸️":"▶️")+'</button>'+
            '<button class="icon-act danger" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-svcid="'+s.id+'" data-act="svc-del" title="'+T("Supprimer")+'">🗑️</button>') : "")+'</div>';
      }).join("");
    }
    function subRows(c){
      return (c.subcategories||[]).slice().sort(function(a,b){ return a.order-b.order; }).map(function(sc,i){
        return '<div class="row-item cat-sub"><div class="grow"><b style="display:flex;gap:8px"><span>'+sc.icon+'</span> '+esc(sc.label.fr)+'</b>'+
          '<div class="muted">FR: '+esc(sc.label.fr)+' · AR: '+esc(sc.label.ar)+' · EN: '+esc(sc.label.en)+'</div>'+
          (sc.description?'<div class="muted" style="font-size:12px">'+esc(sc.description)+'</div>':"")+
          '<div class="muted" style="font-size:11px">'+T("Ordre")+': '+sc.order+' · '+sc.services.length+' '+T("services")+'</div></div>'+
          '<span class="badge '+(sc.active?"green":"gray")+'">'+(sc.active?T("Actif"):T("Inactif"))+'</span>'+
          (canU? ('<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-act="sub-up" title="'+T("Monter")+'">↑</button>'+
            '<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-act="sub-dn" title="'+T("Descendre")+'">↓</button>'+
            '<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-act="sub-addsvc" title="+ '+T("Service")+'">➕</button>'+
            '<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-act="sub-edit" title="'+T("Modifier")+'">✏️</button>'+
            '<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-act="sub-dup" title="'+T("Dupliquer")+'">⧉</button>'+
            '<button class="icon-act" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-act="sub-tog" title="'+(sc.active?T("Désactiver"):T("Activer"))+'">'+(sc.active?"⏸️":"▶️")+'</button>'+
            '<button class="icon-act danger" data-catid="'+c.id+'" data-subid="'+sc.id+'" data-act="sub-del" title="'+T("Supprimer")+'">🗑️</button>') : "")+'</div>'+
          ('<div>'+svcRows(c, sc)+'</div>');
      }).join("");
    }
    UI.setContent(
      '<div class="page-head"><h1>'+T("Catégories")+'</h1><div class="spacer">'+
        (canU?'<button class="btn btn-primary" data-act="cat-add">+ '+T("Catégorie")+'</button>':"")+'</div></div>' +
      '<div class="card"><div class="card-title">'+T("Catégorie → Sous-catégorie → Service")+'</div>' +
      (canU?'<div class="muted" style="margin:6px 0 12px">'+T("Chaque service : nom FR/AR/EN, icône, description, statut et ordre d'affichage.")+'</div>':"") +
      cats.map(function(c){
        return '<div class="cat-block" style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:12px">'+
          '<div class="row-item"><div class="grow"><b style="display:flex;gap:8px"><span>'+c.icon+'</span> '+esc(c.label.fr)+'</b>'+
            '<div class="muted">FR: '+esc(c.label.fr)+' · AR: '+esc(c.label.ar)+' · EN: '+esc(c.label.en)+'</div>'+
            (c.description?'<div class="muted" style="font-size:12px">'+esc(c.description)+'</div>':"")+
            '<div class="muted" style="font-size:11px">'+T("Ordre")+': '+c.order+' · '+c.subcategories.length+' '+T("sous-catégories")+'</div></div>'+
            '<span class="badge '+(c.active?"green":"gray")+'">'+(c.active?T("Actif"):T("Inactif"))+'</span>'+
            (canU? '<button class="icon-act" data-catid="'+c.id+'" data-act="cat-up" title="'+T("Monter")+'">↑</button>'+
              '<button class="icon-act" data-catid="'+c.id+'" data-act="cat-dn" title="'+T("Descendre")+'">↓</button>'+
              '<button class="icon-act" data-catid="'+c.id+'" data-act="cat-addsub" title="+ '+T("Sous-catégorie")+'">➕</button>'+
              '<button class="icon-act" data-catid="'+c.id+'" data-act="cat-edit" title="'+T("Modifier")+'">✏️</button>'+
              '<button class="icon-act" data-catid="'+c.id+'" data-act="cat-dup" title="'+T("Dupliquer")+'">⧉</button>'+
              '<button class="icon-act" data-catid="'+c.id+'" data-act="cat-tog" title="'+(c.active?T("Désactiver"):T("Activer"))+'">'+(c.active?"⏸️":"▶️")+'</button>'+
              '<button class="icon-act danger" data-catid="'+c.id+'" data-act="cat-del" title="'+T("Supprimer")+'">🗑️</button>' : "")+'</div>'+
        '<div>'+subRows(c)+'</div></div>';
      }).join("") + '</div>'
    );
    bindCatActions();
  }
  function bindCatActions(){
    document.querySelectorAll("[data-act]").forEach(function(b){
      b.addEventListener("click", function(){ catAction(b.dataset.act, b.dataset.catid||"", b.dataset.subid||"", b.dataset.svcid||""); });
    });
  }
  var catUsedToast = function(){ UI.toast(T("Impossible : élément utilisé par un professionnel."), true); };
  function catAction(act, catId, subId, svcId){
    var cats = DATA._store.categories;
    var c = cats.find(function(x){ return x.id===catId; });
    function catIndex(){ return cats.indexOf(c); }
    function reindexCat(){ cats.sort(function(a,b){ return a.order-b.order; }); cats.forEach(function(x,i){ x.order=i+1; }); }
    function subIndex(){ var sc=c.subcategories.find(function(x){return x.id===subId;}); return c.subcategories.indexOf(sc); }
    function reindexSub(){ c.subcategories.sort(function(a,b){return a.order-b.order;}); c.subcategories.forEach(function(x,i){ x.order=i+1; }); }
    function getSc(){ return c.subcategories.find(function(x){ return x.id===subId; }); }
    function svcIndex(){ var s=getSc().services.find(function(x){return x.id===svcId;}); return getSc().services.indexOf(s); }
    function reindexSvc(){ var arr=getSc().services; arr.sort(function(a,b){return a.order-b.order;}); arr.forEach(function(x,i){ x.order=i+1; }); }
    function swap(arr, i, dir){ var j=i+dir; if(j<0||j>=arr.length){ UI.toast(T("Déjà en limite.")); return; } var t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
    function done(msg){ DATA.persist(); if(msg) UI.toast(msg); renderCategories(); }
    function audit(action, ent, id, result){ DATA.logAudit({admin:AUTH.getSession().name, action:action, entity:ent, entityId:id, result:result}); }
    // ---- CATEGORY actions ----
    if(act==="cat-add"){
      var fr=prompt(T("Nom (FR) :")), ar=prompt(T("Nom (AR) :")), en=prompt(T("Nom (EN) :")), ic=prompt(T("Icône (emoji) :"))||"📁", desc=prompt(T("Description :"))||"";
      if(fr&&fr.trim()){ cats.push({id:"CAT-"+Date.now(), code:"", icon:ic, order:cats.length+1, active:true, description:desc, label:{fr:fr.trim(),ar:ar||"",en:en||""}, subcategories:[]}); audit("CATEGORY_CREATED","Category",cats[cats.length-1].id,"Created"); done(T("Catégorie ajoutée.")); }
      return;
    }
    if(act==="cat-edit"){
      var nfr=prompt(T("Nom (FR) :"), c.label.fr), nar=prompt(T("Nom (AR) :"), c.label.ar), nen=prompt(T("Nom (EN) :"), c.label.en), nico=prompt(T("Icône (emoji) :"), c.icon), ndesc=prompt(T("Description :"), c.description||"");
      if(nfr!==null){ c.label.fr=nfr||c.label.fr; if(nar!==null)c.label.ar=nar; if(nen!==null)c.label.en=nen; if(nico!==null)c.icon=nico; if(ndesc!==null)c.description=ndesc; audit("CATEGORY_CHANGED","Category",c.id,"Updated"); done(T("Catégorie modifiée.")); }
      return;
    }
    if(act==="cat-dup"){
      var copy=cloneObj(c); copy.id="CAT-"+Date.now(); copy.order=Math.max.apply(null, cats.map(function(x){return x.order;}))+1; copy.label={fr:c.label.fr+" (copie)", ar:c.label.ar, en:c.label.en};
      copy.subcategories=(c.subcategories||[]).map(function(sc){ var sc2=cloneObj(sc); sc2.id="SUB-"+Date.now()+"-"+Math.floor(Math.random()*999); sc2.services=(sc.services||[]).map(function(s){ var s2=cloneObj(s); s2.id="SVC-"+Date.now()+"-"+Math.floor(Math.random()*999); return s2; }); return sc2; });
      cats.push(copy); audit("CATEGORY_DUPLICATED","Category",copy.id,"Duplicated"); done(T("Catégorie dupliquée."));
      return;
    }
    if(act==="cat-tog"){ c.active=!c.active; audit(c.active?"CATEGORY_ACTIVATED":"CATEGORY_DEACTIVATED","Category",c.id,c.active?"Active":"Inactive"); done(T("Statut mis à jour.")); return; }
    if(act==="cat-up"||act==="cat-dn"){ var dir=act==="cat-up"?-1:1; swap(cats, catIndex(), dir); reindexCat(); done(); return; }
    if(act==="cat-del"){
      if(DATA.isCategoryUsed(c.id)){ catUsedToast(); return; }
      UI.confirmAction({title:T("Supprimer cette catégorie ?"), message:T("La catégorie et ses sous-catégories/services seront retirés."), confirmLabel:T("Supprimer"), onConfirm:function(){
        cats.splice(cats.indexOf(c),1); reindexCat(); audit("CATEGORY_DELETED","Category",c.id,"Deleted"); done(T("Catégorie supprimée."));
      }});
      return;
    }
    if(act==="cat-addsub"){
      var sfr=prompt(T("Nom (FR) :")), sar=prompt(T("Nom (AR) :")), sen=prompt(T("Nom (EN) :")), sic=prompt(T("Icône (emoji) :"))||"📁", sdesc=prompt(T("Description :"))||"";
      if(sfr&&sfr.trim()){ c.subcategories.push({id:"SUB-"+Date.now(), code:"", icon:sic, order:c.subcategories.length+1, active:true, description:sdesc, label:{fr:sfr.trim(),ar:sar||"",en:sen||""}, services:[]}); audit("CATEGORY_CHANGED","Subcategory",c.subcategories[c.subcategories.length-1].id,"Created"); done(T("Sous-catégorie ajoutée.")); }
      return;
    }
    if(!c) return;
    // ---- SUBCATEGORY actions ----
    var sc = getSc();
    if(act==="sub-up"||act==="sub-dn"){ swap(c.subcategories, subIndex(), act==="sub-up"?-1:1); reindexSub(); done(); return; }
    if(act==="sub-edit"){
      var xfr=prompt(T("Nom (FR) :"), sc.label.fr), xar=prompt(T("Nom (AR) :"), sc.label.ar), xen=prompt(T("Nom (EN) :"), sc.label.en), xico=prompt(T("Icône (emoji) :"), sc.icon), xdesc=prompt(T("Description :"), sc.description||"");
      if(xfr!==null){ sc.label.fr=xfr||sc.label.fr; if(xar!==null)sc.label.ar=xar; if(xen!==null)sc.label.en=xen; if(xico!==null)sc.icon=xico; if(xdesc!==null)sc.description=xdesc; audit("CATEGORY_CHANGED","Subcategory",sc.id,"Updated"); done(T("Sous-catégorie modifiée.")); }
      return;
    }
    if(act==="sub-dup"){
      var sc2=cloneObj(sc); sc2.id="SUB-"+Date.now(); sc2.order=Math.max.apply(null, c.subcategories.map(function(x){return x.order;}))+1; sc2.label={fr:sc.label.fr+" (copie)", ar:sc.label.ar, en:sc.label.en}; sc2.services=(sc.services||[]).map(function(s){ var s2=cloneObj(s); s2.id="SVC-"+Date.now()+"-"+Math.floor(Math.random()*999); return s2; }); c.subcategories.push(sc2); audit("CATEGORY_CHANGED","Subcategory",sc2.id,"Duplicated"); done(T("Sous-catégorie dupliquée."));
      return;
    }
    if(act==="sub-tog"){ sc.active=!sc.active; audit(sc.active?"CATEGORY_ACTIVATED":"CATEGORY_DEACTIVATED","Subcategory",sc.id,sc.active?"Active":"Inactive"); done(T("Statut mis à jour.")); return; }
    if(act==="sub-addsvc"){
      var vfr=prompt(T("Nom (FR) :")), var2=prompt(T("Nom (AR) :")), ven=prompt(T("Nom (EN) :")), vic=prompt(T("Icône (emoji) :"))||"🔧", vdesc=prompt(T("Description :"))||"";
      if(vfr&&vfr.trim()){ sc.services.push({id:"SVC-"+Date.now(), code:"", icon:vic, order:sc.services.length+1, status:"active", description:vdesc, label:{fr:vfr.trim(),ar:var2||"",en:ven||""}}); audit("CATEGORY_CHANGED","Service",sc.services[sc.services.length-1].id,"Created"); done(T("Service ajouté.")); }
      return;
    }
    if(act==="sub-del"){
      if((sc.services||[]).some(function(s){ return DATA.isServiceUsed(s.id); })){ catUsedToast(); return; }
      UI.confirmAction({title:T("Supprimer cette sous-catégorie ?"), message:T("La sous-catégorie et ses services seront retirés."), confirmLabel:T("Supprimer"), onConfirm:function(){
        c.subcategories.splice(c.subcategories.indexOf(sc),1); reindexSub(); audit("CATEGORY_DELETED","Subcategory",sc.id,"Deleted"); done(T("Sous-catégorie supprimée."));
      }});
      return;
    }
    // ---- SERVICE actions ----
    if(!sc) return;
    var s = sc.services.find(function(x){ return x.id===svcId; });
    if(!s) return;
    if(act==="svc-up"||act==="svc-dn"){ swap(sc.services, svcIndex(), act==="svc-up"?-1:1); reindexSvc(); done(); return; }
    if(act==="svc-edit"){
      var efr=prompt(T("Nom (FR) :"), s.label.fr), ear=prompt(T("Nom (AR) :"), s.label.ar), een=prompt(T("Nom (EN) :"), s.label.en), eico=prompt(T("Icône (emoji) :"), s.icon), edesc=prompt(T("Description :"), s.description||"");
      if(efr!==null){ s.label.fr=efr||s.label.fr; if(ear!==null)s.label.ar=ear; if(een!==null)s.label.en=een; if(eico!==null)s.icon=eico; if(edesc!==null)s.description=edesc; audit("CATEGORY_CHANGED","Service",s.id,"Updated"); done(T("Service modifié.")); }
      return;
    }
    if(act==="svc-dup"){
      var s2=cloneObj(s); s2.id="SVC-"+Date.now(); s2.order=Math.max.apply(null, sc.services.map(function(x){return x.order;}))+1; s2.label={fr:s.label.fr+" (copie)", ar:s.label.ar, en:s.label.en}; sc.services.push(s2); audit("CATEGORY_CHANGED","Service",s2.id,"Duplicated"); done(T("Service dupliqué."));
      return;
    }
    if(act==="svc-tog"){ s.status=s.status==="active"?"inactive":"active"; audit(s.status==="active"?"CATEGORY_ACTIVATED":"CATEGORY_DEACTIVATED","Service",s.id,s.status); done(T("Statut mis à jour.")); return; }
    if(act==="svc-del"){
      if(DATA.isServiceUsed(s.id)){ catUsedToast(); return; }
      UI.confirmAction({title:T("Supprimer ce service ?"), confirmLabel:T("Supprimer"), onConfirm:function(){
        sc.services.splice(sc.services.indexOf(s),1); reindexSvc(); audit("CATEGORY_DELETED","Service",s.id,"Deleted"); done(T("Service supprimé."));
      }});
      return;
    }
  }
  function cloneObj(o){ return JSON.parse(JSON.stringify(o)); }


  function renderCities(){
    UI.setTitle(T("Villes"));
    var regions = DATA.getRegions().slice().sort(function(a,b){ return a.order-b.order; });
    var canU = AUTH.can("cities","update");
    UI.setContent(
      '<div class="page-head"><h1>'+T("Villes & localisation")+'</h1><div class="spacer">'+
        (canU?'<button class="btn btn-primary" data-act="cty-reg-add">+ '+T("Région")+'</button>':"")+'</div></div>' +
      (canU?'<div class="muted" style="margin-bottom:12px">'+T("Structure Région → Ville → Quartiers, multilingue FR/AR/EN avec statut et ordre.")+'</div>':"") +
      regions.map(function(r){
        return '<div class="cat-block" style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:12px">'+
          '<div class="row-item"><div class="grow"><b style="display:flex;gap:8px"><span>📍</span>'+esc(r.name.fr)+'</b>'+
            '<div class="muted">FR: '+esc(r.name.fr)+' · AR: '+esc(r.name.ar)+' · EN: '+esc(r.name.en)+'</div>'+
            '<div class="muted" style="font-size:11px">'+T("Code")+' · '+esc(r.code||"—")+' · '+T("Ordre")+': '+r.order+' · '+(r.cities||[]).length+' '+T("villes")+'</div></div>'+
            '<span class="badge '+(r.active!==false?"green":"gray")+'">'+((r.active!==false)?T("Actif"):T("Inactif"))+'</span>'+
            (canU? '<button class="icon-act" data-regid="'+r.id+'" data-act="reg-up" title="'+T("Monter")+'">↑</button>'+
              '<button class="icon-act" data-regid="'+r.id+'" data-act="reg-dn" title="'+T("Descendre")+'">↓</button>'+
              '<button class="icon-act" data-regid="'+r.id+'" data-act="reg-addcity" title="+ '+T("Ville")+'">➕</button>'+
              '<button class="icon-act" data-regid="'+r.id+'" data-act="reg-edit" title="'+T("Modifier")+'">✏️</button>'+
              '<button class="icon-act" data-regid="'+r.id+'" data-act="reg-dup" title="'+T("Dupliquer")+'">⧉</button>'+
              '<button class="icon-act" data-regid="'+r.id+'" data-act="reg-tog" title="'+((r.active!==false)?T("Désactiver"):T("Activer"))+'">'+((r.active!==false)?"⏸️":"▶️")+'</button>'+
              '<button class="icon-act danger" data-regid="'+r.id+'" data-act="reg-del" title="'+T("Supprimer")+'">🗑️</button>' : "")+'</div>'+
          (r.cities||[]).slice().sort(function(a,b){ return a.order-b.order; }).map(function(c){
            return '<div class="row-item cat-sub"><div class="grow"><b style="display:flex;gap:8px"><span>🏙️</span> '+esc(c.name.fr)+'</b>'+
              '<div class="muted">FR: '+esc(c.name.fr)+' · AR: '+esc(c.name.ar)+' · EN: '+esc(c.name.en)+'</div>'+
              '<div class="muted" style="font-size:11px">'+T("Ordre")+': '+c.order+' · '+(c.neighborhoods||[]).length+' '+T("quartiers")+'</div>'+
              '<div class="chip-grid" style="margin-top:8px">'+(c.neighborhoods||[]).map(function(n){return '<span class="chip">'+esc((typeof n==="string")?n:n.name.fr)+'</span>';}).join("")+'</div></div>'+
              '<span class="badge '+(c.active!==false?"green":"gray")+'">'+((c.active!==false)?T("Actif"):T("Inactif"))+'</span>'+
              (canU? '<button class="icon-act" data-regid="'+r.id+'" data-cid="'+c.id+'" data-act="cty-up" title="'+T("Monter")+'">↑</button>'+
                '<button class="icon-act" data-regid="'+r.id+'" data-cid="'+c.id+'" data-act="cty-dn" title="'+T("Descendre")+'">↓</button>'+
                '<button class="icon-act" data-regid="'+r.id+'" data-cid="'+c.id+'" data-act="cty-addhood" title="+ '+T("Quartier")+'">➕</button>'+
                '<button class="icon-act" data-regid="'+r.id+'" data-cid="'+c.id+'" data-act="cty-edit" title="'+T("Modifier")+'">✏️</button>'+
                '<button class="icon-act" data-regid="'+r.id+'" data-cid="'+c.id+'" data-act="cty-dup" title="'+T("Dupliquer")+'">⧉</button>'+
                '<button class="icon-act" data-regid="'+r.id+'" data-cid="'+c.id+'" data-act="cty-tog" title="'+((c.active!==false)?T("Désactiver"):T("Activer"))+'">'+((c.active!==false)?"⏸️":"▶️")+'</button>'+
                '<button class="icon-act danger" data-regid="'+r.id+'" data-cid="'+c.id+'" data-act="cty-del" title="'+T("Supprimer")+'">🗑️</button>' : "")+'</div>';
          }).join("") +
        '</div>';
      }).join("")
    );
    document.querySelectorAll("[data-act]").forEach(function(b){ b.addEventListener("click", function(){ ctyAction(b.dataset.act, b.dataset.regid||"", b.dataset.cid||""); }); });
  }
  function ctyAction(act, regId, cityId){
    var regs = DATA._store.regions;
    var r = regs.find(function(x){ return x.id===regId; });
    function reindexReg(){ regs.sort(function(a,b){ return a.order-b.order; }); regs.forEach(function(x,i){ x.order=i+1; }); }
    function reindexCity(){ r.cities.sort(function(a,b){ return a.order-b.order; }); r.cities.forEach(function(x,i){ x.order=i+1; }); }
    function cIndex(){ return regs.indexOf(r); }
    function done(msg){ DATA.persist(); if(msg) UI.toast(msg); renderCities(); }
    function audit(action, ent, id, result){ DATA.logAudit({admin:AUTH.getSession().name, action:action, entity:ent, entityId:id, result:result}); }
    if(act==="cty-reg-add"){
      var nfr=prompt(T("Nom de la région (FR) :")), nar=prompt(T("Nom (AR) :")), nen=prompt(T("Nom (EN) :")), code=prompt(T("Code :"))||"";
      if(nfr&&nfr.trim()){ regs.push({id:"REG-"+Date.now(), code:code, name:{fr:nfr.trim(),ar:nar||"",en:nen||nfr.trim()}, order:regs.length+1, active:true, cities:[]}); audit("REGION_CREATED","Region",regs[regs.length-1].id,"Created"); done(T("Région ajoutée.")); }
      return;
    }
    if(!r) return;
    if(act==="reg-addcity"){
      var nfr2=prompt(T("Nom de la ville (FR) :")), nar2=prompt(T("Nom (AR) :")), nen2=prompt(T("Nom (EN) :"));
      if(nfr2&&nfr2.trim()){ r.cities.push({id:"CTY-"+Date.now(), name:{fr:nfr2.trim(),ar:nar2||"",en:nen2||nfr2.trim()}, order:r.cities.length+1, active:true, neighborhoods:[]}); audit("CITY_CREATED","City",r.cities[r.cities.length-1].id,"Created"); done(T("Ville ajoutée.")); }
      return;
    }
    if(act==="reg-edit"){
      var efr=prompt(T("Nom (FR) :"), r.name.fr), ear=prompt(T("Nom (AR) :"), r.name.ar), een=prompt(T("Nom (EN) :"), r.name.en), ec=prompt(T("Code :"), r.code||"");
      if(efr!==null){ r.name.fr=efr||r.name.fr; if(ear!==null)r.name.ar=ear; if(een!==null)r.name.en=een; if(ec!==null)r.code=ec; audit("REGION_CHANGED","Region",r.id,"Updated"); done(T("Région modifiée.")); }
      return;
    }
    if(act==="reg-dup"){
      var copy=cloneObj(r); copy.id="REG-"+Date.now(); copy.order=Math.max.apply(null, regs.map(function(x){return x.order;}))+1; copy.name={fr:r.name.fr+" (copie)", ar:r.name.ar, en:r.name.en};
      copy.cities=(r.cities||[]).map(function(c){ var c2=cloneObj(c); c2.id="CTY-"+Date.now()+"-"+Math.floor(Math.random()*999); return c2; });
      regs.push(copy); audit("REGION_DUPLICATED","Region",copy.id,"Duplicated"); done(T("Région dupliquée."));
      return;
    }
    if(act==="reg-tog"){ r.active=r.active!==false?false:true; audit(r.active?"REGION_ACTIVATED":"REGION_DEACTIVATED","Region",r.id,r.active?"Active":"Inactive"); done(T("Statut mis à jour.")); return; }
    if(act==="reg-up"||act==="reg-dn"){ var dir=act==="reg-up"?-1:1; var j=cIndex()+dir; if(j<0||j>=regs.length){ UI.toast(T("Déjà en limite.")); return; } var t=regs[cIndex()]; regs[cIndex()]=regs[j]; regs[j]=t; reindexReg(); done(); return; }
    if(act==="reg-del"){
      if(DATA.isRegionUsed(r.id)){ UI.toast(T("Impossible : région utilisée."), true); return; }
      UI.confirmAction({title:T("Supprimer cette région ?"), message:T("Région et ses villes seront retirées."), confirmLabel:T("Supprimer"), onConfirm:function(){ regs.splice(regs.indexOf(r),1); reindexReg(); audit("REGION_DELETED","Region",r.id,"Deleted"); done(T("Région supprimée.")); }});
      return;
    }
    var c = r.cities.find(function(x){ return x.id===cityId; });
    if(!c) return;
    if(act==="cty-addhood"){
      var hn=prompt(T("Nom du quartier :"));
      if(hn&&hn.trim()){ c.neighborhoods.push(hn.trim()); audit("CITY_CHANGED","City",c.id,"Neighborhood added"); done(T("Quartier ajouté.")); }
      return;
    }
    if(act==="cty-edit"){
      var cfr=prompt(T("Nom (FR) :"), c.name.fr), car=prompt(T("Nom (AR) :"), c.name.ar), cen=prompt(T("Nom (EN) :"), c.name.en);
      if(cfr!==null){ c.name.fr=cfr||c.name.fr; if(car!==null)c.name.ar=car; if(cen!==null)c.name.en=cen; audit("CITY_CHANGED","City",c.id,"Updated"); done(T("Ville modifiée.")); }
      return;
    }
    if(act==="cty-dup"){
      var c2=cloneObj(c); c2.id="CTY-"+Date.now(); c2.order=Math.max.apply(null, r.cities.map(function(x){return x.order;}))+1; c2.name={fr:c.name.fr+" (copie)", ar:c.name.ar, en:c.name.en}; r.cities.push(c2); audit("CITY_DUPLICATED","City",c2.id,"Duplicated"); done(T("Ville dupliquée."));
      return;
    }
    if(act==="cty-tog"){ c.active=c.active!==false?false:true; audit(c.active?"CITY_ACTIVATED":"CITY_DEACTIVATED","City",c.id,c.active?"Active":"Inactive"); done(T("Statut mis à jour.")); return; }
    if(act==="cty-up"||act==="cty-dn"){ var cj=r.cities.indexOf(c)+(act==="cty-up"?-1:1); if(cj<0||cj>=r.cities.length){ UI.toast(T("Déjà en limite.")); return; } var ct=r.cities[r.cities.indexOf(c)]; r.cities[r.cities.indexOf(c)]=r.cities[cj]; r.cities[cj]=ct; reindexCity(); done(); return; }
    if(act==="cty-del"){
      if(DATA.isCityUsed(c.id)){ UI.toast(T("Impossible : ville utilisée par un utilisateur ou professionnel."), true); return; }
      UI.confirmAction({title:T("Supprimer cette ville ?"), confirmLabel:T("Supprimer"), onConfirm:function(){ r.cities.splice(r.cities.indexOf(c),1); reindexCity(); audit("CITY_DELETED","City",c.id,"Deleted"); done(T("Ville supprimée.")); }});
      return;
    }
  }

  /* ============================================================
     REVIEWS
     ============================================================ */
  function renderReviews(initialFilter){
    UI.setTitle(T("Avis"));
    var labels = { all:T("Tous"), published:T("Publié"), pending:T("En attente"), flagged:T("Signalé"), hidden:T("Masqué") };
    var valid = { all:1, published:1, pending:1, flagged:1, hidden:1 };
    var filter = (initialFilter && valid[initialFilter]) ? initialFilter : "all";
    var order = ["all","published","pending","flagged","hidden"];
    var html =
      '<div class="page-head"><h1>'+T("Avis")+'</h1><div class="spacer">'+(AUTH.can("reviews","read")?'<button class="btn btn-ghost" id="revExport">⬇ '+T("Exporter")+'</button>':"")+'</div></div>'+
      '<div class="tabs">'+order.map(function(s,i){
        var list = DATA.getReviews(); var n = list.length; if(s!=="all") n = list.filter(function(r){return r.status===s;}).length;
        return '<button class="tab '+(s===filter?"active":"")+'" data-s="'+s+'">'+labels[s]+' <span class="cnt">'+n+'</span></button>';
      }).join("")+'</div><div id="revBody"></div>';
    UI.setContent(html);
    drawReviews(filter);
  }
  function drawReviews(filter){
    document.querySelectorAll("#content .tab").forEach(function(t){
      t.classList.toggle("active", t.dataset.s===filter);
      t.onclick=function(){ drawReviews(t.dataset.s); };
    });
    var list = DATA.getReviews({ status: filter==="all"?"":filter });
    var el = document.getElementById("revBody");
    if(!list.length){ el.innerHTML='<div class="empty">'+T("Aucun avis.")+'</div>'; return; }
    var rexp = document.getElementById("revExport"); if(rexp && !rexp._bound){ rexp._bound=true; rexp.addEventListener("click", function(){
      var rows=[[T("Client"),T("Professionnel"),T("Note"),T("Commentaire"),T("Date"),T("Statut"),"ID"]];
      DATA.getReviews({ status: currentReviewFilter()==="all"?"":currentReviewFilter() }).forEach(function(r){ var p=DATA.getProfessional(r.professionalId); rows.push([r.customer,p?p.name:"?",r.rating,r.comment,r.date,r.status,r.id]); });
      UI.exportCSV("avis-sna3ti.csv", rows); UI.toast(T("Export généré."));
    }); }
    el.innerHTML =
      '<div class="card"><div class="table-wrap"><table><thead><tr><th>'+T("Client")+'</th><th>'+T("Professionnel")+'</th><th>'+T("Note")+'</th><th>'+T("Commentaire")+'</th><th>'+T("Date")+'</th><th>'+T("Statut")+'</th><th>'+T("Actions")+'</th></tr></thead><tbody>' +
      list.map(function(r){
        var p = DATA.getProfessional(r.professionalId);
        var flagInfo = r.status==="flagged" ? '<div class="muted" style="margin-top:4px;color:var(--red)">🚩 '+esc(r.flaggedReason||T("Signalé"))+'<br><span style="font-size:11px">'+T("Signalé par")+' '+esc(r.flaggedReporter||"—")+' · '+esc(r.flaggedDate||"")+'</span></div>' : "";
        return '<tr><td><b>'+esc(r.customer)+'</b></td><td>'+esc(p?p.name:"—")+'</td><td>'+mkStars(r.rating)+'</td><td style="max-width:240px">'+esc(r.comment)+flagInfo+'</td><td>'+r.date+'</td><td>'+revStatus(r.status)+'</td>'+
          '<td class="actions-cell">'+
            (AUTH.can("reviews","moderate") && r.status!=="published" ? '<button class="icon-act" data-pub="'+r.id+'" title="'+T("Publier")+'" style="color:var(--green)">✓</button>':"") +
            (AUTH.can("reviews","moderate") && (r.status==="hidden") ? '<button class="icon-act" data-rst="'+r.id+'" title="'+T("Restaurer")+'" style="color:var(--teal)">♻️</button>':"") +
            (AUTH.can("reviews","moderate") && r.status!=="flagged" ? '<button class="icon-act" data-flag="'+r.id+'" title="'+T("Signaler/suspect")+'" style="color:var(--amber)">🚩</button>':"") +
            (AUTH.can("reviews","moderate") ? '<button class="icon-act" data-hide="'+r.id+'" title="'+T("Masquer")+'" style="color:var(--muted)">🙈</button>':"") +
            (AUTH.can("reviews","delete") ? '<button class="icon-act danger" data-delrev="'+r.id+'" title="'+T("Supprimer")+'">🗑️</button>':"") +
          '</td></tr>';
      }).join("") + '</tbody></table></div></div>';
    document.querySelectorAll("[data-pub]").forEach(function(b){ b.addEventListener("click", function(){ setRev(b.dataset.pub, "published"); }); });
    document.querySelectorAll("[data-flag]").forEach(function(b){ b.addEventListener("click", function(){ flagRev(b.dataset.flag); }); });
    document.querySelectorAll("[data-hide]").forEach(function(b){ b.addEventListener("click", function(){ setRev(b.dataset.hide, "hidden"); }); });
    document.querySelectorAll("[data-rst]").forEach(function(b){ b.addEventListener("click", function(){ setRev(b.dataset.rst, "published"); }); });
    document.querySelectorAll("[data-delrev]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.delrev;
      UI.confirmAction({title:T("Supprimer cet avis ?"), confirmLabel:T("Supprimer"), onConfirm:function(){
        DATA._store.reviews=DATA._store.reviews.filter(function(r){return r.id!==id;}); DATA.logAudit({admin:AUTH.getSession().name, action:"REVIEW_DELETED", entity:"Review", entityId:id, result:"Deleted"}); UI.toast(T("Avis supprimé.")); drawReviews(currentReviewFilter());
      }});
    }); });
  }
  function currentReviewFilter(){ var a=document.querySelector(".tab.active"); return a?a.dataset.s:"all"; }
  function setRev(id, status){ var r=DATA._store.reviews.find(function(x){return x.id===id;}); if(r){ r.status=status; DATA.logAudit({admin:AUTH.getSession().name, action:"REVIEW_"+status.toUpperCase(), entity:"Review", entityId:id, result:status}); UI.toast(T("Avis ")+status+"."); drawReviews(currentReviewFilter()); } }
  function flagRev(id){
    UI.confirmAction({ title:T("Signaler cet avis ?"), reasonRequired:true, reasonLabel:T("Raison du signalement"), confirmLabel:T("Signaler"), onConfirm:function(reason){
      var r=DATA._store.reviews.find(function(x){return x.id===id;}); if(r){ r.status="flagged"; r.flaggedReason=reason; r.flaggedReporter=AUTH.getSession().name; r.flaggedDate=todayShort(); }
      DATA.logAudit({admin:AUTH.getSession().name, action:"REVIEW_FLAGGED", entity:"Review", entityId:id, result:"Flagged", note:reason});
      UI.toast(T("Avis signalé.")); drawReviews(currentReviewFilter());
    }});
  }
  function revStatus(s){ var m={published:["green",T("Publié")],pending:["amber",T("En attente")],flagged:["red",T("Signalé")],hidden:["gray",T("Masqué")],deleted:["gray",T("Supprimé")]}; var e=m[s]||["gray",s]; return '<span class="badge '+e[0]+'">'+e[1]+'</span>'; }

  /* ============================================================
     REPORTS
     ============================================================ */
  function renderReports(initialFilter){
    UI.setTitle(T("Centre de modération"));
    var labels = { all:T("Toutes"), new:T("Nouvelles"), under_review:T("En cours"), resolved:T("Résolues"), rejected:T("Rejetées") };
    var valid = { all:1, new:1, under_review:1, resolved:1, rejected:1 };
    var filter = (initialFilter && valid[initialFilter]) ? initialFilter : "all";
    var order = ["all","new","under_review","resolved","rejected"];
    var html =
      '<div class="page-head"><h1>'+T("Centre de modération")+'</h1><div class="spacer">'+(AUTH.can("reports","read")?'<button class="btn btn-ghost" id="repExport">⬇ '+T("Exporter")+'</button>':"")+'</div></div>'+
      '<div class="tabs">'+order.map(function(s,i){
        var list=DATA.getReports(); var n=list.length; if(s!=="all") n=list.filter(function(r){return r.status===s;}).length;
        return '<button class="tab '+(s===filter?"active":"")+'" data-s="'+s+'">'+labels[s]+' <span class="cnt">'+n+'</span></button>';
      }).join("")+'</div><div id="repBody"></div>';
    UI.setContent(html);
    drawReports(filter);
  }
  function reportReasons(){ return [T("Faux professionnel"),T("Fraude"),T("Faux avis"),T("Spam"),T("Contenu inapproprié"),T("Mauvaise information"),T("Harcèlement"),T("Réclamation client")]; }
  var reportTypeLabels = { false_professional:T("Faux professionnel"), price_misleading:T("Prix trompeur"), false_review:T("Faux avis"), scam:T("Fraude"), spam:T("Spam"), content:T("Contenu inapproprié"), misinformation:T("Mauvaise information"), harassment:T("Harcèlement"), complaint:T("Réclamation client") };
  function reportTypeLabel(t){ return reportTypeLabels[t] || t || "—"; }
  var reportPrioClass = { critical:"red", high:"amber", medium:"blue", low:"gray" };
  var reportPrioLabel = { critical:T("Critique"), high:T("Haute"), medium:T("Moyenne"), low:T("Basse") };
  function reportStatusBadge(s){
    var m = { new:["red",T("Nouvelle")], under_review:["amber",T("En cours")], resolved:["green",T("Résolue")], rejected:["gray",T("Rejetée")] };
    var e = m[s] || ["gray", s];
    return '<span class="badge '+e[0]+'">'+e[1]+'</span>';
  }
  function drawReports(filter){
    document.querySelectorAll("#content .tab").forEach(function(t){
      t.classList.toggle("active", t.dataset.s===filter);
      t.onclick=function(){ drawReports(t.dataset.s); };
    });
    var list = DATA.getReports({ status: filter==="all"?"":filter });
    var el = document.getElementById("repBody");
    var rexpt = document.getElementById("repExport"); if(rexpt && !rexpt._bound){ rexpt._bound=true; rexpt.addEventListener("click", function(){
      var rows=[[T("ID"),T("Professionnel"),T("Type"),T("Priorité"),T("Statut"),T("Signalé par"),T("Date"),T("Description")]];
      DATA.getReports({ status: currentReportFilter()==="all"?"":currentReportFilter() }).forEach(function(r){ var p=DATA.getProfessional(r.professionalId); rows.push([r.id,p?p.name:"?",reportTypeLabel(r.type),r.priority,r.status,r.reporter,r.date,r.description]); });
      UI.exportCSV("signalements-sna3ti.csv", rows); UI.toast(T("Export généré."));
    }); }
    if(!list.length){ el.innerHTML='<div class="empty">'+T("Aucun signalement.")+'</div>'; return; }
    el.innerHTML = list.map(function(r){
      var p = DATA.getProfessional(r.professionalId);
      var meta =
        '<div class="muted" style="margin:8px 0;font-size:12px;line-height:1.8">'+
          '<b style="font-size:13px">#'+esc(r.id)+'</b>'+
          ' &nbsp;·&nbsp; '+T("Type")+': '+esc(reportTypeLabel(r.type))+
          ' &nbsp;·&nbsp; '+T("Priorité")+': <span class="badge '+reportPrioClass[r.priority]+'">'+esc(reportPrioLabel[r.priority]||r.priority)+'</span>'+
          ' &nbsp;·&nbsp; '+T("Créé")+': '+esc(r.created||r.date)+
          (r.assignedTo ? ' &nbsp;·&nbsp; '+T("Assigné à")+': '+esc(DATA.adminName(r.assignedTo)) : '')+
          '<br>'+esc(r.description)+'<br>'+T("Signalé par")+' '+esc(r.reporter)+' '+T("le")+' '+r.date+
        '</div>';
      return '<div class="req"><div class="req-top"><div class="grow"><div class="pro"><div class="p-avatar">'+initials(p?p.name:"?")+'</div>'+
        '<div><div class="pro-name">'+esc(p?p.name:"?")+'</div><div class="pro-job">'+esc(r.reason)+'</div></div></div></div>'+
        reportStatusBadge(r.status)+'</div>'+
        meta+
        '<div class="req-actions">'+
          '<button class="btn btn-ghost btn-small" data-viewpro="'+r.professionalId+'">👤 '+T("Voir")+'</button>'+
          (r.status==="new" && AUTH.can("reports","resolve") ?
            '<button class="btn btn-soft btn-small" data-openrep="'+r.id+'" title="'+T("Ouvrir / prendre en charge")+'">⏳ '+T("Ouvrir")+'</button>' : "")+
          (AUTH.can("reports","resolve")?
            '<button class="btn btn-ghost btn-small" data-assignrep="'+r.id+'" title="'+T("Assigner à un modérateur")+'">👥 '+T("Assigner")+(r.assignedTo?(" · "+esc(DATA.adminName(r.assignedTo))):"")+'</button>' : "")+
          (r.status!=="resolved" && r.status!=="rejected"?
            '<button class="btn btn-primary btn-small" data-resolve="'+r.id+'" '+(AUTH.can("reports","resolve")?"":"disabled")+'>✓ '+T("Résoudre")+'</button>'+
            '<button class="btn btn-danger btn-small" data-warn="'+r.id+'" '+(AUTH.can("reports","warn")?"":"disabled")+'>⚠️ '+T("Avertir")+'</button>'+
            '<button class="btn btn-warn btn-small" data-susprof="'+r.id+'" '+(AUTH.can("reports","suspend")?"":"disabled")+'>⏸️ '+T("Suspendre")+'</button>'+
            '<button class="btn btn-ghost btn-small" data-rejectrep="'+r.id+'" '+(AUTH.can("reports","resolve")?"":"disabled")+'>'+T("Rejeter")+'</button>': '<span class="badge green">'+T("Traité")+'</span>')+
        '</div></div>';
    }).join("");
    document.querySelectorAll("[data-viewpro]").forEach(function(b){ b.addEventListener("click", function(){ ROUTER.navigate("professionals/"+b.dataset.viewpro); }); });
    document.querySelectorAll("[data-openrep]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.openrep;
      DATA.openReport(id, AUTH.getSession().name);
      DATA.logAudit({admin:AUTH.getSession().name, action:"REPORT_OPENED", entity:"Report", entityId:id, result:"Under review"});
      UI.toast(T("Signalement ouvert (en cours de traitement).")); drawReports(currentReportFilter());
    }); });
    document.querySelectorAll("[data-resolve]").forEach(function(b){ b.addEventListener("click", function(){ setReport(b.dataset.resolve, "resolved"); }); });
    document.querySelectorAll("[data-rejectrep]").forEach(function(b){ b.addEventListener("click", function(){ setReport(b.dataset.rejectrep, "rejected"); }); });
    document.querySelectorAll("[data-warn]").forEach(function(b){ b.addEventListener("click", function(){
      UI.confirmAction({title:T("Avertir le professionnel ?"), reasonRequired:true, reasonLabel:T("Motif de l'avertissement"), confirmLabel:T("Avertir"), onConfirm:function(reason){
        var r=DATA._store.reports.find(function(x){return x.id===b.dataset.warn;});
        if(r){ r.status="under_review"; r.warnReason=reason; DATA.persist(); DATA.logAudit({admin:AUTH.getSession().name, action:"REPORT_WARNED", entity:"Professional", entityId:r.professionalId, result:"Warned", note:reason}); }
        UI.toast(T("Avertissement enregistré.")); drawReports(currentReportFilter());
      }});
    }); });
    document.querySelectorAll("[data-susprof]").forEach(function(b){ b.addEventListener("click", function(){
      UI.confirmAction({title:T("Suspendre le professionnel ?"), reasonRequired:true, reasonLabel:T("Raison"), confirmLabel:T("Suspendre"), onConfirm:function(reason){
        var r=DATA._store.reports.find(function(x){return x.id===b.dataset.susprof;}); if(r){ DATA.updateProfessional(r.professionalId,{status:"suspended"}); r.status="resolved"; DATA.logAudit({admin:AUTH.getSession().name, action:"SUSPEND_PROFESSIONAL", entity:"Professional", entityId:r.professionalId, result:"Suspended", note:reason}); } UI.toast(T("Professionnel suspendu.")); drawReports(currentReportFilter());
      }});
    }); });
    document.querySelectorAll("[data-assignrep]").forEach(function(b){ b.addEventListener("click", function(){
      assignReport(b.dataset.assignrep);
    }); });
  }
  function assignReport(id){
    var admins = DATA.getAdminUsers();
    var r = DATA._store.reports.find(function(x){return x.id===id;});
    UI.openModal(
      '<h3>'+T("Assigner le signalement ")+esc(id)+'</h3>'+
      '<p class="muted" style="font-size:13px">'+T("Choisir un modérateur pour traiter ce signalement.")+'</p>'+
      '<div class="assign-list" style="margin:14px 0">'+
      admins.filter(function(a){return a.status==="active";}).map(function(a){
        return '<div class="assign-row" data-aid="'+a.id+'" style="cursor:pointer;padding:10px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">'+
          '<div><b>'+esc(a.name)+'</b><div class="muted" style="font-size:12px">'+esc(a.role)+'</div></div>'+
          (r&&r.assignedTo===a.id?'<span class="badge green">'+T("Assigné")+'</span>':'<span class="badge gray">'+T("Assigner")+'</span>')+
        '</div>';
      }).join("")+
      '</div>'+
      '<div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">'+T("Annuler")+'</button></div>'
    , true);
    document.querySelectorAll(".assign-row").forEach(function(row){
      row.addEventListener("click", function(){
        var aid=row.dataset.aid;
        DATA.assignTask("report", id, aid);
        DATA.logAudit({admin:AUTH.getSession().name, action:"REPORT_ASSIGNED", entity:"Report", entityId:id, result:"Assigned", note:DATA.adminName(aid)});
        UI.toast(T("Signalement assigné.")); UI.closeModal(); drawReports(currentReportFilter());
      });
    });
  }
  function currentReportFilter(){ var a=document.querySelector(".tab.active"); return a?a.dataset.s:"all"; }
  function setReport(id, status){ var r=DATA._store.reports.find(function(x){return x.id===id;}); if(r){ r.status=status; DATA.logAudit({admin:AUTH.getSession().name, action:"REPORT_"+status.toUpperCase(), entity:"Report", entityId:id, result:status}); UI.toast(T("Signalement ")+status+"."); drawReports(currentReportFilter()); } }

  /* ============================================================
     SUPPORT TICKETS
     ============================================================ */
  var supportLabels = { all:T("Toutes"), open:T("Ouvertes"), pending:T("En attente"), resolved:T("Résolues") };
  var supportValid = { all:1, open:1, pending:1, resolved:1 };
  var supportPrioOrder = { critical:0, high:1, medium:2, low:3 };
  function supportPrioClass(p){ return { critical:"red", high:"amber", medium:"blue", low:"gray" }[p] || "gray"; }
  function supportPrioLabel(p){ return { critical:T("Critique"), high:T("Haute"), medium:T("Moyenne"), low:T("Basse") }[p] || p; }
  function supportStatusBadge(s){
    var m = { open:["blue",T("Ouverte")], pending:["amber",T("En attente")], resolved:["green",T("Résolue")], closed:["gray",T("Fermée")] };
    var x = m[s] || ["gray", s];
    return '<span class="badge '+x[0]+'">'+x[1]+'</span>';
  }
  function renderSupport(initialFilter){
    UI.setTitle(T("Support"));
    var filter = (initialFilter && supportValid[initialFilter]) ? initialFilter : "all";
    var all = DATA.getSupportTickets();
    var html =
      '<div class="page-head"><h1>'+T("Demandes de support")+'</h1><div class="spacer muted">'+T("Tickets des professionnels et utilisateurs.")+'</div></div>' +
      '<div class="tabs">'+["all","open","pending","resolved"].map(function(s){
        var n = s==="all" ? all.length : all.filter(function(t){return t.status===s;}).length;
        return '<button class="tab '+(s===filter?"active":"")+'" data-ts="'+s+'">'+supportLabels[s]+' <span class="cnt">'+n+'</span></button>';
      }).join("")+'</div><div id="supBody"></div>';
    UI.setContent(html);
    drawSupport(filter);
  }
  function drawSupport(filter){
    document.querySelectorAll("#content .tab").forEach(function(t){
      t.classList.toggle("active", t.dataset.ts===filter);
      t.onclick=function(){ drawSupport(t.dataset.ts); };
    });
    var list = DATA.getSupportTickets({ status: filter==="all"?"":filter });
    list.sort(function(a,b){ return (supportPrioOrder[a.priority]||9)-(supportPrioOrder[b.priority]||9) || String(a.created).localeCompare(String(b.created)); });
    var el = document.getElementById("supBody");
    if(!el) return;
    if(!list.length){ el.innerHTML='<div class="empty">'+T("Aucun ticket.")+'</div>'; return; }
    el.innerHTML = list.map(function(t){
      var p = DATA.getProfessional(t.professionalId);
      return '<div class="card" style="margin-bottom:10px"><div class="row-item" style="align-items:flex-start">'+
        '<div class="p-avatar">🧰</div>'+
        '<div class="grow"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
          '<b>'+esc(t.subject)+'</b>'+
          '<span class="badge '+supportPrioClass(t.priority)+'">'+esc(supportPrioLabel(t.priority))+'</span>'+
          supportStatusBadge(t.status)+
        '</div>'+
        '<div class="muted" style="font-size:12.5px;margin:4px 0">'+esc(t.user||"")+(p?' · '+esc(p.name):"")+' · '+esc(t.cat||"")+' · créé le '+esc(t.created)+'</div>'+
        '<div style="font-size:13px">'+esc(t.message)+'</div>'+
        (t.history&&t.history.length?'<div class="muted" style="font-size:12px;margin-top:6px">🕒 '+t.history.map(function(h){return esc(h.text);}).join(" · ")+'</div>':"")+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
          '<span class="badge gray">'+T("Assigné")+': '+esc(DATA.adminName(t.assignedTo))+'</span>'+
          (AUTH.can("support","update") ? '<button class="btn btn-primary btn-small" data-closet="'+t.id+'" '+(t.status==="resolved"||t.status==="closed"?"disabled":"")+'>✓ '+T("Marquer résolu")+'</button>' : "")+
          (AUTH.can("support","update") ? '<button class="btn btn-ghost btn-small" data-replt="'+t.id+'">✎ '+T("Répondre")+'</button>' : "")+
          (AUTH.can("support","assign") ? '<button class="btn btn-ghost btn-small" data-assignt="'+t.id+'">👤 '+T("Assigner")+'</button>' : "")+
        '</div></div></div>';
    }).join("");
    document.querySelectorAll("[data-closet]").forEach(function(b){ b.addEventListener("click", function(){
      if(DATA.updateSupportTicket(b.dataset.closet,{ status:"resolved" })){
        DATA.logAudit({admin:AUTH.getSession().name, action:"SUPPORT_RESOLVED", entity:"SupportTicket", entityId:b.dataset.closet, result:"Resolved"});
        UI.toast(T("Ticket résolu.")); drawSupport(currentSupportFilter());
      }
    }); });
    document.querySelectorAll("[data-replt]").forEach(function(b){ b.addEventListener("click", function(){
      var t=DATA._store.supportTickets.find(function(x){return x.id===b.dataset.replt;});
      UI.confirmAction({title:T("Répondre au ticket"), reasonLabel:T("Réponse"), confirmLabel:T("Envoyer"), onConfirm:function(reason){
        if(t){ t.history.push({ date: new Date().toISOString().slice(0,10), text:T("Réponse de ")+AUTH.getSession().name+": "+reason }); t.status="pending"; DATA.persist(); }
        DATA.logAudit({admin:AUTH.getSession().name, action:"SUPPORT_REPLIED", entity:"SupportTicket", entityId:b.dataset.replt, result:"Replied"});
        UI.toast(T("Réponse envoyée.")); drawSupport(currentSupportFilter());
      }});
    }); });
    document.querySelectorAll("[data-assignt]").forEach(function(b){ b.addEventListener("click", function(){ assignSupport(b.dataset.assignt); }); });
  }
  function currentSupportFilter(){ var a=document.querySelector(".tab.active"); return a?a.dataset.ts:"all"; }
  function assignSupport(id){
    var admins = DATA.getAdminUsers().filter(function(a){ return a.status==="active"; });
    UI.openModal(
      '<h3>'+T("Assigner le ticket ")+esc(id)+'</h3>'+
      '<div class="assign-list" style="margin:14px 0">'+
      admins.map(function(a){
        return '<div class="assign-row" data-aid="'+a.id+'" style="cursor:pointer;padding:10px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">'+
          '<div><b>'+esc(a.name)+'</b><div class="muted" style="font-size:12px">'+esc(a.role)+'</div></div>'+
          '<span class="badge gray">'+T("Assigner")+'</span></div>';
      }).join("")+
      '</div><div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">'+T("Annuler")+'</button></div>'
    , true);
    document.querySelectorAll(".assign-row").forEach(function(row){
      row.addEventListener("click", function(){
        var aid=row.dataset.aid;
        DATA.assignSupportTask(id, aid);
        DATA.logAudit({admin:AUTH.getSession().name, action:"SUPPORT_ASSIGNED", entity:"SupportTicket", entityId:id, result:"Assigned", note:DATA.adminName(aid)});
        UI.toast(T("Ticket assigné.")); UI.closeModal(); drawSupport(currentSupportFilter());
      });
    });
  }

  /* ============================================================
     SUBSCRIPTIONS / PLANS
     ============================================================ */
  function renderSubscriptions(){
    UI.setTitle(T("Abonnements"));
    var plans = DATA.getSubscriptionPlans();
    var subs = DATA.getSubscriptions();
    var isFree = function(s){ return String(s.planId||"").toUpperCase()==="PLAN-FREE" || /GRATUIT/i.test(s.planName||"") || (s.price||0)===0; };
    var statActive = subs.filter(function(s){ return s.status==="active"; }).length;
    var statExpired = subs.filter(function(s){ return s.status==="expired"; }).length;
    var statCancelled = subs.filter(function(s){ return s.status==="cancelled"; }).length;
    var statMRR = subs.filter(function(s){ return s.status==="active" && !isFree(s); }).reduce(function(a,s){ return a+(s.price||0); },0);
    var spacer = AUTH.can("subscriptions","read")
      ? '<button class="btn btn-ghost" id="subExport">⬇ '+T("Exporter")+'</button>'
      : '<span class="muted">'+T("Vérification ≠ abonnement.")+'</span>';
    var html = '<div class="page-head"><h1>'+T("Abonnements")+'</h1><div class="spacer">'+spacer+'</div></div>' +
      '<div class="grid grid-4" style="margin-bottom:20px">'+
        '<div class="kpi"><div class="k-top"><span class="k-title">'+T("Abonnés actifs")+'</span><span class="k-ico">👥</span></div><div class="k-val">'+statActive+'</div><div class="k-delta"><span class="cmp">'+T("abonnements en cours")+'</span></div></div>'+
        '<div class="kpi"><div class="k-top"><span class="k-title">'+T("Abonnements expirés")+'</span><span class="k-ico">⏰</span></div><div class="k-val">'+statExpired+'</div><div class="k-delta"><span class="cmp">'+T("non renouvelés")+'</span></div></div>'+
        '<div class="kpi"><div class="k-top"><span class="k-title">'+T("Abonnements annulés")+'</span><span class="k-ico">🚫</span></div><div class="k-val">'+statCancelled+'</div><div class="k-delta"><span class="cmp">'+T("annulations")+'</span></div></div>'+
        '<div class="kpi"><div class="k-top"><span class="k-title">'+T("Revenu mensuel récurrent (MRR)")+'</span><span class="k-ico">💰</span></div><div class="k-val">'+statMRR+' <span class="muted small">DH</span></div><div class="k-delta"><span class="cmp">'+T("plans payants actifs")+'</span></div></div>'+
      '</div>' +
      '<div class="grid-3">'+ plans.map(function(pl){
        var count = subs.filter(function(s){ return s.planName===pl.name && s.status==="active"; }).length;
        return '<div class="plan-card '+(pl.hot?"hot":"")+'"><div class="p-name" style="color:'+(pl.badge==="orange"?"var(--orange)":pl.badge==="teal"?"var(--teal)":"var(--muted)")+'">'+esc(pl.name)+'</div>'+
          '<div class="p-price">'+pl.price+' <span class="muted small">DH / '+esc(pl.period)+'</span></div>'+
          '<div class="muted" style="margin:4px 0 10px">'+esc(pl.description)+'</div>'+
          '<span class="badge '+(pl.active?"green":"gray")+'">'+(pl.active?T("Actif"):T("Inactif"))+'</span> <span class="muted small">· '+count+' '+T("abonné(s)")+'</span>'+
          (AUTH.can("subscriptions","update")?'<div class="modal-actions" style="margin-top:14px;justify-content:flex-start"><button class="btn btn-ghost btn-small" data-subsedit="'+pl.id+'">✏️ '+T("Modifier")+'</button><button class="btn btn-ghost btn-small" data-subsview="'+pl.id+'">'+T("Abonnés")+'</button><button class="btn btn-ghost btn-small" data-substoggle="'+pl.id+'">'+(pl.active?"⏸️ "+T("Désactiver"):"▶️ "+T("Activer"))+'</button></div>':"")+
          '</div>';
      }).join("") + '</div>' +
      '<div class="card"><div class="card-head"><div class="card-title">'+T("Comparatif des offres")+'</div><span class="muted small">* '+T("Le badge Professionnel Vérifié dépend d'une vérification distincte (indépendante de l'abonnement).")+'</span></div>'+
        '<div class="table-wrap"><table class="matrix"><thead><tr><th>'+T("Avantage")+'</th>'+ plans.map(function(pl){ return '<th>'+esc(pl.name)+'</th>'; }).join("") +'</tr></thead><tbody>'+
        '<tr><td><b>'+T("Prix")+'</b></td>'+ plans.map(function(pl){ return '<td><b>'+pl.price+' DH</b></td>'; }).join("") +'</tr>'+
        benefitRow(T("Profil de base"),             [1,1,1]) +
        benefitRow(T("Visibilité dans les recherches"), [1,1,1]) +
        benefitRow(T("Avis"),                       [1,1,1]) +
        benefitRow(T("Badge Professionnel Vérifié"),["no","req","req"]) +
        benefitRow(T("Statistiques avancées"),      [0,1,1]) +
        benefitRow(T("Visibilité prioritaire"),     [0,1,1]) +
        benefitRow(T("Placement premium"),          [0,0,1]) +
        benefitRow(T("Profil mis en avant"),        [0,0,1]) +
        benefitRow(T("Assistant IA de profil"),     [0,0,1]) +
        benefitRow(T("Support VIP"),                [0,0,1]) +
        '</tbody></table></div></div>' +
      '<div class="card"><div class="card-title">'+T("Abonnés")+'</div><div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>'+T("Professionnel")+'</th><th>'+T("Plan")+'</th><th>'+T("Prix")+'</th><th>'+T("Début")+'</th><th>'+T("Renouvellement")+'</th><th>'+T("Statut")+'</th><th>'+T("Paiement")+'</th><th>'+T("Actions")+'</th></tr></thead><tbody>'+
      subs.map(function(s){
        var p=DATA.getProfessional(s.professionalId);
        var pkg = s.planName.toLowerCase()==="gold"?"gold":s.planName.toLowerCase()==="vérifié"||s.planName.toLowerCase()==="verifié"?"verified":"free";
        var isFree = String(s.planId||"").toUpperCase()==="PLAN-FREE" || /GRATUIT/i.test(s.planName||"");
        var action = isFree ? '<span class="muted small">—</span>' :
          (AUTH.can("subscriptions","update") ? '<button class="btn btn-ghost btn-small" data-subtofree="'+s.professionalId+'">'+T("Passer à GRATUIT")+'</button>' : '<span class="muted small">—</span>');
        return '<tr><td><div class="pro"><div class="p-avatar">'+initials(p?p.name:"?")+'</div><div class="pro-name">'+esc(p?p.name:"?")+'</div></div></td>'+
          '<td>'+pkgBadge({package:pkg})+'</td><td>'+s.price+' DH</td><td>'+s.since+'</td><td>'+s.renewal+'</td>'+
          '<td>'+statusBadge(s.status)+'</td><td>'+payStatusBadge(s.paymentStatus)+'</td><td>'+action+'</td></tr>';
      }).join("") + '</tbody></table></div></div>';
    UI.setContent(html);
    document.querySelectorAll("[data-subsedit]").forEach(function(b){ b.addEventListener("click", function(){ editPlan(b.dataset.subsedit); }); });
    document.querySelectorAll("[data-subsview]").forEach(function(b){ b.addEventListener("click", function(){ viewPlanSubs(b.dataset.subsview); }); });
    document.querySelectorAll("[data-substoggle]").forEach(function(b){ b.addEventListener("click", function(){
      var pl = DATA.getSubscriptionPlans().find(function(x){ return x.id===b.dataset.substoggle; });
      var toActive = !pl.active;
      DATA.setPlanActive(pl.id, toActive);
      DATA.logAudit({admin:AUTH.getSession().name, action: toActive?"SUBSCRIPTION_PLAN_ACTIVATED":"SUBSCRIPTION_PLAN_DEACTIVATED", entity:"SubscriptionPlan", entityId:pl.id, result: toActive?"Active":"Inactive"});
      UI.toast(T("Plan ")+(toActive?T("activé"):T("désactivé"))+"."); renderSubscriptions();
    }); });
    document.querySelectorAll("[data-subtofree]").forEach(function(b){ b.addEventListener("click", function(){
      var proId=b.dataset.subtofree;
      var p=DATA.getProfessional(proId);
      var name=p?p.name:proId;
      UI.confirmAction({ title:T("Passer « ")+name+T(" » à l'offre GRATUIT ?"), message:T("L'abonnement payant sera remplacé par l'offre GRATUIT (0 DH). Le badge payant (VÉRIFIÉ / GOLD) sera retiré du profil."), confirmLabel:T("Passer à GRATUIT"), onConfirm:function(){
        DATA.setSubscription(proId, "PLAN-FREE");
        DATA.logAudit({admin:AUTH.getSession().name, action:"SUBSCRIPTION_DOWNGRADED_TO_FREE", entity:"Professional", entityId:proId, result:name+" → GRATUIT"});
        UI.toast(name+T(" est passé à GRATUIT.")); renderSubscriptions();
      } });
    }); });
    var sexp = document.getElementById("subExport"); if(sexp) sexp.addEventListener("click", function(){
      var rows=[[T("Professionnel"),T("Plan"),T("Prix"),T("Début"),T("Renouvellement"),T("Statut"),T("Paiement"),"ID"]];
      DATA.getSubscriptions().forEach(function(s){ var p=DATA.getProfessional(s.professionalId); rows.push([p?p.name:"?",s.planName,s.price,s.since,s.renewal,s.status,s.paymentStatus,s.id]); });
      UI.exportCSV("abonnements-sna3ti.csv", rows); UI.toast(T("Export généré."));
    });
  }
  function tick(on){ return on ? '<span class="tick yes">✓</span>' : '<span class="tick no">—</span>'; }
  function benefitRow(label, cols){
    // cols = [free, verified, gold]: 1 = included, 0 = not, "req" = depends on separate approval
    return '<tr><td>'+esc(label)+'</td>'+ cols.map(function(c){
      if(c===1) return '<td class="cent">'+tick(true)+'</td>';
      if(c==="req") return '<td class="cent"><span class="badge amber">'+T("Approbation requise")+'</span></td>';
      return '<td class="cent">'+tick(false)+'</td>';
    }).join("") +'</tr>';
  }
  function payStatusBadge(s){ var m={confirmed:["green",T("Confirmé")],pending:["amber",T("En attente")],rejected:["red",T("Rejeté")],refunded:["gray",T("Remboursé")]}; var e=m[s]||["gray",s]; return '<span class="badge '+e[0]+'">'+e[1]+'</span>'; }
  function editPlan(id){
    var pl = DATA.getSubscriptionPlans().find(function(x){ return x.id===id; });
    UI.openModal('<h3>'+T("Modifier le plan ")+esc(pl.name)+'</h3><div class="frm">'+
      '<div class="frm"><label>'+T("Nom")+'</label><input id="plName" value="'+esc(pl.name)+'"></div>'+
      '<div class="frm"><label>'+T("Prix (DH)")+'</label><input id="plPrice" type="number" value="'+pl.price+'"></div>'+
      '<div class="frm"><label>'+T("Description")+'</label><input id="plDesc" value="'+esc(pl.description)+'"></div>'+
      '<div class="frm"><label>'+T("Avantages (un par ligne)")+'</label><textarea id="plFeats">'+esc(pl.advantages.join("\n"))+'</textarea></div>'+
      '</div><div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">'+T("Annuler")+'</button><button class="btn btn-primary" id="plSave">'+T("Enregistrer")+'</button></div>');
    document.getElementById("plSave").addEventListener("click", function(){
      var old=pl.price;
      var data={ name:document.getElementById("plName").value, price:parseInt(document.getElementById("plPrice").value)||0, description:document.getElementById("plDesc").value, advantages:document.getElementById("plFeats").value.split("\n").filter(Boolean) };
      DATA.updateSubscriptionPlan(id, data);
      if(data.price!==old) DATA.logAudit({admin:AUTH.getSession().name, action:"PRICE_CHANGED", entity:"SubscriptionPlan", entityId:id, prev:old+" DH", next:data.price+" DH", result:"Updated"});
      UI.toast(T("Plan mis à jour.")); UI.closeModal(); renderSubscriptions();
    });
  }
  function viewPlanSubs(id){
    var pl = DATA.getSubscriptionPlans().find(function(x){ return x.id===id; });
    var subs = DATA.getSubscriptions().filter(function(s){ return s.planName===pl.name; });
    var body = !subs.length ? '<div class="empty">'+T("Aucun abonné.")+'</div>'
      : '<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>'+T("Professionnel")+'</th><th>'+T("Prix")+'</th><th>'+T("Statut")+'</th><th>'+T("Paiement")+'</th></tr></thead><tbody>' +
        subs.map(function(s){
          var p=DATA.getProfessional(s.professionalId);
          return '<tr><td><div class="pro"><div class="p-avatar">'+initials(p?p.name:"?")+'</div><div class="pro-name">'+esc(p?p.name:"?")+'</div></div></td>'+
            '<td>'+s.price+' DH</td><td>'+statusBadge(s.status)+'</td><td>'+payStatusBadge(s.paymentStatus)+'</td></tr>';
        }).join("") + '</tbody></table></div>';
    UI.openModal('<h3>'+T("Abonnés")+' — '+esc(pl.name)+'</h3>'+body, true);
  }

  /* ============================================================
     PAYMENTS + BANK TRANSFER WORKFLOW
     ============================================================ */
  function renderPayments(){
    UI.setTitle(T("Paiements"));
    var pays = DATA.getPayments();
    UI.setContent(
      '<div class="page-head"><h1>'+T("Paiements")+'</h1><div class="spacer">'+(AUTH.can("payments","read")?'<button class="btn btn-ghost" id="payExport">⬇ '+T("Exporter")+'</button>':"")+'<span class="muted" style="margin:0 8px">'+T("Virements bancaires manuels confirmés après contrôle.")+'</span></div></div>' +
      '<div class="card"><div class="table-wrap"><table><thead><tr><th>'+T("Référence")+'</th><th>'+T("Professionnel")+'</th><th>'+T("Plan")+'</th><th>'+T("Montant")+'</th><th>'+T("Méthode")+'</th><th>'+T("Réf. bancaire")+'</th><th>'+T("Date")+'</th><th>'+T("Statut")+'</th><th>'+T("Actions")+'</th></tr></thead><tbody>'+
      pays.map(function(pa){
        var p = DATA.getProfessional(pa.professionalId);
        var linkReq = DATA.getVerificationRequests().find(function(x){ return x.paymentId===pa.id; });
        return '<tr><td><b>'+esc(pa.reference)+'</b>'+(linkReq?'<br><span class="badge purple">'+T("Demande abonnement")+'</span>':"")+'</td><td><div class="pro"><div class="p-avatar">'+initials(p?p.name:"?")+'</div><div class="pro-name">'+esc(p?p.name:"?")+'</div></div></td>'+
          '<td>'+esc(pa.planName)+'</td><td><b>'+pa.amount+' DH</b></td><td>'+payMethodBadge(pa.method)+'</td><td>'+esc(pa.bankRef||"—")+'</td><td>'+pa.date+'</td>'+
          '<td>'+payStatusBadge(pa.status)+'</td>'+
          '<td class="actions-cell">'+
            (AUTH.can("payments","approve") && pa.status==="pending" ? '<button class="icon-act" data-confp="'+pa.id+'" title="'+T("Confirmer (active la souscription VÉRIFIÉ/GOLD)")+'" style="color:var(--green)">✓</button>' : "") +
            (AUTH.can("payments","reject") && pa.status==="pending" ? '<button class="icon-act danger" data-rejp="'+pa.id+'" title="'+T("Rejeter")+'">✖</button>' : "") +
            (AUTH.can("payments","update") && pa.status==="pending" ? '<button class="icon-act" data-infop="'+pa.id+'" title="'+T("Demander des informations")+'" style="color:var(--amber)">💡</button>' : "") +
            '<button class="icon-act" data-whats="'+pa.id+'" title="'+T("Discuter sur WhatsApp")+'">💬</button>' +
            (linkReq ? '<button class="icon-act" data-openbk="'+linkReq.id+'" title="'+T("Voir en vérification")+'">✅</button>' : "") +
          '</td></tr>';
      }).join("") + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-title">'+T("Workflow virement bancaire")+'</div>' +
      '<div class="verif-steps" style="margin-top:10px"><span class="step done">1. '+T("Professionnel choisit le plan")+'</span><span class="step current">2. '+T("Virement bancaire")+'</span><span class="step">3. '+T("Reçu téléversé")+'</span><span class="step">4. '+T("Paiement = En attente")+'</span><span class="step">5. '+T("Finance/Admin vérifie")+'</span><span class="step">6. '+T("Confirmer/Rejeter")+'</span><span class="step">7. '+T("Abonnement VÉRIFIÉ/GOLD activé (badge vérifié = processus distinct)")+'</span></div>' +
      '<p class="muted" style="margin-top:12px">'+T("Confirmer le paiement active la souscription VÉRIFIÉ (99 DH/mois) ou GOLD (199 DH/mois). Le badge “Professionnel Vérifié” reste soumis à une vérification distincte et ne se déclenche jamais automatiquement par le paiement seul.")+'</p></div>' +
      '<div class="card"><div class="card-title">'+T("Paiement en ligne (carte)")+'</div><p class="muted" style="margin:8px 0">'+T("L'intégration du prestataire de paiement par carte (CMI / paymob / autre) est prévue comme prochaine étape. Actuellement, tous les paiements passent par virement bancaire manuel.")+'</p><span class="badge gray">🔧 '+T("Bientôt disponible")+'</span></div>'
    );
    document.querySelectorAll("[data-confp]").forEach(function(b){ b.addEventListener("click", function(){ confirmPayment(b.dataset.confp); }); });
    document.querySelectorAll("[data-rejp]").forEach(function(b){ b.addEventListener("click", function(){ rejectPayment(b.dataset.rejp); }); });
    document.querySelectorAll("[data-infop]").forEach(function(b){ b.addEventListener("click", function(){ requestPaymentInfo(b.dataset.infop); }); });
    document.querySelectorAll("[data-openbk]").forEach(function(b){ b.addEventListener("click", function(){ ROUTER.navigate("verification"); }); });
    document.querySelectorAll("[data-whats]").forEach(function(b){ b.addEventListener("click", function(){
      var pa=DATA.getPayments().find(function(x){return x.id===b.dataset.whats;}); if(pa){ window.open("https://wa.me/"+DATA.getConfig().phone+"?text="+encodeURIComponent("Sna3ti Admin — confirmation paiement "+pa.reference+" ("+pa.amount+" DH)"), "_blank"); }
    }); });
    var pex = document.getElementById("payExport"); if(pex) pex.addEventListener("click", function(){
      var rows=[[T("Référence"),T("Professionnel"),T("Plan"),T("Montant"),T("Méthode"),T("Réf. bancaire"),T("Date"),T("Statut"),"ID"]];
      DATA.getPayments().forEach(function(pa){ var p=DATA.getProfessional(pa.professionalId); rows.push([pa.reference,p?p.name:"?",pa.planName,pa.amount,pa.method,pa.bankRef||"",pa.date,pa.status,pa.id]); });
      UI.exportCSV("paiements-sna3ti.csv", rows); UI.toast(T("Export généré."));
    });
  }
  function renderPaymentDetail(id){
    var pa = DATA.getPayments().find(function(x){ return x.id===id; });
    if(!pa){ renderNotFound(); return; }
    UI.setTitle(T("Paiement")+" — "+pa.reference);
    var p = DATA.getProfessional(pa.professionalId);
    var linkReq = DATA.getVerificationRequests().find(function(x){ return x.paymentId===pa.id; });
    UI.setContent(
      '<div class="page-head"><h1>'+T("Paiement")+' — '+esc(pa.reference)+'</h1><div class="spacer"><button class="btn btn-ghost" id="pdBack" style="margin-right:8px">← '+T("Tous les paiements")+'</button>'+
      (AUTH.can("payments","approve") && pa.status==="pending" ? '<button class="btn btn-primary" id="pdConf">✓ '+T("Confirmer")+'</button>' : "")+
      (AUTH.can("payments","reject") && pa.status==="pending" ? '<button class="btn btn-danger" id="pdRej" style="margin-left:8px">'+T("Rejeter")+'</button>' : "")+'</div></div>' +
      '<div class="card"><div class="detail-grid">'+
        drow(T("Référence"), esc(pa.reference))+
        drow(T("Statut"), payStatusBadge(pa.status))+
        drow(T("Plan"), esc(pa.planName))+
        drow(T("Montant"), '<b>'+pa.amount+' DH</b>')+
        drow(T("Méthode"), payMethodBadge(pa.method))+
        drow(T("Référence bancaire"), esc(pa.bankRef||"—"))+
        drow(T("Date"), pa.date)+
        drow(T("Professionnel"), p ? ('<a href="#/admin/professionals/'+esc(p.id)+'">'+esc(p.name)+'</a>') : "—")+
        (pa.rejectionReason ? drow(T("Raison du rejet"), esc(pa.rejectionReason)) : "")+
        (pa.infoRequested ? drow(T("Informations demandées"), esc(pa.infoRequested)) : "")+
      '</div></div>' +
      (linkReq ? '<div class="card"><div class="card-title">'+T("Demande d'abonnement liée")+'</div><p class="muted" style="margin:8px 0">'+linkReq.id+' — '+esc(linkReq.requestedPlan||"")+'</p><button class="btn btn-soft" id="pdOpenVr">'+T("Voir en vérification")+'</button></div>' : "")
    );
    var back = document.getElementById("pdBack"); if(back) back.addEventListener("click", function(){ ROUTER.navigate("payments"); });
    var conf = document.getElementById("pdConf"); if(conf) conf.addEventListener("click", function(){ confirmPayment(id); ROUTER.navigate("payments"); });
    var rej = document.getElementById("pdRej"); if(rej) rej.addEventListener("click", function(){ rejectPayment(id); ROUTER.navigate("payments"); });
    var ovr = document.getElementById("pdOpenVr"); if(ovr) ovr.addEventListener("click", function(){ ROUTER.navigate("verification"); });
  }
  function confirmPayment(id){
    UI.confirmAction({ title:T("Confirmer ce paiement ?"), message:T("Après contrôle du virement, la souscription VÉRIFIÉ ou GOLD sera activée sur le profil. Le badge « Professionnel Vérifié » reste soumis à une vérification distincte, indépendante du paiement."), confirmLabel:T("Confirmer"), onConfirm:function(){
      DATA.confirmPayment(id);
      DATA.logAudit({admin:AUTH.getSession().name, action:"CONFIRM_PAYMENT", entity:"Payment", entityId:id, result:"Confirmed"});
      UI.toast(T("Paiement confirmé — souscription activée (vérification du badge = processus distinct).")); renderPayments();
    }});
  }
  function rejectPayment(id){
    UI.confirmAction({ title:T("Rejeter ce paiement ?"), reasonRequired:true, reasonLabel:T("Raison du rejet"), confirmLabel:T("Rejeter"), onConfirm:function(reason){
      DATA.rejectPayment(id, reason);
      DATA.logAudit({admin:AUTH.getSession().name, action:"REJECT_PAYMENT", entity:"Payment", entityId:id, result:"Rejected", note:reason});
      UI.toast(T("Paiement rejeté.")); renderPayments();
    }});
  }
  function requestPaymentInfo(id){
    UI.confirmAction({ title:T("Demander des informations"), reasonRequired:true, reasonLabel:T("Note au professionnel"), confirmLabel:T("Envoyer"), onConfirm:function(note){
      DATA.requestPaymentInfo(id, note);
      DATA.logAudit({admin:AUTH.getSession().name, action:"PAYMENT_INFO_REQUESTED", entity:"Payment", entityId:id, result:"Needs info", note:note});
      UI.toast(T("Demande d'information envoyée.")); renderPayments();
    }});
  }
  function payMethodBadge(m){ var map={ bank_transfer:["blue","🏦 "+T("Virement")], card:["purple","💳 "+T("Carte")], cash:["green","💵 "+T("Espèces")], paypal:["amber","🅿️ PayPal"] }; var e=map[m]||["gray",m||"—"]; return '<span class="badge '+e[0]+'">'+e[1]+'</span>'; }

  /* ============================================================
     ANALYTICS
     ============================================================ */
  var analyticsFilter = "12m";
  var analyticsFrom = ""; var analyticsTo = "";
  var MONTHS=["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
  function customMonths(){
    if(!analyticsFrom || !analyticsTo) return 12;
    var f=new Date(analyticsFrom), t=new Date(analyticsTo);
    if(isNaN(f.getTime())||isNaN(t.getTime())||f>t) return 12;
    var m=(t.getFullYear()-f.getFullYear())*12+(t.getMonth()-f.getMonth())+1;
    return Math.max(1, Math.min(12, m));
  }
  function renderAnalytics(){
    UI.setTitle(T("Analytiques"));
    var a = DATA.getAnalytics();
    var slice = a.visits.slice();
    var fLbl = {"today":T("Aujourd'hui"),"7d":T("7 jours"),"30d":T("30 jours"),"90d":T("90 jours"),"12m":T("12 mois"),"custom":T("Période personnalisée")}[analyticsFilter];
    var customN = customMonths();
    function sub(ar){ return ar.slice(-Math.abs(periodN())); }
    function periodN(){
      var m={ today:1, "7d":2, "30d":6, "90d":9, "12m":12, custom:customN };
      return m[analyticsFilter]||12;
    }
    function sum(ar){ return ar.reduce(function(x,y){return x+y;},0); }
    function last(ar){ return ar.length?ar[ar.length-1]:0; }
    function pct(c,a){ return (a>0)?(Math.round(c/a*1000)/10):0; }
    var visits = sub(a.visits), signups = sub(a.signups), mrr = sub(a.mrr), churn = sub(a.churn), conv = sub(a.conversion);
    var leads = a.leads || {};
    var leadsTotal = (leads.phone||0)+(leads.whatsapp||0)+(leads.contact||0);
    var customPicker = (analyticsFilter==="custom")? ('<div class="custom-range" style="display:flex;gap:8px;align-items:center;margin:10px 0;flex-wrap:wrap">'+
        '<label class="muted">'+T("Du")+' <input type="date" id="anFrom" value="'+esc(analyticsFrom)+'"></label>'+
        '<label class="muted">'+T("Au")+' <input type="date" id="anTo" value="'+esc(analyticsTo)+'"></label>'+
        '<span class="muted" style="font-size:12px">'+T("Période")+' : '+customN+' '+T("mois")+'</span></div>') : "";
    var html =
      '<div class="page-head"><h1>'+T("Analytiques")+'</h1><div class="spacer"><div class="tabs" style="border:none;padding:0;margin:0">'+
        ["today","7d","30d","90d","12m","custom"].map(function(f){ return '<button class="tab '+(f===analyticsFilter?"active":"")+'" data-f="'+f+'">'+{"today":T("Aujourd'hui"),"7d":T("7 jours"),"30d":T("30 jours"),"90d":T("90 jours"),"12m":T("12 mois"),"custom":T("Période")}[f]+'</button>'; }).join("")+
      '</div></div></div>' +
      customPicker +
      '<div class="kpi-grid grid-4">'+
        kpiCard(T("Utilisateurs"), "👥", DATA.getUsers() ? ('' + sum(signups)) : "0", "▲ "+(signups.length>1?Math.round((signups[signups.length-1]-signups[0])/signups[0]*100):8.2)+"%","up") +
        kpiCard(T("Recherches"), "🔍", secara(sum(visits)),"▲ 18%","up") +
        kpiCard(T("Demandes de contact"), "📞", secara(sum(signups)*22),"▲ 6%","up") + kpiCard("MRR ("+fLbl+")", "💰", secara(last(mrr))+" DH", (mrr.length>1&&mrr[mrr.length-1]>=mrr[mrr.length-2])?"▲ 9,7%":"▽ 1,2%", (mrr.length>1&&mrr[mrr.length-1]>=mrr[mrr.length-2])?"up":"down") +
      '</div>' +
      '<div class="grid-2" style="margin-top:20px">'+
        '<div class="card"><div class="card-title">'+T("Visites")+' ('+fLbl+')</div><div class="chart-bars">'+bars(visits)+'</div></div>'+
        '<div class="card"><div class="card-title">'+T("Inscriptions")+' ('+fLbl+')</div><div class="chart-bars">'+bars(signups)+'</div></div>'+
      '</div>' +
      '<div class="grid-2" style="margin-top:20px">'+
        '<div class="card"><div class="card-title">MRR ('+T("récurrent mensuel")+') — DH</div><div class="chart-bars">'+bars(mrr)+'</div></div>'+
        '<div class="card"><div class="card-title">'+T("Taux de conversion")+' (%)</div><div class="chart-bars">'+bars(conv)+'</div></div>'+
      '</div>' +
      '<div class="kpi-grid grid-4" style="margin-top:20px">'+
        '<div class="kpi"><div class="k-title">'+T("Vérifiés")+'</div><div class="k-val">'+ (a.verifiedPercent||54)+'%</div></div>'+
        '<div class="kpi"><div class="k-title">GOLD</div><div class="k-val">'+(a.goldPercent||26)+'%</div></div>'+
        '<div class="kpi"><div class="k-title">'+T("Free → Payant")+'</div><div class="k-val">'+(a.freeToPaid||12.4)+'%</div></div>'+
        '<div class="kpi"><div class="k-title">'+T("Note moyenne")+'</div><div class="k-val">★ '+(a.avgRating||4.6)+'</div></div>'+
      '</div>' +
      '<div class="grid-3" style="margin-top:20px;align-items:start">'+
        '<div class="card"><div class="card-title">'+T("Top services")+'</div>' + (a.topServices||[]).map(function(s,i){ return '<div class="row-item"><div class="grow">'+esc(s)+'</div><span class="muted">#'+(i+1)+'</span></div>'; }).join("") + '</div>'+
        '<div class="card"><div class="card-title">'+T("Top villes")+'</div>' + (a.topCities||[]).map(function(s,i){ return '<div class="row-item"><div class="grow">'+esc(s)+'</div><span class="muted">#'+(i+1)+'</span></div>'; }).join("") + '</div>'+
        '<div class="card"><div class="card-title">'+T("Sources de leads")+'</div>'+
          '<div class="row-item"><div class="grow">📞 '+T("Téléphone")+'</div><span class="muted">'+secara(leads.phone||0)+' ('+pct(leads.phone||0,leadsTotal)+'%)</span></div>'+
          '<div class="row-item"><div class="grow">💬 WhatsApp</div><span class="muted">'+secara(leads.whatsapp||0)+' ('+pct(leads.whatsapp||0,leadsTotal)+'%)</span></div>'+
          '<div class="row-item"><div class="grow">📨 '+T("Formulaire")+'</div><span class="muted">'+secara(leads.contact||0)+' ('+pct(leads.contact||0,leadsTotal)+'%)</span></div>'+
        '</div>'+
      '</div>' +
      '<div class="grid-2" style="margin-top:20px;align-items:start">'+
        '<div class="card"><div class="card-title">Churn (%)</div><div class="chart-bars">'+bars(churn)+'</div></div>'+
        '<div class="card"><div class="card-title">'+T("Recherches sans résultat")+'</div>' + bars(sub(a.failedSearches)) + '</div>'+
      '</div>';
    UI.setContent(html);
    document.querySelectorAll(".tab[data-f]").forEach(function(t){ t.addEventListener("click", function(){ analyticsFilter=t.dataset.f; renderAnalytics(); }); });
    var df=document.getElementById("anFrom"), dt=document.getElementById("anTo");
    if(df) df.addEventListener("change", function(){ analyticsFrom=df.value; renderAnalytics(); });
    if(dt) dt.addEventListener("change", function(){ analyticsTo=dt.value; renderAnalytics(); });
  }
  function bars(data, acc){
    var m = Math.max.apply(null, data) || 1;
    return data.map(function(v,i){
      return '<div class="bar"><div class="b '+(acc?"acc":"")+'" style="height:'+Math.round(v/m*100)+'%"></div><div class="b-val">'+v+'</div><div class="b-lbl">'+MONTHS[i%12]+'</div></div>';
    }).join("");
  }

  /* ============================================================
     AI CENTER (preview only)
     ============================================================ */
  function renderAI(){
    UI.setTitle(T("AI Center"));
    var html =
      '<div class="page-head"><h1>AI Center</h1><div class="spacer"><span class="badge purple">'+T("Prototype")+'</span></div></div>' +
      '<div class="card"><div class="card-title">'+T("Recherche IA — testez une requête")+'</div>' +
        '<p class="muted">'+T("Interprétation d'une requête utilisateur en service, localisation et disponibilité, puis mise en relation avec les professionnels correspondants.")+'</p>' +
        '<div class="toolbar"><div class="field grow"><label>'+T("Requête utilisateur")+'</label><input type="text" id="aiQuery" placeholder="'+T("Ex : plombier à Casablanca disponible aujourd'hui")+'"></div>'+
        '<div class="field"><label>&nbsp;</label><button class="btn btn-primary" id="aiRun">'+T("Interpréter & match")+'</button></div></div>' +
        '<div id="aiResult"></div></div>' +
      '<div class="card"><div class="card-title">'+T("Aperçu IA (insights mock)")+'<span class="badge purple" style="margin-left:8px">Mock</span></div>' +
        '<p class="muted" style="margin:4px 0 12px">'+T("Exemples de demandes clients ayant transité par l'interprétation IA — données simulées en attendant l'API.")+'</p>' +
        AICenter.mockInsights.slice(0,3).map(function(ins){ return '<div class="ai-insight" style="border:1px dashed var(--line-strong);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--sand)">'+
          '<div class="req" style="font-weight:600;margin-bottom:8px">« '+esc(ins.query)+' »</div>'+
          '<div class="verif-steps">'+
            '<span class="step done"><b>'+T("Service")+'</b> : '+esc(ins.service)+'</span>'+
            '<span class="step done"><b>'+T("Localisation")+'</b> : '+esc(ins.location)+'</span>'+
            '<span class="step done"><b>'+T("Disponibilité")+'</b> : '+esc(ins.availability)+'</span>'+
          '</div></div>'; }).join("") +
        '<div class="muted" style="font-size:11px;margin-top:4px">'+T("Provider")+': <code>'+(AICenter.config.provider)+'</code> · '+T("endpoint API")+': <code>"'+(AICenter.config.endpoint||"—")+'"</code></div>' +
      '</div>' +
      '<div class="card"><div class="card-title">'+T("Capacités")+'</div><div class="kpi-grid grid-3" style="margin-top:12px">'+
        '<div class="kpi"><div class="k-title">'+T("Recherche IA")+'</div><div class="k-val" style="font-size:20px">'+T("Requête → match pros")+'</div></div>'+
        '<div class="kpi"><div class="k-title">'+T("Mise en relation")+'</div><div class="k-val" style="font-size:20px">'+T("Score + profil")+'</div></div>'+
        '<div class="kpi"><div class="k-title">'+T("Leads")+'</div><div class="k-val" style="font-size:20px">'+T("Capture de contact")+'</div></div>'+
      '</div></div>';
    UI.setContent(html);

    // Parsing delegates to the AICenter service facade (mock provider by default,
    // swappable for a real backend later). Kept async-ready via Promise.chains.
    function parseQuery(q){ return AICenter.parse(q.toLowerCase()); }


    function renderResult(res){
      var matches = DATA.searchByIntent({ svc: res.svc==="—"? "": res.svc, city: res.city, cityId: res.cityId, avail: res.avail });
      var agg = (matches.length>0?" — "+matches.length+ T(" correspondance(s)"):"");
      var header = '<div class="req" style="background:var(--sand);border:1px dashed var(--line-strong)">'+
        '<div class="muted" style="margin-bottom:8px"><b>'+T("Requête")+' :</b> « '+esc(res.raw)+' »</div>'+
        '<div class="verif-steps"><span class="step done">'+T("Service")+' : '+esc(res.svc)+'</span><span class="step done">'+T("Localisation")+' : '+esc(res.city)+'</span><span class="step done">'+T("Disponibilité")+' : '+esc(res.avail)+'</span></div></div>';
      var body;
      if(!matches.length){
        body = '<div class="req" style="margin-top:12px"><div class="empty">'+T("Aucun professionnel actif ne correspond (essayez sans ville, ou un autre métier).")+'</div></div>';
      } else {
        body = '<div class="card" style="margin-top:12px"><div class="card-head"><div class="card-title">'+T("Professionnels matchés")+agg+'</div><span class="muted small">'+T("Triés par pertinence")+'</span></div>'+
          matches.map(function(m){
            var pct = Math.min(100, Math.round(m.score/95*100));
            return '<div class="row-item ai-m" data-pro="'+m.professionalId+'">' +
              '<div class="p-avatar" style="width:44px;height:44px">'+initials(m.name)+'</div>' +
              '<div class="grow">' +
                '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>'+esc(m.name)+'</b>'+esc(m.job)+' <span class="muted">· '+esc(m.city)+'</span></div>' +
                '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+pkgBadge({package:m.package})+(m.verified?'<span class="badge green">✅ '+T("Vérifié")+'</span>':"")+'<span class="badge amber">★ '+m.rating+'</span>'+'<span class="muted small">'+m.price+' DH</span>'+
                  '<span class="badge '+(pct>=70?"green":pct>=45?"amber":"blue")+'">'+pct+'% '+T("match")+'</span></div>' +
              '</div>'+
              (AUTH.can("ai","read")?'<div style="display:flex;gap:6px;align-items:center">'+
                '<button class="icon-act" data-aiopen="'+m.professionalId+'" title="'+T("Voir le profil")+'">👁️</button>'+
                '<button class="icon-act" data-ailead="'+m.professionalId+'" title="'+T("Créer un lead de contact")+'" style="color:var(--teal)">🤝</button>'+
              '</div>':"")+
            '</div>';
          }).join("") + '</div>';
      }
      document.getElementById("aiResult").innerHTML = header + body;
      document.querySelectorAll("[data-aiopen]").forEach(function(b){ b.addEventListener("click", function(){ ROUTER.navigate("professionals/"+b.dataset.aiopen); }); });
      document.querySelectorAll("[data-ailead]").forEach(function(b){ b.addEventListener("click", function(){ createLead(b.dataset.ailead); }); });
      document.querySelectorAll(".ai-m[data-pro]").forEach(function(row){ row.addEventListener("click", function(){ ROUTER.navigate("professionals/"+row.dataset.pro); }); });
    }
    function createLead(proId){
      var p = DATA.getProfessional(proId);
      var n = DATA.logLead(proId, "ai");
      DATA.logAudit({admin:AUTH.getSession().name, action:"LEAD_AI", entity:"Professional", entityId:proId, result:"Contact request", note:(p?p.name:"")});
      UI.toast(T("Lead de contact créé pour ")+(p?p.name:proId)+T(" (total ")+n+").");
    }

    document.getElementById("aiRun").addEventListener("click", function(){
      var q=document.getElementById("aiQuery").value.trim();
      if(!q){ UI.toast(T("Saisissez une requête."), true); return; }
      UI.toast(T("Interprétation en cours…"));
      AICenter.interpret(q).then(function(res){ renderResult(res); }).catch(function(){ UI.toast(T("Erreur d'interprétation."), true); });
    });
    document.getElementById("aiQuery").addEventListener("keydown", function(e){ if(e.key==="Enter") document.getElementById("aiRun").click(); });
  }

  /* ============================================================
     AI CENTER service facade (prototype-only)
     ------------------------------------------------------------
     The AI Center is intentionally PROTOTYPE-ONLY. It ships with a
     "mock" provider that interprets queries locally so the admin can
     preview the feature end-to-end.

     Architecture is API-ready: switch `config.provider` to "api" and
     set `config.endpoint` to a real backend URL. `interpret()` always
     returns a Promise, so the UI does not change when the mock is
     swapped for a live call (see the "// API" branch).

     NO real API keys are stored anywhere. Credentials for any future
     provider belong in backend-only config / env, never in front-end.
     ============================================================ */
  var AICenter = {
    config: {
      provider: "mock",   // "mock" | "api"
      endpoint: "",       // future backend URL (must be set to use "api")
      timeout: 600        // simulated provider latency (ms)
    },
    // Interpretation keyword maps (FR + Darija/Arabic) -> resolved category.
    servicesMap: {
      "Plomberie":   ["plombier","plomberie","plomb","jbab","كوطو","سباك","سبّاك"],
      "Électricité": ["electricien","électricien","electricite","électricité","elec","kahraba","كهربائي","كهرباء","نور","triki"],
      "Menuiserie":  ["menuisier","menuiserie","menuiser","najjar","نجار","خشب","bois"],
      "Maçonnerie":  ["macon","maçon","maconnerie","maçonnerie","malla","معلم","بناء","bani"],
      "Peinture":    ["peintre","peinture","peint","sabagh","صباغ","دهان"],
      "Coiffure":    ["coiffeur","coiffeuse","coiffure","coiff","hajjam","حلاق","حلاقة","مجعد"],
      "Mécanique":   ["mecanicien","mécanicien","mecanique","mécanique","mecano","ميكانيكي","ميكانيك"],
      "Plâtrerie":   ["platrier","plâtrier","platre","plâtre","plaster","djibs","djib","جيبس","جبس"]
    },
    citiesMap: {
      casablanca:["CITY-CASA","Casablanca","الدار البيضاء","casa","casanegra","كازا"],
      rabat:["CITY-RABA","Rabat","الرباط"],
      marrakech:["CITY-MARR","Marrakech","مراكش"],
      fes:["CITY-FES","Fès","فاس","fes"],
      agadir:["CITY-AGAD","Agadir","أكادير","اكادير"],
      tanger:["CITY-TANG","Tanger","طنجة"],
      kenitra:["CITY-KENI","Kénitra","القنيطرة"],
      mohammedia:["CITY-MOHAM","Mohammedia","المحمدية"],
      "el jadida":["CITY-ELJ","El Jadida","الجديدة"]
    },
    // Mock market insights shown in the AI Center (simulated, pre-API).
    mockInsights: [
      { query:"معلم ديال الجبس قريب ليا", service:"Plâtrerie (Plaster)", location:"Casablanca", availability:"Aujourd'hui" },
      { query:"Électricien disponible demain à Rabat", service:"Électricité", location:"Rabat", availability:"Demain" },
      { query:"سباك فلفاس دابا", service:"Plomberie", location:"Fès", availability:"Aujourd'hui" }
    ],
    resolveService: function(q){
      // Score-based with weak-term handling: "معلم" / "malla" are generic Darija
      // words ("master / builder") used across many trades. A specific craft or
      // material keyword (ex: "جبس" = plaster) must win over a generic term, so
      // "معلم ديال الجبس" resolves to Plâtrerie, not Maçonnerie.
      var ql = (q||"").toLowerCase();
      var genericTerms = { "معلم":1, "malla":1, "maçon":1, "macon":1, "بناء":1, "bani":1 };
      var best = null, bestScore = 0, bestLen = 0;
      var genericFallback = null, genericLen = 0;
      for(var cat in this.servicesMap){
        var keys = this.servicesMap[cat];
        var score = 0, maxLen = 0, sawGeneric = false;
        for(var i=0;i<keys.length;i++){
          var kk = keys[i].toLowerCase();
          if(ql.indexOf(kk)>-1){
            if(genericTerms[kk]){ sawGeneric = true; continue; }
            score++; if(kk.length>maxLen) maxLen=kk.length;
          }
        }
        if(sawGeneric && !genericFallback && !score){ genericFallback=cat; genericLen=maxLen; }
        if(score>bestScore || (score===bestScore && maxLen>bestLen)){
          best=cat; bestScore=score; bestLen=maxLen;
        }
      }
      return best || genericFallback || null;
    },
    resolveCity: function(q){
      var norm = (q||"").toLowerCase();
      for(var c in this.citiesMap){
        var def = this.citiesMap[c];
        for(var i=1;i<def.length;i++){ if(norm.indexOf(def[i].toLowerCase())>-1){ return { name:def[1], cityId:def[0] }; } }
      }
      return { name:"Position utilisateur", cityId:"" };
    },
    resolveAvail: function(q){
      var norm = (q||"").toLowerCase();
      if(norm.indexOf("aujourd")>-1 || norm.indexOf("اليوم")>-1 || norm.indexOf("liyouma")>-1 || norm.indexOf("دابا")>-1 || norm.indexOf("maintenant")>-1) return "Aujourd'hui";
      if(norm.indexOf("demain")>-1 || norm.indexOf("غدا")>-1 || norm.indexOf("gedda")>-1) return "Demain";
      return "À définir";
    },
    // Synchronous local interpretation -> normalized intent object.
    // Keep logic here so an "api" provider can later return the same shape.
    parse: function(q){
      q = (q==null?"":String(q));
      var svc = this.resolveService(q);
      var city = this.resolveCity(q);
      var avail = this.resolveAvail(q);
      return {
        svc: svc || "—",
        city: city.name,
        cityId: city.cityId,
        avail: avail,
        raw: q
      };
    },
    // Async interpretation. Mock by default; swap to api easily.
    interpret: function(q){
      var self = this;
      return new Promise(function(resolve, reject){
        if(self.config.provider === "api" && self.config.endpoint){
          // ---- API ----
          // fetch(self.config.endpoint, { method:"POST", headers:{ "Content-Type":"application/json" },
          //   body: JSON.stringify({ query:q }) })
          //   .then(r=>r.json()).then(res=>resolve(normalizeApi(res))).catch(reject);
          reject(new Error("AI API endpoint not configured / no keys in front-end."));
          return;
        }
        // ---- MOCK ----
        setTimeout(function(){
          try { resolve(self.parse(q)); }
          catch(e){ reject(e); }
        }, self.config.timeout);
      });
    }
  };
  // Expose the facade for testing + future server wiring (same convention as
  // global.Sna3tiData / Sna3tiRouter / Sna3tiUI).
  global.AICenter = AICenter;


  /* ============================================================
     NOTIFICATIONS, SETTINGS, ADMIN USERS, AUDIT
     ============================================================ */
  var notifFilter = "all";
  // Dirty flag guarding unsaved Settings changes (see renderSettings).
  var settingsDirty = false;
  // Currently rendered view id, used by the navigation guard to detect
  // leaving the Settings page with unsaved changes.
  var currentView = "";
  function renderNotifications(initialFilter){
    UI.setTitle(T("Notifications"));
    var valid = { all:1, payment:1, verification:1, sub:1, report:1, review:1, system:1, support:1, unread:1, read:1 };
    if(initialFilter && valid[initialFilter]) notifFilter = initialFilter;
    var list = DATA.getNotifications();
    var byCat = function(c){ return list.filter(function(n){ var t=n.type||n.cat||n.ico; return t===c || (c==="sub"&&t==="subscription"); }); };
    var cats = { all:T("Toutes"), payment:T("Paiement"), verification:T("Vérification"), sub:T("Abonnement"), report:T("Signalement"), review:T("Avis"), system:T("Système"), support:T("Support") };
    var catOrder = ["payment","verification","sub","report","review","system","support"];
    var readState = notifFilter==="unread" ? "unread" : (notifFilter==="read" ? "read" : null);
    // If a read/unread tab is active, filter the master list by status first.
    var base = readState ? list.filter(function(n){ return readState==="unread" ? n.unread : !n.unread; }) : list;
    var filtered;
    if(notifFilter==="all" || readState) filtered = base;
    else filtered = base.filter(function(n){ var t=n.type||n.cat||n.ico; return t===notifFilter || (notifFilter==="sub"&&t==="subscription"); });
    var unread = list.filter(function(n){return n.unread;}).length;
    var read = list.length - unread;
    UI.setContent('<div class="page-head"><h1>'+T("Notifications")+'</h1><div class="spacer">'+
      (AUTH.can("notifications","read") && unread ? '<button class="btn btn-soft" id="markAll">'+T("Tout marquer lu")+'</button>' : "")+'</div></div>' +
      '<div class="tabs">'+
        '<button class="tab '+(notifFilter==="all"?"active":"")+'" data-nf="all">'+T("Toutes")+' <span class="cnt">'+list.length+'</span></button>'+
        catOrder.map(function(c){ var n=byCat(c).length; return '<button class="tab '+(notifFilter===c?"active":"")+'" data-nf="'+c+'">'+esc(cats[c])+' <span class="cnt">'+n+'</span></button>'; }).join("")+
        '<button class="tab '+(notifFilter==="unread"?"active":"")+'" data-nf="unread">'+T("Non lues")+' <span class="cnt">'+unread+'</span></button>'+
        '<button class="tab '+(notifFilter==="read"?"active":"")+'" data-nf="read">'+T("Lues")+' <span class="cnt">'+read+'</span></button>'+
      '</div><div class="card">'+
      (filtered.length ? filtered.map(function(n, i){
        return '<div class="row-item" data-nav="'+(n.route||"")+'"><span class="n-ico '+(n.type||"teal")+'">'+notifIcon(n.type||n.cat||n.ico)+'</span><div class="grow">'+(n.unread?'<span class="badge teal">'+T("Nouveau")+'</span> ':'')+esc(n.text)+'<br><span class="muted">'+esc(n.when)+'</span></div>'+(n.unread?(AUTH.can("notifications","read")?'<button class="icon-act" data-readone="'+esc(n.id)+'" title="'+T("Marquer comme lue")+'">✓</button>':'')+'<span class="dot unread"></span>':'')+'</div>';
      }).join("") : '<div class="empty">'+T("Aucune notification.")+'</div>') +
      '</div>');
    document.querySelectorAll(".tab[data-nf]").forEach(function(t){ t.addEventListener("click", function(){ notifFilter=t.dataset.nf; renderNotifications(); }); });
    document.querySelectorAll("[data-nav]").forEach(function(row){ row.addEventListener("click", function(ev){ if(ev.target.closest("[data-readone]")) return; var r=row.dataset.nav; if(r) ROUTER.navigate(r); }); });
    document.querySelectorAll("[data-readone]").forEach(function(btn){ btn.addEventListener("click", function(){ DATA.markNotificationRead(btn.dataset.readone); UI.toast(T("Notification lue.")); renderNotifications(); }); });
    var ma = document.getElementById("markAll"); if(ma) ma.addEventListener("click", function(){ DATA.markNotificationsRead(); UI.toast(T("Toutes les notifications lues.")); renderNotifications(); });
  }
  function notifIcon(k){ var m={ payment:"💰", verification:"✅", sub:"📦", subscription:"📦", report:"🚩", review:"⭐", support:"🎧", search:"🔍", view:"👁️", contact:"🤝", system:"🔔" }; return m[k]||"🔔"; }

  function renderSettings(){
    UI.setTitle(T("Réglages"));
    var cfg = DATA.getConfig();
    // Snapshot the persisted values so Cancel can restore them and changes
    // can be detected (unsaved-changes guard).
    var baseline = JSON.parse(JSON.stringify(cfg));
    function currentForm(){
      return {
        platformName: (document.getElementById("sgName") || {}).value || "",
        contactEmail: (document.getElementById("sgEmail") || {}).value || "",
        phone: (document.getElementById("sgPhone") || {}).value || "",
        defaultLanguage: (document.getElementById("sgLang") || {}).value || "fr"
      };
    }
    function isDirty(){
      var f = currentForm();
      return f.platformName !== baseline.platformName || f.contactEmail !== baseline.contactEmail || f.phone !== baseline.phone || f.defaultLanguage !== baseline.defaultLanguage;
    }
    function fill(f){
      document.getElementById("sgName").value = f.platformName;
      document.getElementById("sgEmail").value = f.contactEmail;
      document.getElementById("sgPhone").value = f.phone;
      document.getElementById("sgLang").value = f.defaultLanguage;
    }
    // Persist the guard across re-renders / navigation on this page only.
    settingsDirty = isDirty();
    var html =
      '<div class="page-head"><h1>'+T("Réglages")+'</h1><div class="spacer">'+
        (AUTH.can("settings","update") ? '<span class="badge gray" id="sgDirtyHint" style="display:'+(settingsDirty?'inline-block':'none')+'">'+T("Modifications non enregistrées")+'</span>' : '')+'</div></div>' +
      '<div class="grid-2" style="align-items:start">' +
        '<div class="card"><div class="card-title">'+T("Général")+'</div><div class="frm" style="margin-top:14px">'+
          '<div class="frm"><label>'+T("Nom de la plateforme")+'</label><input id="sgName" value="'+esc(cfg.platformName)+'"></div>'+
          '<div class="frm"><label>'+T("Email de contact")+'</label><input id="sgEmail" value="'+esc(cfg.contactEmail)+'"></div>'+
          '<div class="frm"><label>'+T("Téléphone")+'</label><input id="sgPhone" value="'+esc(cfg.phone)+'"></div>'+
          '<div class="frm"><label>'+T("Langue par défaut")+'</label><select id="sgLang"><option value="fr" '+(cfg.defaultLanguage==="fr"?"selected":"")+'>'+T("Français")+'</option><option value="en" '+(cfg.defaultLanguage==="en"?"selected":"")+'>English</option><option value="ar" '+(cfg.defaultLanguage==="ar"?"selected":"")+'>العربية</option></select></div>'+
          '<div class="frm" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">'+
            '<button class="btn btn-primary" id="sgSave" '+(AUTH.can("settings","update")?"":"disabled")+'>'+T("Enregistrer")+'</button>'+
            '<button class="btn btn-ghost" id="sgCancel">'+T("Annuler")+'</button>'+
            '<button class="btn btn-soft" id="sgReset">'+T("Réinitialiser")+'</button>'+
          '</div>'+
        '</div></div>' +
        '<div class="card"><div class="card-title">'+T("Vérification")+'</div>'+
          '<div class="detail-grid" style="margin-top:12px">'+drow(T("Documents requis"), (cfg.verification.requiredDocuments||[]).join(", "))+'</div>'+
          '<div class="card-title" style="margin-top:16px">'+T("Contrôles requis")+'</div><div class="checklist" style="margin-top:10px">'+
          (cfg.verification.requiredChecks||[]).map(function(c){ return '<label><input type="checkbox" checked disabled><span>'+esc(cfg.verification.checkLabels[c]||c)+'</span></label>'; }).join("")+
          '</div></div>' +
        '<div class="card"><div class="card-title">'+T("Règles marketplace")+'</div><div class="feed" style="margin-top:10px">'+
          rule(T("Un compte gratuit peut exister sans vérification professionnelle."))+
          rule(T("La vérification d'identité est distincte de l'abonnement."))+
          rule(T("La vérification professionnelle est distincte de l'abonnement."))+
          rule(T("Le paiement n'accorde pas automatiquement la confiance."))+
          rule(T("GOLD ne signifie pas automatiquement vérifié."))+
          rule(T("Confirmation du paiement requise avant activation."))+
        '</div></div>' +
      '</div>';
    UI.setContent(html);
    function refreshDirty(){
      settingsDirty = isDirty();
      var hint = document.getElementById("sgDirtyHint");
      if(hint) hint.style.display = settingsDirty ? "inline-block" : "none";
    }
    ["sgName","sgEmail","sgPhone","sgLang"].forEach(function(id){
      (document.getElementById(id)||{}).addEventListener && document.getElementById(id).addEventListener("input", refreshDirty);
    });
    var hint2 = document.getElementById("sgDirtyHint"); if(hint2) hint2.style.display = settingsDirty ? "inline-block" : "none";
    var save = document.getElementById("sgSave"); if(save) save.addEventListener("click", function(){
      var f = currentForm();
      DATA.updateConfig(f);
      baseline = JSON.parse(JSON.stringify(f));
      settingsDirty = false;
      fill(f);
      refreshDirty();
      DATA.logAudit({admin:AUTH.getSession().name, action:"SETTINGS_CHANGED", entity:"Settings", entityId:"config", result:"Updated"});
      UI.toast(T("Réglages enregistrés."));
    });
    var cancelEl = document.getElementById("sgCancel"); if(cancelEl) cancelEl.addEventListener("click", function(){
      var f = { platformName: baseline.platformName, contactEmail: baseline.contactEmail, phone: baseline.phone, defaultLanguage: baseline.defaultLanguage };
      fill(f);
      settingsDirty = false;
      refreshDirty();
      UI.toast(T("Modifications annulées."));
    });
    var resetEl = document.getElementById("sgReset"); if(resetEl) resetEl.addEventListener("click", function(){
      UI.confirmAction({ title:T("Réinitialiser les réglages ?"), message:T("Restaurera les valeurs par défaut. Les modifications non enregistrées seront perdues."), confirmLabel:T("Réinitialiser"), onConfirm:function(){
        DATA.resetConfig();
        var d = DATA.getConfig();
        baseline = JSON.parse(JSON.stringify(d));
        fill(d);
        settingsDirty = false;
        refreshDirty();
        DATA.logAudit({admin:AUTH.getSession().name, action:"SETTINGS_RESET", entity:"Settings", entityId:"config", result:"Reset"});
        UI.toast(T("Réglages réinitialisés."));
      }});
    });
  }
  function rule(t){ return '<div class="feed-item"><div class="feed-dot teal"></div><div class="f-txt">'+esc(t)+'</div></div>'; }

  function renderAdminUsers(){
    UI.setTitle(T("Admin Users"));
    var users = DATA.getAdminUsers();
    UI.setContent('<div class="page-head"><h1>Admin Users</h1><div class="spacer">'+(AUTH.can("adminUsers","update")?'<button class="btn btn-primary" id="auAdd">+ '+T("Ajouter")+'</button>':"")+'</div></div>' +
      '<div class="card"><div class="table-wrap"><table><thead><tr><th>'+T("Nom")+'</th><th>Email</th><th>'+T("Rôle")+'</th><th>'+T("Statut")+'</th><th>'+T("Dernière connexion")+'</th><th>'+T("Créé")+'</th><th>'+T("Actions")+'</th></tr></thead><tbody>'+
      users.map(function(u){
        var rl = AUTH.roles[u.role] || { label:u.role, color:"gray" };
        return '<tr><td><div class="pro"><div class="p-avatar">'+initials(u.name)+'</div><div class="pro-name">'+esc(u.name)+'</div></div></td><td>'+esc(u.email)+'</td>'+
          '<td><span class="badge '+rl.color+'">'+esc(rl.label)+'</span></td><td>'+userStatusBadge(u.status)+'</td><td>'+u.lastLogin+'</td><td>'+u.created+'</td>'+
          '<td class="actions-cell">'+(AUTH.can("adminUsers","update")?'<button class="icon-act" data-editau="'+u.id+'">✏️</button>':"")+'</td></tr>';
      }).join("") + '</tbody></table></div></div>'+
      '<div class="card" style="margin-top:20px"><div class="card-head"><div class="card-title">'+T("Matrice de permissions (RBAC)")+'</div></div><div class="table-wrap"><table class="matrix"><thead><tr><th>'+T("Ressource")+'</th>'+
        Object.keys(AUTH.roles).map(function(r){ return '<th>'+esc(AUTH.roles[r].label)+'</th>'; }).join("")+'</tr></thead><tbody>'+
        Object.keys(DATA.permissionsCatalog).map(function(res){
          return '<tr><td><b>'+esc(res)+'</b><div class="muted" style="font-size:11px">'+(DATA.permissionsCatalog[res].join(", "))+'</div></td>'+
            Object.keys(AUTH.roles).map(function(r){ var perms=AUTH.roles[r].permissions; return '<td>'+(perms[res]&&perms[res].length?tick(true):tick(false))+'</td>'; }).join("")+'</tr>';
        }).join("")+
      '</tbody></table></div></div>');
    if(AUTH.can("adminUsers","update")){
      document.querySelectorAll("[data-editau]").forEach(function(b){ b.addEventListener("click", function(){ editAdminUser(b.dataset.editau); }); });
      document.getElementById("auAdd").addEventListener("click", function(){ editAdminUser(null); });
    }
  }
  function editAdminUser(id){
    var u = id ? DATA.getAdminUsers().find(function(x){ return x.id===id; }) : { id:null, name:"", email:"", role:"moderator" };
    UI.openModal('<h3>'+(id?T("Modifier"):T("Ajouter"))+' admin</h3><div class="frm">'+
      '<div class="frm"><label>'+T("Nom")+'</label><input id="auName" value="'+esc(u.name)+'"></div>'+
      '<div class="frm"><label>Email</label><input id="auEmail" value="'+esc(u.email)+'"></div>'+
      '<div class="frm"><label>'+T("Rôle")+'</label><select id="auRole">'+Object.keys(AUTH.roles).map(function(r){ return '<option value="'+r+'" '+(u.role===r?"selected":"")+'>'+esc(AUTH.roles[r].label)+'</option>'; }).join("")+'</select></div>'+
      '</div><div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">'+T("Annuler")+'</button><button class="btn btn-primary" id="auSave">'+T("Enregistrer")+'</button></div>');
    document.getElementById("auSave").addEventListener("click", function(){
      var d={ name:document.getElementById("auName").value, email:document.getElementById("auEmail").value, role:document.getElementById("auRole").value };
      var isNew = false;
      if(id){ var ex=DATA._store.adminUsers.find(function(x){return x.id===id;}); if(ex)Object.assign(ex,d); }
      else { DATA._store.adminUsers.push(Object.assign({id:"AU-"+Date.now(), status:"active", lastLogin:"—", created:new Date().toISOString().slice(0,10)}, d)); isNew = true; }
      DATA.persist();
      DATA.logAudit({admin:AUTH.getSession().name, action: isNew?"ADMIN_USER_CREATED":"ADMIN_USER_UPDATED", entity:"AdminUser", entityId:id||("AU-"+Date.now()), result:"Updated"});
      UI.toast(T("Admin enregistré.")); UI.closeModal(); renderAdminUsers();
    });
  }

  function renderAuditLogs(){
    UI.setTitle(T("Audit Logs"));
    var logs = DATA.getAuditLogs();
    UI.setContent('<div class="page-head"><h1>Audit Logs</h1><div class="spacer">'+(AUTH.can("auditLogs","export")?'<button class="btn btn-ghost" id="auExport">⬇ '+T("Exporter")+'</button>':"")+'</div></div>' +
      '<div class="card"><div class="toolbar"><div class="field"><label>'+T("Recherche")+'</label><input type="search" id="auQ" placeholder="'+T("Action, admin, entité, ID...")+'"></div>'+
        '<div class="field"><label>'+T("Résultat")+'</label><select id="auRes"><option value="">'+T("Tous")+'</option><option>Success</option><option>Approved</option><option>Rejected</option><option>Flagged</option><option>Updated</option></select></div></div>'+
      '<div class="table-wrap"><table><thead><tr><th>'+T("Horodatage")+'</th><th>Admin</th><th>'+T("Action")+'</th><th>'+T("Entité")+'</th><th>ID</th><th>'+T("Résultat")+'</th><th>'+T("Note")+'</th></tr></thead><tbody id="auBody"></tbody></table></div></div>');
    function auditFiltered(){
      var q=(document.getElementById("auQ").value||"").toLowerCase();
      var rs=document.getElementById("auRes").value;
      return logs.filter(function(l){ return (!q || (l.action+" "+l.admin+" "+l.entity+" "+l.entityId+" "+(l.note||"")).toLowerCase().indexOf(q)>-1) && (!rs || String(l.result)===rs); });
    }
    function drawAudit(){
      var rows=auditFiltered();
      document.getElementById("auBody").innerHTML = rows.length ? rows.map(function(l){ return '<tr><td>'+esc(l.timestamp)+'</td><td>'+esc(l.admin)+'</td><td><code>'+esc(l.action)+'</code></td><td>'+esc(l.entity)+'</td><td>'+esc(l.entityId)+(l.prev?'<div class="muted">'+esc(l.prev)+' → '+esc(l.next)+'</div>':"")+'</td>'+
        '<td><span class="badge '+(String(l.result).toLowerCase()==="success"||String(l.result).toLowerCase()==="approved"||String(l.result).toLowerCase()==="confirmed"?"green":"amber")+'">'+esc(l.result)+'</span></td><td class="muted">'+esc(l.note||"—")+'</td></tr>'; }).join("")
        : '<tr><td colspan="7"><div class="empty">'+T("Aucun résultat.")+'</div></td></tr>';
    }
    document.getElementById("auQ").addEventListener("input", UI.debounce(drawAudit, 220));
    document.getElementById("auRes").addEventListener("change", drawAudit);
    drawAudit();
    var ex = document.getElementById("auExport"); if(ex) ex.addEventListener("click", function(){
      var rows=[[T("Timestamp"),"Admin","Action",T("Entité"),"ID",T("Résultat"),T("Note")]]; auditFiltered().forEach(function(l){ rows.push([l.timestamp,l.admin,l.action,l.entity,l.entityId,l.result,l.note||""]); });
      UI.exportCSV("audit-logs-sna3ti.csv", rows); UI.toast(T("Export généré."));
    });
  }

  /* ============================================================
     FORBIDDEN / NOT FOUND
     ============================================================ */
  function renderForbidden(){
    UI.setTitle(T("Accès refusé"));
    UI.setContent('<div class="msg-box"><div class="b">🔒 '+T("Accès refusé")+'</div><p class="muted">'+T("Vous n'avez pas la permission d'accéder à cette section avec votre rôle actuel.")+'</p><button class="btn btn-ghost" onclick="window.Sna3tiRouter.navigate(\'dashboard\')">'+T("Retour au tableau de bord")+'</button></div>');
  }
  function renderNotFound(){
    UI.setTitle(T("Introuvable"));
    UI.setContent('<div class="msg-box"><div class="b">'+T("Page introuvable")+'</div><p class="muted">'+T("La route demandée n'existe pas.")+'</p><button class="btn btn-ghost" onclick="window.Sna3tiRouter.navigate(\'dashboard\')">'+T("Tableau de bord")+'</button></div>');
  }

  /* ============================================================
     ROUTE DISPATCH
     ============================================================ */
  function dispatch(route){
    if(route.route.view === "login"){ renderLogin(); return; }
    UI.setActiveNav(route.route.view === "professionalDetail" ? "professionals" : (route.route.view === "paymentDetail" ? "payments" : route.route.view));
    currentView = route.route.view;
    switch(route.route.view){
      case "dashboard": renderDashboard(); break;
      case "professionals": renderProfessionals(route.query||{}); break;
      case "professionalDetail": renderProfessionalDetail(route.params.id, route.query||{}); break;
      case "users": renderUsers(); break;
      case "verification": renderVerification((route.query||{}).status || "all"); break;
      case "categories": renderCategories(); break;
      case "cities": renderCities(); break;
      case "reviews": renderReviews((route.query||{}).status || "all"); break;
      case "reports": renderReports((route.query||{}).status || "all"); break;
      case "support": renderSupport((route.query||{}).status || "all"); break;
      case "subscriptions": renderSubscriptions(); break;
      case "payments": renderPayments((route.query||{}).status || "all"); break;
      case "paymentDetail": renderPaymentDetail(route.params.id); break;
      case "analytics": renderAnalytics(); break;
      case "ai": renderAI(); break;
      case "notifications": renderNotifications((route.query||{}).filter || ""); break;
      case "settings": renderSettings(); break;
      case "adminUsers": renderAdminUsers(); break;
      case "auditLogs": renderAuditLogs(); break;
      default: renderNotFound();
    }
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot(){
    // Build app shell once (used for authed views)
    UI.buildAppShell();
    // Unsaved-changes guard for the Settings page: confirm before leaving
    // the page, and warn before closing/reloading the browser.
    ROUTER.setBeforeLeave(function(view, toPath){
      if(!settingsDirty || currentView !== "settings") return false;
      var stay = !window.confirm(T("Des modifications ne sont pas enregistrées. Quitter quand même ?"));
      settingsDirty = false; // don't re-prompt if they choose to leave
      return stay;
    });
    window.addEventListener("beforeunload", function(ev){
      if(!settingsDirty) return;
      ev.preventDefault();
      ev.returnValue = "";
    });
    ROUTER.start({
      login: function(){ renderLogin(); },
      route: function(m){ dispatch(m); },
      forbidden: function(){ renderForbidden(); },
      notFound: function(){ renderNotFound(); }
    });
    UI.afterShell();
    // Update sidebar/nav pills occasionally
    setInterval(function(){ try{ UI.updatePills && global.Sna3tiUI.updatePills(); }catch(e){} }, 15000);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})(window);
