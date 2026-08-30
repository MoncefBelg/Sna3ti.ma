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

  /* ============================================================
     LOGIN VIEW
     ============================================================ */
  function renderLogin(error){
    UI.setTitle("Connexion");
    var root = document.getElementById("admin-root");
    var show = error ? '<div class="form-error">'+esc(error)+'</div>' : "";
    root.innerHTML =
      '<div class="login-wrap"><div class="login-card">' +
        '<div class="login-brand"><div class="brand-logo">S</div></div>' +
        '<div class="login-title">Sna3ti</div>' +
        '<div class="login-sub">Administration</div>' +
        show +
        '<form class="form" id="loginForm">' +
          '<div class="frm"><label for="email">Email</label><input id="loginEmail" type="email" placeholder="admin@sna3ti.ma" autocomplete="username" required /></div>' +
          '<div class="frm"><label for="password">Mot de passe</label><div class="pw-wrap"><input id="loginPassword" type="password" placeholder="••••••••" autocomplete="current-password" required /><button type="button" class="pw-toggle" id="pwToggle" aria-label="Afficher le mot de passe">👁️</button></div></div>' +
          '<label class="field-check"><input type="checkbox" id="loginRemember" /> Se souvenir de moi</label>' +
          '<button class="btn btn-primary btn-block" id="loginBtn" type="submit" style="justify-content:center">Se connecter</button>' +
        '</form>' +
        '<div class="login-foot">Prototype — authentification de démonstration uniquement.</div>' +
        '<div class="demo-box"><div class="demo-row"><span><b>Super Admin</b></span><code>admin@sna3ti.ma</code></div><div class="demo-row"><span><b>Finance</b></span><code>finance@sna3ti.ma</code></div><div class="demo-row"><span><b>Moderator</b></span><code>mod@sna3ti.ma</code></div><div class="demo-row"><span><b>Support</b></span><code>support@sna3ti.ma</code></div><div class="demo-row"><span class="muted">Mot de passe</span><span class="muted">(tout)</span></div></div>' +
      '</div></div>';

    document.getElementById("pwToggle").addEventListener("click", function(){
      var p = document.getElementById("loginPassword");
      p.type = p.type === "password" ? "text" : "password";
    });

    var btn = document.getElementById("loginBtn");
    document.getElementById("loginForm").addEventListener("submit", function(e){
      e.preventDefault();
      btn.disabled = true; btn.textContent = "Connexion...";
      AUTH.login(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value, document.getElementById("loginRemember").checked)
        .then(function(){
          location.hash = "#/admin/dashboard";
        })
        .catch(function(err){
          btn.disabled = false; btn.textContent = "Se connecter";
          renderLogin(err.message);
        });
    });
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  function renderDashboard(){
    UI.setTitle("Tableau de bord");
    UI.renderSkeleton(4, true);
    setTimeout(function(){
      var k = DATA.getKPIs();
      var alerts = DATA.getAlerts();
      var activity = DATA.getActivity();
      var html =
        '<div class="kpi-grid grid-4">' +
          kpiCard("Utilisateurs", "👥", k.users, "▲ 8.2% vs mois dernier", "up") +
          kpiCard("Professionnels", "🧑‍🔧", k.professionals, "▲ 12.4% vs mois dernier", "up") +
          kpiCard("Vérifiés", "✅", k.verified, "▲ 4.1% vs mois dernier", "up") +
          kpiCard("Vérifications en attente", "⏳", k.pendingVerification, "à traiter", "") +
          kpiCard("Professionnels actifs", "🟢", k.active, "▲ 3.0% vs mois dernier", "up") +
          kpiCard("Recherches aujourd&rsquo;hui", "🔍", secara(k.searches), "▲ 18% vs hier", "up") +
          kpiCard("Demandes de contact", "📞", secara(k.contactRequests), "▽ 2.2% vs hier", "down") +
          kpiCard("Revenus mensuels", "💰", secara(k.monthlyRevenue)+" DH", "▲ 9.7% vs mois dernier", "up") +
        '</div>' +
        '<div class="grid-2" style="margin-top:20px;align-items:stretch">' +
          '<div class="card"><div class="card-head"><div class="card-title">Alertes</div></div>' +
            alerts.map(function(a){ return '<div class="alert '+a.type+'" data-route="'+a.route+'"><span class="a-ico">'+a.icon+'</span><div><div class="a-title">'+esc(a.title)+'</div><div class="a-sub">'+esc(a.sub)+'</div></div></div>'; }).join("") +
          '</div>' +
          '<div class="card"><div class="card-head"><div class="card-title">Activité récente</div></div><div class="feed">' +
            activity.map(function(a){ return '<div class="feed-item"><div class="feed-dot '+a.type+'"></div><div class="f-txt">'+esc(a.text)+'</div><div class="f-when">'+esc(a.when)+'</div></div>'; }).join("") +
          '</div></div>' +
        '</div>';
      UI.setContent(html);
      UI.getContent().querySelectorAll(".alert[data-route]").forEach(function(el){
        el.addEventListener("click", function(){ ROUTER.navigate(el.dataset.route); });
      });
    }, 350);
  }

  function secara(n){ return typeof n === "number" ? n.toLocaleString("fr-MA") : n; }

  function kpiCard(title, ico, val, delta, cls){
    return '<div class="kpi"><div class="k-top"><span class="k-title">'+esc(title)+'</span><span class="k-ico">'+ico+'</span></div>' +
           '<div class="k-val">'+esc(val)+'</div><div class="k-delta '+cls+'"><span class="chg">'+delta+'</span></div></div>';
  }

  /* ============================================================
     PROFESSIONALS (list)
     ============================================================ */
  var proState = { page:1, q:"", city:"", category:"", verification:"", status:"", sort:"name", dir:1, perPage:6, selected:{} };
  function renderProfessionals(){
    UI.setTitle("Professionnels");
    var cities = unique(DATA.getProfessionals().map(function(p){ return p.city; }));
    var cats = unique(DATA.getProfessionals().map(function(p){ return p.category; }));
    var html =
      '<div class="page-head"><h1>Professionnels</h1><div class="spacer"></div>' +
        (AUTH.can("professionals","update") ? '<button class="btn btn-primary" id="btnNewPro">+ Nouveau professionnel</button>' : "") +
        (AUTH.can("professionals","read") ? '<button class="btn btn-ghost" id="btnExportPro">⬇ Exporter CSV</button>' : "") +
      '</div>' +
      '<div class="card">' +
        '<div class="toolbar">' +
          '<div class="field"><label>Recherche</label><input type="search" id="proQ" placeholder="Nom, métier, ville..." value="'+esc(proState.q)+'" /></div>' +
          '<div class="field"><label>Ville</label><select id="proCity"><option value="">Toutes</option>'+opts(cities, proState.city)+'</select></div>' +
          '<div class="field"><label>Catégorie</label><select id="proCat"><option value="">Toutes</option>'+opts(cats, proState.category)+'</select></div>' +
          '<div class="field"><label>Vérification</label><select id="proVer"><option value="">Tous</option><option value="verified" '+sel(proState.verification,"verified")+'>Vérifiés</option><option value="unverified" '+sel(proState.verification,"unverified")+'>Non vérifiés</option></select></div>' +
          '<div class="field"><label>Statut</label><select id="proStatus"><option value="">Tous</option>'+["active","pending","suspended","rejected"].map(function(s){return '<option '+sel(proState.status,s)+'>'+s+'</option>';}).join("")+'</select></div>' +
          '<div style="flex:1"></div>' +
          (AUTH.hasAny("professionals") ? '<button class="btn btn-soft" id="btnBulk">Sélection groupée</button>' : "") +
        '</div>' +
        '<div class="table-wrap"><table><thead><tr>' +
          '<th style="width:30px"><input type="checkbox" id="proCheckAll"></th>' +
          '<th class="sortable" data-sort="name">Nom</th><th>Profession</th><th>Ville</th>' +
          '<th class="sortable" data-sort="rating">Note</th><th class="sortable" data-sort="reviewsCount">Avis</th>' +
          '<th>Vérification</th><th>Package</th><th class="sortable" data-sort="status">Statut</th><th>Actions</th>' +
        '</tr></thead><tbody id="proBody"></tbody></table></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><span id="proCount" class="muted"></span><div id="proPager"></div></div>' +
        '<div id="bulkBar" class="hidden" style="margin-top:12px;padding:12px;background:var(--mint);border-radius:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>'+proCountSelected()+' sélectionné(s)</b>' +
          (AUTH.can("professionals","verify")?'<button class="btn btn-primary btn-small" id="bulkVerify">Vérifier</button>':"") +
          (AUTH.can("professionals","suspend")?'<button class="btn btn-warn btn-small" id="bulkSuspend">Suspendre</button>':"") +
          (AUTH.can("professionals","activate")?'<button class="btn btn-soft btn-small" id="bulkActivate">Activer</button>':"") +
          '<button class="btn btn-ghost btn-small" id="bulkClose">Fermer</button></div>' +
      '</div>';
    UI.setContent(html);

    // wire events
    document.getElementById("proQ").addEventListener("input", UI.debounce(function(){ proState.q = this.value; proState.page=1; drawPros(); }, 220));
    document.getElementById("proCity").addEventListener("change", function(){ proState.city=this.value; proState.page=1; drawPros(); });
    document.getElementById("proCat").addEventListener("change", function(){ proState.category=this.value; proState.page=1; drawPros(); });
    document.getElementById("proVer").addEventListener("change", function(){ proState.verification=this.value; proState.page=1; drawPros(); });
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
    document.getElementById("bulkClose").addEventListener("click", toggleBulk);
  }
  function bulkAction(action){
    var ids = selectedProIds();
    if(ids.length===0){ UI.toast("Aucun professionnel sélectionné."); return; }
    if(action==="suspend"){
      UI.confirmAction({ title:"Suspendre "+ids.length+" professionnel(s)?", message:"Cette action est réversible.", reasonRequired:true, reasonLabel:"Raison de la suspension", confirmLabel:"Suspendre", onConfirm:function(reason){
        ids.forEach(function(id){ DATA.updateProfessional(id, { status:"suspended" }); DATA.logAudit({admin:AUTH.getSession().name, action:"SUSPEND_PROFESSIONAL", entity:"Professional", entityId:id, result:"Suspended", note:reason}); });
        UI.toast(ids.length+" professionnel(s) suspendu(s)."); drawPros(); UI.updatePills && global.Sna3tiUI && global.Sna3tiUI.setActiveNav("professionals");
      }});
    } else if(action==="verify"){
      UI.confirmAction({ title:"Vérifier "+ids.length+" professionnel(s)?", message:"Vérification professionnelle groupée.", confirmLabel:"Vérifier", onConfirm:function(){
        ids.forEach(function(id){ DATA.updateProfessional(id, { verificationStatus:"approved", verified:true, professionStatus:"verified" }); DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFY_PROFESSIONAL", entity:"Professional", entityId:id, result:"Approved"}); });
        UI.toast(ids.length+" professionnel(s) vérifié(s)."); drawPros();
      }});
    } else if(action==="activate"){
      ids.forEach(function(id){ DATA.updateProfessional(id, { status:"active" }); DATA.logAudit({admin:AUTH.getSession().name, action:"ACTIVATE_PROFESSIONAL", entity:"Professional", entityId:id, result:"Active"}); });
      UI.toast(ids.length+" professionnel(s) activé(s)."); drawPros();
    }
  }

  function opts(list, cur){ return list.map(function(o){ return '<option value="'+esc(o)+'" '+sel(o,cur)+'>'+esc(o)+'</option>'; }).join(""); }
  function sel(a, b){ return a === b ? "selected" : ""; }
  function unique(arr){ return arr.filter(function(v,i){ return arr.indexOf(v)===i; }); }

  function drawPros(){
    var list = DATA.getProfessionals({
      q: proState.q, city: proState.city, category: proState.category,
      verification: proState.verification, status: proState.status
    });
    list.sort(function(a,b){
      var va=a[proState.sort], vb=b[proState.sort];
      if(typeof va==="string"){ return proState.dir * va.localeCompare(vb); }
      return proState.dir * ((va||0) - (vb||0));
    });
    var pg = UI.paginate(list.length, proState.page, proState.perPage);
    var slice = list.slice(pg.from, pg.to);
    document.getElementById("proCount").textContent = list.length + " professionnel(s) — page "+pg.page+"/"+pg.total;
    document.getElementById("proBody").innerHTML = slice.length ? slice.map(function(p){
      return '<tr id="row-'+p.id+'">' +
        '<td><input type="checkbox" class="row-check" data-id="'+p.id+'" '+((proState.selected[p.id])?"checked":"")+'></td>' +
        '<td><div class="pro"><div class="p-avatar">'+initials(p.name)+'</div><div><div class="pro-name">'+esc(p.name)+'</div><div class="pro-job">'+esc(p.id)+'</div></div></div></td>' +
        '<td>'+esc(p.job)+'</td><td>'+esc(p.city)+'</td>' +
        '<td><span class="star">★</span> '+p.rating+'</td><td>'+p.reviewsCount+'</td>' +
        '<td>'+verBadge(p)+'</td><td>'+pkgBadge(p)+'</td>' +
        '<td>'+statusBadge(p.status)+'</td>' +
        '<td class="actions-cell">' +
          '<button class="icon-act" title="Voir" data-view="professionals/'+p.id+'">👁️</button>' +
          (AUTH.can("professionals","update")?'<button class="icon-act" title="Modifier" data-edit="'+p.id+'">✏️</button>':"") +
          (AUTH.can("professionals","verify")?'<button class="icon-act" title="Vérifier" data-verify="'+p.id+'" style="color:var(--teal)">✅</button>':"") +
          (AUTH.can("professionals","suspend") && (p.status==="active"||p.status==="pending") ?'<button class="icon-act" title="Suspendre" data-suspend="'+p.id+'" style="color:var(--amber)">⏸️</button>':"") +
          (AUTH.can("professionals","activate") && p.status==="suspended" ?'<button class="icon-act" title="Activer" data-activate="'+p.id+'" style="color:var(--green)">▶️</button>':"") +
          (AUTH.can("professionals","delete") ?'<button class="icon-act danger" title="Supprimer" data-del="'+p.id+'">🗑️</button>':"") +
        '</td></tr>';
    }).join("") : '<tr><td colspan="10"><div class="empty" style="padding:30px">Aucun professionnel trouvé.</div></td></tr>';

    document.querySelectorAll("#proBody .row-check").forEach(function(ch){
      ch.addEventListener("change", function(){ proState.selected[ch.dataset.id] = ch.checked; refreshSelected(); });
    });
    document.querySelectorAll("#proBody [data-view]").forEach(function(b){ b.addEventListener("click", function(){ ROUTER.navigate(b.dataset.view); }); });
    document.querySelectorAll("#proBody [data-edit]").forEach(function(b){ b.addEventListener("click", function(){ openProModal(+b.dataset.edit); }); });
    document.querySelectorAll("#proBody [data-verify]").forEach(function(b){ b.addEventListener("click", function(){ openProModal(+b.dataset.verify, true); }); });

    var act;
    document.querySelectorAll("#proBody [data-suspend]").forEach(function(b){ b.addEventListener("click", function(){
      var id=+b.dataset.suspend;
      UI.confirmAction({ title:"Suspendre ce professionnel ?", message:"Le professionnel ne sera plus visible dans les recherches.", reasonRequired:true, reasonLabel:"Raison de la suspension", confirmLabel:"Suspendre", onConfirm:function(reason){
        DATA.updateProfessional(id, { status:"suspended" });
        DATA.logAudit({ admin:AUTH.getSession().name, action:"SUSPEND_PROFESSIONAL", entity:"Professional", entityId:id, result:"Suspended", note:reason });
        UI.toast("Professionnel suspendu."); drawPros();
      }});
    }); });
    document.querySelectorAll("#proBody [data-activate]").forEach(function(b){ b.addEventListener("click", function(){
      var id=+b.dataset.activate;
      DATA.updateProfessional(id, { status:"active" });
      DATA.logAudit({ admin:AUTH.getSession().name, action:"ACTIVATE_PROFESSIONAL", entity:"Professional", entityId:id, result:"Active" });
      UI.toast("Professionnel activé."); drawPros();
    }); });
    document.querySelectorAll("#proBody [data-del]").forEach(function(b){ b.addEventListener("click", function(){
      var id=+b.dataset.del;
      UI.confirmAction({ title:"Supprimer définitivement ?", message:"Cette action est irréversible.", confirmLabel:"Supprimer", onConfirm:function(){
        DATA._store.professionals = DATA._store.professionals.filter(function(p){ return p.id!==id; });
        DATA.persist();
        DATA.logAudit({ admin:AUTH.getSession().name, action:"DELETE_PROFESSIONAL", entity:"Professional", entityId:id, result:"Deleted" });
        UI.toast("Professionnel supprimé."); drawPros();
      }});
    }); });
    (act = document.getElementById("proCheckAll")) && act.removeEventListener("change", refreshSelected);

    UI.renderPagination("proPager", pg.page, pg.total, function(p){ proState.page = p; drawPros(); });
  }

  function verBadge(p){
    if(p.verificationStatus==="approved") return '<span class="badge green">✅ Vérifié</span>';
    if(p.verificationStatus==="rejected") return '<span class="badge red">Rejeté</span>';
    if(p.verificationStatus==="needs_info") return '<span class="badge amber">Infos demandées</span>';
    return '<span class="badge amber">En attente</span>';
  }
  function pkgBadge(p){
    var map = { free:["gray","GRATUIT"], verified:["teal","VÉRIFIÉ"], gold:["orange","👑 GOLD"] };
    var m = map[p.package] || ["gray", p.package];
    return '<span class="badge '+m[0]+'">'+m[1]+'</span>';
  }
  function statusBadge(s){
    var m = { active:["green","Actif"], pending:["amber","En attente"], suspended:["red","Suspendu"], rejected:["red","Rejeté"], deleted:["gray","Supprimé"] };
    var e = m[s] || ["gray", s];
    return '<span class="badge '+e[0]+'">'+e[1]+'</span>';
  }

  function exportPros(){
    var rows = [["Nom","Profession","Ville","Catégorie","Note","Avis","Vérification","Package","Statut","ID"]];
    DATA.getProfessionals().forEach(function(p){
      rows.push([p.name, p.job, p.city, p.category, p.rating, p.reviewsCount, p.verificationStatus, p.package, p.status, p.id]);
    });
    UI.exportCSV("professionnels-sna3ti.csv", rows);
    UI.toast("Export CSV généré.");
  }

  /* ---------- Professional create/edit modal ---------- */
  function openProModal(id, verifyMode){
    var p = id ? DATA.getProfessional(id) : { id:0, name:"", job:"", category:"", city:"", area:"", price:0, phone:"", email:"", verified:false, package:"free", status:"active", rating:0, reviewsCount:0 };
    var cats = DATA.getCategories();
    var regions = DATA.getRegions();
    var cityOpts = regions.reduce(function(a,r){ return a.concat(r.cities); },[])
      .map(function(c){ return '<option value="'+esc(c.name.fr)+'" '+sel(c.name.fr, p.city)+'>'+esc(c.name.fr)+'</option>'; }).join("");

    var modalHtml =
      '<h3>'+(id?"Modifier":"Nouveau")+' professionnel</h3>' +
      (verifyMode ? '<div class="form-error" style="margin-bottom:10px">⚠️ La vérification ne remplace pas l\'approbation du centre de vérification.</div>' : "") +
      '<div class="frm">' +
        '<div class="frm"><label>Nom complet</label><input id="pmName" value="'+esc(p.name)+'"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div class="frm"><label>Métier</label><input id="pmJob" value="'+esc(p.job)+'"></div>' +
          '<div class="frm"><label>Catégorie</label><select id="pmCat">'+cats.map(function(c){ return '<option '+sel(c.label.fr, p.category)+'>'+esc(c.label.fr)+'</option>'; }).join("")+'</select></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div class="frm"><label>Ville</label><select id="pmCity">'+cityOpts+'</select></div>' +
          '<div class="frm"><label>Quartier</label><input id="pmArea" value="'+esc(p.area)+'"></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div class="frm"><label>Tarif (DH)</label><input id="pmPrice" type="number" value="'+p.price+'"></div>' +
          '<div class="frm"><label>Téléphone</label><input id="pmPhone" value="'+esc(p.phone)+'"></div>' +
        '</div>' +
        '<div class="frm"><label>Email</label><input id="pmEmail" type="email" value="'+esc(p.email)+'"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div class="frm"><label>Package</label><select id="pmPkg"><option value="free">GRATUIT</option><option value="verified" '+sel(p.package,"verified")+'>VÉRIFIÉ</option><option value="gold" '+sel(p.package,"gold")+'>GOLD</option></select></div>' +
          '<div class="frm"><label>Statut</label><select id="pmStatus">'+["active","pending","suspended","rejected"].map(function(s){return '<option '+sel(p.status,s)+'>'+s+'</option>';}).join("")+'</select></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">Annuler</button><button class="btn btn-primary" id="pmSave">'+(verifyMode?"Vérifier & enregistrer":"Enregistrer")+'</button></div>';

    UI.openModal(modalHtml);
    document.getElementById("pmSave").addEventListener("click", function(){
      var data = {
        name: document.getElementById("pmName").value.trim() || "Sans nom",
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
      if(verifyMode) data.verified = true;
      if(id){
        DATA.updateProfessional(id, data);
        UI.toast("Professionnel mis à jour.");
      } else {
        var np = Object.assign({ id: DATA._store.professionals.length? ("PRO-"+ (100000 + DATA._store.professionals.length)) : "PRO-10001", professionId:"", categoryId:"", cityId:"", rating:0, reviewsCount:0, languages:[], created:new Date().toISOString().slice(0,10), verificationStatus:"pending", identityStatus:"pending", professionStatus:"pending", verified:false, available:true, verifiedStatus:false }, data, {verified:false});
        DATA._store.professionals.push(np); DATA.persist();
        UI.toast("Professionnel créé.");
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
      var p = DATA.getProfessional(parseInt(id,10));
      if(!p){ UI.renderEmpty("Professionnel introuvable.", "🔍"); return; }
      var uid = DATA._store.users.find(function(u){ return u.id===p.userId; });
      var reviews = DATA.getReviews().filter(function(r){ return r.professionalId===p.id; });
      var sub = DATA.getSubscriptions().find(function(s){ return s.professionalId===p.id; });
      var payments = DATA.getPayments().filter(function(pa){ return pa.professionalId===p.id; });

      UI.setTitle(p.name);
      var html =
        '<div class="page-head"><h1>'+esc(p.name)+'</h1><div class="spacer">'+
          (AUTH.can("professionals","suspend") && p.status!=="suspended" ? '<button class="btn btn-warn" id="dSuspend">⏸️ Suspendre</button>' : "") +
          (AUTH.can("professionals","activate") && p.status==="suspended" ? '<button class="btn btn-soft" id="dActivate">▶️ Activer</button>' : "") +
          (AUTH.can("professionals","verify") && p.verificationStatus!=="approved" ? '<button class="btn btn-primary" id="dVerify">✅ Vérifier</button>' : "") +
          (AUTH.can("professionals","update") ? '<button class="btn btn-ghost" id="dEdit">✏️ Modifier</button>' : "") +
        '</div></div>' +
        '<div class="card" style="margin-top:0"><div class="pro" style="align-items:flex-start"><div class="p-avatar" style="width:64px;height:64px;font-size:24px">'+initials(p.name)+'</div>' +
          '<div><div style="font-size:18px;font-weight:800;font-family:var(--font-head)">'+esc(p.job)+'</div>' +
          '<div class="muted">'+esc(p.city)+' · '+esc(p.area)+' · ID '+esc(p.id)+'</div>' +
          '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+verBadge(p)+pkgBadge(p)+statusBadge(p.status)+'</div></div></div></div>' +

        '<div class="grid-2" style="margin-top:20px;align-items:start">' +
          '<div class="card"><div class="card-title">Identité</div><div class="detail-grid" style="margin-top:12px">' +
            drow("Nom complet", p.name) + drow("Téléphone", p.phone) + drow("Email", p.email) +
            drow("Identité", '<span class="badge '+(p.identityStatus==="verified"?"green":"amber")+'">'+(p.identityStatus==="verified"?"✓ Vérifiée":p.identityStatus)+'</span>') +
            drow("CIN", p.identityStatus==="verified"?"Fourni":"—") +
          '</div></div>' +
          '<div class="card"><div class="card-title">Professionnel</div><div class="detail-grid" style="margin-top:12px">' +
            drow("Métier", p.job) + drow("Expérience", p.experience||"—") + drow("Langues", (p.languages||[]).join(", ")) +
            drow("Disponibilité", p.available?"Disponible":"Indisponible") + drow("Vérification pro", p.professionStatus==="verified"?"🛡️ Professionnel Vérifié":p.professionStatus) +
          '</div></div>' +
        '</div>' +

        '<div class="grid-2" style="margin-top:20px;align-items:start">' +
          '<div class="card"><div class="card-title">Abonnement</div>' + subSection(sub) + '</div>' +
          '<div class="card"><div class="card-title">Leads & activité</div><div class="feed" style="margin-top:10px">' +
            '<div class="feed-item"><div class="feed-dot teal"></div><div class="f-txt"><b>1 240</b> clics WhatsApp</div></div>' +
            '<div class="feed-item"><div class="feed-dot teal"></div><div class="f-txt"><b>842</b> clics téléphone</div></div>' +
            '<div class="feed-item"><div class="feed-dot orange"></div><div class="f-txt"><b>437</b> demandes de contact</div></div>' +
            '<div class="feed-item"><div class="feed-dot green"></div><div class="f-txt">Taux de conversion <b>3.4%</b></div></div>' +
          '</div></div>' +
        '</div>' +

        '<div class="card"><div class="card-head"><div class="card-title">Avis ('+reviews.length+')</div></div>' +
          (reviews.length ? reviews.map(function(r){
            return '<div class="row-item"><div class="grow"><div>'+mkStars(r.rating)+' '+esc(r.customer)+'</div><div class="muted">'+esc(r.comment)+'</div></div><span class="badge '+(r.status==="flagged"?"red":r.status==="pending"?"amber":"green")+'">'+esc(r.status)+'</span></div>';
          }).join("") : '<div class="empty">Aucun avis.</div>') +
        '</div>';

      UI.setContent(html);

      var ds = document.getElementById("dSuspend"); if(ds) ds.addEventListener("click", function(){
        UI.confirmAction({ title:"Suspendre ce professionnel ?", reasonRequired:true, reasonLabel:"Raison", confirmLabel:"Suspendre", onConfirm:function(reason){
          DATA.updateProfessional(p.id, { status:"suspended" }); DATA.logAudit({admin:AUTH.getSession().name, action:"SUSPEND_PROFESSIONAL", entity:"Professional", entityId:p.id, result:"Suspended", note:reason}); UI.toast("Professionnel suspendu."); renderProfessionalDetail(id);
        }});
      });
      var da = document.getElementById("dActivate"); if(da) da.addEventListener("click", function(){
        DATA.updateProfessional(p.id, { status:"active" }); DATA.logAudit({admin:AUTH.getSession().name, action:"ACTIVATE_PROFESSIONAL", entity:"Professional", entityId:p.id, result:"Active"}); UI.toast("Professionnel activé."); renderProfessionalDetail(id);
      });
      var dv = document.getElementById("dVerify"); if(dv) dv.addEventListener("click", function(){
        UI.confirmAction({ title:"Vérifier ce professionnel ?", message:"Approuve la vérification professionnelle.", confirmLabel:"Vérifier", onConfirm:function(){
          DATA.updateProfessional(p.id, { verificationStatus:"approved", verified:true, professionStatus:"verified" }); DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFY_PROFESSIONAL", entity:"Professional", entityId:p.id, result:"Approved"}); UI.toast("Professionnel vérifié."); renderProfessionalDetail(id);
        }});
      });
      var de = document.getElementById("dEdit"); if(de) de.addEventListener("click", function(){ openProModal(p.id); });
    }, 300);
  }

  function subSection(sub){
    if(!sub) return '<div class="empty" style="padding:20px">Aucun abonnement.</div>';
    return '<div class="detail-grid" style="margin-top:12px">' +
      drow("Plan", pkgBadge({package: sub.planName.toLowerCase()==="gold"?"gold":sub.planName.toLowerCase()==="vérifié"?"verified":"free"})) +
      drow("Prix", sub.price+" DH") + drow("Début", sub.since) + drow("Renouvellement", sub.renewal) +
      drow("Statut", statusBadge(sub.status)) + drow("Paiement", '<span class="badge '+ (sub.paymentStatus==="confirmed"?"green":"amber")+'">'+esc(sub.paymentStatus)+'</span>') +
    '</div>';
  }
  function drow(k, v){ return '<div class="detail-row"><div class="dk">'+esc(k)+'</div><div class="dv">'+v+'</div></div>'; }
  function mkStars(r){ var h=""; for(var i=1;i<=5;i++){ h+='<span class="star">'+(i<=Math.round(r)?"★":"☆")+'</span>'; } return h; }

  /* ============================================================
     USERS
     ============================================================ */
  function renderUsers(){
    UI.setTitle("Utilisateurs");
    var html =
      '<div class="page-head"><h1>Utilisateurs</h1><div class="spacer"><button class="btn btn-ghost" id="uExport">⬇ Exporter</button></div></div>' +
      '<div class="card"><div class="toolbar"><div class="field"><label>Recherche</label><input type="search" id="uQ" placeholder="Nom, email, téléphone..."></div>' +
        '<div class="field"><label>Statut</label><select id="uStatus"><option value="">Tous</option>'+["active","suspended","blocked","deleted"].map(function(s){return '<option>'+s+'</option>';}).join("")+'</select></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Utilisateur</th><th>Email</th><th>Téléphone</th><th>Ville</th><th>Inscrit</th><th>Statut</th><th>Actions</th></tr></thead><tbody id="uBody"></tbody></table></div></div>';
    UI.setContent(html);
    document.getElementById("uQ").addEventListener("input", UI.debounce(drawUsers, 220));
    document.getElementById("uStatus").addEventListener("change", drawUsers);
    document.getElementById("uExport").addEventListener("click", function(){
      var rows=[["Nom","Email","Téléphone","Ville","Inscrit","Statut"]]; DATA.getUsers().forEach(function(u){ rows.push([u.name,u.email,u.phone||"",cityFr(u.cityId),u.registered,u.status]); });
      UI.exportCSV("utilisateurs-sna3ti.csv", rows); UI.toast("Export généré.");
    });
    drawUsers();
  }
  function cityFr(id){ var n=SUBCITY(id); return n; }
  function SUBCITY(id){ var c=DATA.getRegions().reduce(function(a,r){return a.concat(r.cities);},[]).find(function(x){return x.id===id;}); return c?c.name.fr:"—"; }
  function drawUsers(){
    var q=(document.getElementById("uQ").value||"").toLowerCase();
    var st=document.getElementById("uStatus").value;
    var list=DATA.getUsers({q:q, status:st||undefined});
    document.getElementById("uBody").innerHTML = list.length ? list.map(function(u){
      return '<tr><td><div class="pro"><div class="p-avatar">'+initials(u.name)+'</div><div class="pro-name">'+esc(u.name)+'</div></div></td>' +
        '<td>'+esc(u.email)+'</td><td>'+esc(u.phone||"—")+'</td><td>'+esc(cityFr(u.cityId))+'</td><td>'+u.registered+'</td>' +
        '<td>'+userStatusBadge(u.status)+'</td>' +
        '<td class="actions-cell">' +
          (AUTH.can("users","suspend") && u.status==="active" ? '<button class="icon-act" title="Suspendre" data-susp="'+u.id+'" style="color:var(--amber)">⏸️</button>':"") +
          (AUTH.can("users","suspend") && u.status!=="active" ? '<button class="icon-act" title="Activer" data-act="'+u.id+'" style="color:var(--green)">▶️</button>':"") +
          (AUTH.can("users","delete") ? '<button class="icon-act danger" title="Supprimer" data-del="'+u.id+'">🗑️</button>':"") +
        '</td></tr>';
    }).join("") : '<tr><td colspan="7"><div class="empty">Aucun utilisateur.</div></td></tr>';

    document.querySelectorAll("#uBody [data-susp]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.susp;
      UI.confirmAction({title:"Suspendre cet utilisateur ?", reasonRequired:true, reasonLabel:"Raison de la suspension", confirmLabel:"Suspendre", onConfirm:function(reason){
        DATA.updateUser(id, {status:"suspended"}); DATA.logAudit({admin:AUTH.getSession().name, action:"SUSPEND_USER", entity:"User", entityId:id, result:"Suspended", note:reason}); UI.toast("Utilisateur suspendu."); drawUsers();
      }});
    }); });
    document.querySelectorAll("#uBody [data-act]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.act; DATA.updateUser(id, {status:"active"}); DATA.logAudit({admin:AUTH.getSession().name, action:"ACTIVATE_USER", entity:"User", entityId:id, result:"Active"}); UI.toast("Utilisateur activé."); drawUsers();
    }); });
    document.querySelectorAll("#uBody [data-del]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.del;
      UI.confirmAction({title:"Supprimer cet utilisateur ?", message:"Action irréversible.", confirmLabel:"Supprimer", onConfirm:function(){
        DATA._store.users=DATA._store.users.filter(function(u){return u.id!==id;}); UI.toast("Utilisateur supprimé."); drawUsers();
      }});
    }); });
  }
  function userStatusBadge(s){ var m={active:["green","Actif"],suspended:["amber","Suspendu"],blocked:["red","Bloqué"],deleted:["gray","Supprimé"]}; var e=m[s]||["gray",s]; return '<span class="badge '+e[0]+'">'+e[1]+'</span>'; }

  /* ============================================================
     VERIFICATION CENTER
     ============================================================ */
  function renderVerification(){
    UI.setTitle("Centre de vérification");
    var all = DATA.getVerificationRequests();
    var html =
      '<div class="page-head"><h1>Vérification</h1><div class="spacer muted">Vérification et abonnement sont indépendants.</div></div>' +
      '<div class="tabs">' +
        tabBtn("all", "Toutes", all.length) + tabBtn("pending", "En attente", count(all,"pending")) +
        tabBtn("needs_info", "Infos demandées", count(all,"needs_info")) + tabBtn("approved", "Approuvées", count(all,"approved")) + tabBtn("rejected", "Rejetées", count(all,"rejected")) +
      '</div><div id="verList"></div>';
    UI.setContent(html);
    drawVerification("all");
  }
  function count(list, s){ return list.filter(function(v){ return v.status===s; }).length; }
  function tabBtn(id, label, n){ return '<button class="tab" data-tab="'+id+'">'+label+' <span class="cnt">'+n+'</span></button>'; }
  function drawVerification(filter){
    document.querySelectorAll("#content .tab").forEach(function(t){
      t.classList.toggle("active", t.dataset.tab===filter);
      t.onclick=function(){ drawVerification(t.dataset.tab); };
    });
    var list = DATA.getVerificationRequests({ status: filter==="all"?"":filter });
    var el = document.getElementById("verList");
    if(!list.length){ el.innerHTML='<div class="empty">Aucune demande.</div>'; return; }
    el.innerHTML = list.map(function(v){
      var p = DATA.getProfessional(v.professionalId);
      var steps = '<span class="step '+(v.level==="identity"||v.level==="professionnel"?"done":"")+'">1. Identité</span>' +
                  '<span class="step '+(v.level==="professionnel"?"done":"")+'">2. Professionnel</span>';
      return '<div class="req"><div class="req-top"><div class="grow">' +
        '<div class="pro"><div class="p-avatar">'+initials(p?p.name:"?")+'</div><div><div class="pro-name">'+esc(p?p.name:"?")+'</div><div class="pro-job">'+esc(p?p.job+" · "+p.city:"")+'</div></div></div></div>' +
        '<span class="badge '+(v.status==="pending"?"amber":v.status==="approved"?"green":"red")+'">'+esc(v.status)+'</span></div>' +
        '<div class="verif-steps">'+steps+'</div>' +
        '<div class="muted" style="margin-top:8px">Soumis le '+v.submitted+' · '+v.level+'</div>' +
        '<div class="req-actions">' +
          '<button class="btn btn-ghost btn-small" data-audit="'+v.id+'">📜 Historique</button>' +
          (AUTH.can("verification","reject") ? '<button class="btn btn-danger btn-small" data-reject="'+v.id+'">✖ Rejeter</button>' : "") +
          (AUTH.can("verification","approve") && v.status!=="approved" ? '<button class="btn btn-primary btn-small" data-approve="'+v.id+'">✓ Approuver</button>' : "") +
          (AUTH.can("verification","approve") ? '<button class="btn btn-soft btn-small" data-review="'+v.id+'">🔍 Réviser</button>' : "") +
        '</div></div>';
    }).join("");
    bindVerification();
  }
  // store checklist progress per professional
  global.__verCheck = {};
  function bindVerification(){
    document.querySelectorAll("[data-audit]").forEach(function(b){ b.addEventListener("click", function(){ showVerHistory(+b.dataset.audit); }); });
    document.querySelectorAll("[data-approve]").forEach(function(b){ b.addEventListener("click", function(){ quickApprove(+b.dataset.approve); }); });
    document.querySelectorAll("[data-reject]").forEach(function(b){ b.addEventListener("click", function(){ rejectVer(+b.dataset.reject); }); });
    document.querySelectorAll("[data-review]").forEach(function(b){ b.addEventListener("click", function(){ openReview(+b.dataset.review); }); });
  }
  function showVerHistory(id){
    var v = DATA.getVerificationRequests().find(function(x){ return x.id===id; });
    var p = DATA.getProfessional(v.professionalId);
    UI.openModal('<h3>Historique de vérification</h3><p class="muted" style="font-size:13px">'+esc(p.name)+' — '+esc(v.id)+'</p><div class="timeline" style="margin:14px 0">'+
      (v.history||[]).map(function(h){ return '<div class="tl-item"><div class="t-txt">'+esc(h.text)+'</div><div class="t-when">'+esc(h.date)+'</div></div>'; }).join("") +
      '</div><div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">Fermer</button></div>');
  }
  function quickApprove(id){
    UI.confirmAction({ title:"Approuver cette vérification ?", confirmLabel:"Approuver", onConfirm:function(){
      DATA.approveVerification(id, AUTH.getSession().name);
      DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFY_PROFESSIONAL", entity:"VerificationRequest", entityId:id, result:"Approved"});
      UI.toast("Vérification approuvée."); drawVerification(currentFilter()); updatePillsSafe();
    }});
  }
  function currentFilter(){ var a=document.querySelector(".tab.active"); return a?a.dataset.tab:"all"; }
  function updatePillsSafe(){ try{ UI.setActiveNav("verification"); }catch(e){} }
  function rejectVer(id){
    UI.confirmAction({ title:"Rejeter cette vérification ?", reasonRequired:true, reasonLabel:"Raison du rejet", confirmLabel:"Rejeter", onConfirm:function(reason){
      DATA.rejectVerification(id, reason, AUTH.getSession().name);
      DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFICATION_REJECTED", entity:"VerificationRequest", entityId:id, result:"Rejected", note:reason});
      UI.toast("Vérification rejetée."); drawVerification(currentFilter());
    }});
  }
  function openReview(id){
    var v = DATA.getVerificationRequests().find(function(x){ return x.id===id; });
    if(!v) return;
    var p = DATA.getProfessional(v.professionalId);
    var cfg = DATA.getConfig().verification;
    var checks = global.__verCheck[id] || {};
    var html =
      '<h3>Examen de vérification</h3>' +
      '<div class="review-workspace" style="grid-template-columns:220px 1fr 260px;gap:16px">' +
        '<div class="rw-col"><h4>Professionnel</h4><div class="pro"><div class="p-avatar" style="width:44px;height:44px">'+initials(p.name)+'</div><div><div class="pro-name">'+esc(p.name)+'</div><div class="pro-job">'+esc(p.job)+'</div></div></div>' +
          '<div class="detail-grid" style="margin-top:14px">'+drow("Ville", p.city)+drow("Expérience", p.experience||"—")+drow("Niveau", v.level)+'</div></div>' +
        '<div class="rw-col"><h4>Documents & portfolio</h4>' +
          (v.documents||[]).map(function(d){ return '<div class="doc">📄 '+esc(d)+'</div>'; }).join("") +
          '<div class="muted" style="margin-top:12px">Portfolio : 6 images fournies (aperçu dans la version finale).</div></div>' +
        '<div class="rw-col"><h4>Liste de contrôle</h4><div class="checklist" id="verChecks">' +
          cfg.requiredChecks.map(function(c){
            return '<label><input type="checkbox" data-check="'+c+'" '+(checks[c]?"checked":"")+'><span>'+esc(cfg.checkLabels[c]||c)+'</span></label>';
          }).join("") +
        '</div>' +
          '<div class="modal-actions" style="justify-content:flex-start;margin-top:16px">' +
            (AUTH.can("verification","reject")?'<button class="btn btn-danger" id="rvReject">Rejeter</button>':"") +
            (AUTH.can("verification","approve")?'<button class="btn btn-primary" id="rvApprove" '+(allChecksDone(checks)?"":"disabled")+'>Approuver</button>':"") +
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
      if(!allChecksDone(global.__verCheck[v.id]||{})){ UI.toast("Complétez d'abord la liste de contrôle.", true); return; }
      UI.closeModal();
      DATA.approveVerification(id, AUTH.getSession().name);
      DATA.logAudit({admin:AUTH.getSession().name, action:"VERIFY_PROFESSIONAL", entity:"VerificationRequest", entityId:id, result:"Approved"});
      UI.toast("Vérification approuvée."); drawVerification(currentFilter()); updatePillsSafe();
    });
    var rj = document.getElementById("rvReject"); if(rj) rj.addEventListener("click", function(){
      UI.closeModal(); rejectVer(id);
    });
  }

  /* ============================================================
     CATEGORIES & CITIES
     ============================================================ */
  function renderCategories(){
    UI.setTitle("Catégories");
    var cats = DATA.getCategories();
    UI.setContent(
      '<div class="page-head"><h1>Catégories</h1><div class="spacer">'+
        (AUTH.can("categories","update")?'<button class="btn btn-primary" id="cAdd">+ Catégorie</button>':"")+'</div></div>' +
      '<div class="grid-2" style="align-items:start"><div class="card">'+
        cats.map(function(c){
          return '<div class="row-item"><div class="grow"><b style="display:flex;gap:8px"><span>'+c.icon+'</span> '+esc(c.label.fr)+'</b>'+
            '<div class="muted">FR: '+esc(c.label.fr)+' · AR: '+esc(c.label.ar)+' · EN: '+esc(c.label.en)+'</div>'+
            '<div class="chip-grid" style="margin-top:8px">'+(c.services||[]).map(function(s){ return '<span class="chip">'+esc(s.label.fr)+'</span>'; }).join("")+'</div></div>'+
            '<span class="badge '+(c.active?"green":"gray")+'">'+(c.active?"Actif":"Inactif")+'</span>'+
            (AUTH.can("categories","update")?'<button class="icon-act" data-delcat="'+c.id+'" title="Supprimer">🗑️</button>':"")+'</div>';
        }).join("") +
      '</div><div class="card"><div class="card-title">Structure</div><div class="muted" style="margin-top:8px">Catégorie → Services (normalisés multilingue FR/AR/EN).<br>Exemple : Plomberie → Fuite d’eau, Débouchage, Chauffe-eau, Installation.</div></div></div>'
    );
    document.querySelectorAll("[data-delcat]").forEach(function(b){ b.addEventListener("click", function(){
      var id=b.dataset.delcat;
      UI.confirmAction({title:"Supprimer cette catégorie ?", confirmLabel:"Supprimer", onConfirm:function(){
        DATA._store.categories=DATA._store.categories.filter(function(c){return c.id!==id;}); DATA.logAudit({admin:AUTH.getSession().name, action:"CATEGORY_CHANGED", entity:"Category", entityId:id, result:"Deleted"}); UI.toast("Catégorie supprimée."); renderCategories();
      }});
    }); });
    var add=document.getElementById("cAdd"); if(add) add.addEventListener("click", function(){
      var fr=prompt("Nom (FR) :"), ar=prompt("Nom (AR) :"), en=prompt("Nom (EN) :"), ic=prompt("Icône (emoji) :")||"📁";
      if(fr&&fr.trim()){ DATA._store.categories.push({id:"CAT-"+Date.now(), code:"", icon:ic, order:DATA._store.categories.length+1, active:true, label:{fr:fr.trim(),ar:ar||"",en:en||""}, services:[]}); UI.toast("Catégorie ajoutée."); renderCategories(); }
    });
  }

  function renderCities(){
    UI.setTitle("Villes");
    var regions = DATA.getRegions();
    UI.setContent(
      '<div class="page-head"><h1>Villes & localisation</h1></div>' +
      (AUTH.can("cities","update")?'<div class="card" style="margin-top:0"><div class="card-title">Structure Région → Villes → Quartiers</div></div>':"") +
      regions.map(function(r){
        return '<div class="card"><div class="card-head"><div class="card-title">'+esc(r.name.fr)+'</div></div>' + r.cities.map(function(c){
          return '<div class="row-item"><div class="grow"><b>'+esc(c.name.fr)+'</b> <span class="muted">('+esc(c.name.ar)+' / '+esc(c.name.en)+')</span>'+
            '<div class="chip-grid" style="margin-top:8px">'+(c.neighborhoods||[]).map(function(n){return '<span class="chip">'+esc(n)+'</span>';}).join("")+'</div></div></div>';
        }).join("") + '</div>';
      }).join("")
    );
  }

  /* ============================================================
     REVIEWS
     ============================================================ */
  function renderReviews(){
    UI.setTitle("Avis");
    var html =
      '<div class="tabs">'+["all","published","pending","flagged","hidden"].map(function(s,i){
        var list = DATA.getReviews(); var n = list.length; if(s!=="all") n = list.filter(function(r){return r.status===s;}).length;
        return '<button class="tab '+(i===0?"active":"")+'" data-s="'+s+'">'+esc(s)+' <span class="cnt">'+n+'</span></button>';
      }).join("")+'</div><div id="revBody"></div>';
    UI.setContent(html);
    drawReviews("all");
  }
  function drawReviews(filter){
    document.querySelectorAll("#content .tab").forEach(function(t){
      t.classList.toggle("active", t.dataset.s===filter);
      t.onclick=function(){ drawReviews(t.dataset.s); };
    });
    var list = DATA.getReviews({ status: filter==="all"?"":filter });
    var el = document.getElementById("revBody");
    if(!list.length){ el.innerHTML='<div class="empty">Aucun avis.</div>'; return; }
    el.innerHTML =
      '<div class="card"><div class="table-wrap"><table><thead><tr><th>Client</th><th>Professionnel</th><th>Note</th><th>Commentaire</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead><tbody>' +
      list.map(function(r){
        var p = DATA.getProfessional(r.professionalId);
        return '<tr><td><b>'+esc(r.customer)+'</b></td><td>'+esc(p?p.name:"—")+'</td><td>'+mkStars(r.rating)+'</td><td style="max-width:260px">'+esc(r.comment)+'</td><td>'+r.date+'</td><td>'+revStatus(r.status)+'</td>'+
          '<td class="actions-cell">'+
            (AUTH.can("reviews","moderate") && r.status!=="published" ? '<button class="icon-act" data-pub="'+r.id+'" title="Publier" style="color:var(--green)">✓</button>':"") +
            (AUTH.can("reviews","moderate") && r.status!=="flagged" ? '<button class="icon-act" data-flag="'+r.id+'" title="Signaler/suspect" style="color:var(--amber)">🚩</button>':"") +
            (AUTH.can("reviews","moderate") ? '<button class="icon-act" data-hide="'+r.id+'" title="Masquer" style="color:var(--muted)">🙈</button>':"") +
            (AUTH.can("reviews","delete") ? '<button class="icon-act danger" data-delrev="'+r.id+'" title="Supprimer">🗑️</button>':"") +
          '</td></tr>';
      }).join("") + '</tbody></table></div></div>';
    document.querySelectorAll("[data-pub]").forEach(function(b){ b.addEventListener("click", function(){ setRev(+"b".replace("b",b.dataset.pub), "published"); }); });
    document.querySelectorAll("[data-flag]").forEach(function(b){ b.addEventListener("click", function(){ setRev(+b.dataset.flag, "flagged"); }); });
    document.querySelectorAll("[data-hide]").forEach(function(b){ b.addEventListener("click", function(){ setRev(+b.dataset.hide, "hidden"); }); });
    document.querySelectorAll("[data-delrev]").forEach(function(b){ b.addEventListener("click", function(){
      var id=+b.dataset.delrev;
      UI.confirmAction({title:"Supprimer cet avis ?", confirmLabel:"Supprimer", onConfirm:function(){
        DATA._store.reviews=DATA._store.reviews.filter(function(r){return r.id!==id;}); DATA.logAudit({admin:AUTH.getSession().name, action:"REVIEW_DELETED", entity:"Review", entityId:id, result:"Deleted"}); UI.toast("Avis supprimé."); drawReviews(currentReviewFilter());
      }});
    }); });
  }
  function currentReviewFilter(){ var a=document.querySelector(".tab.active"); return a?a.dataset.s:"all"; }
  function setRev(id, status){ var r=DATA._store.reviews.find(function(x){return x.id===id;}); if(r){ r.status=status; DATA.logAudit({admin:AUTH.getSession().name, action:"REVIEW_"+status.toUpperCase(), entity:"Review", entityId:id, result:status}); UI.toast("Avis "+status+"."); drawReviews(currentReviewFilter()); } }
  function revStatus(s){ var m={published:["green","Publié"],pending:["amber","En attente"],flagged:["red","Signalé"],hidden:["gray","Masqué"],deleted:["gray","Supprimé"]}; var e=m[s]||["gray",s]; return '<span class="badge '+e[0]+'">'+e[1]+'</span>'; }

  /* ============================================================
     REPORTS
     ============================================================ */
  function renderReports(){
    UI.setTitle("Centre de modération");
    var html =
      '<div class="tabs">'+["all","new","under_review","resolved","rejected"].map(function(s,i){
        var list=DATA.getReports(); var n=list.length; if(s!=="all") n=list.filter(function(r){return r.status===s;}).length;
        return '<button class="tab '+(i===0?"active":"")+'" data-s="'+s+'">'+esc(s)+' <span class="cnt">'+n+'</span></button>';
      }).join("")+'</div><div id="repBody"></div>';
    UI.setContent(html);
    drawReports("all");
  }
  function reportReasons(){ return ["Faux professionnel","Fraude","Faux avis","Spam","Contenu inapproprié","Mauvaise information","Harcèlement","Réclamation client"]; }
  function drawReports(filter){
    document.querySelectorAll("#content .tab").forEach(function(t){
      t.classList.toggle("active", t.dataset.s===filter);
      t.onclick=function(){ drawReports(t.dataset.s); };
    });
    var list = DATA.getReports({ status: filter==="all"?"":filter });
    var el = document.getElementById("repBody");
    if(!list.length){ el.innerHTML='<div class="empty">Aucun signalement.</div>'; return; }
    el.innerHTML = list.map(function(r){
      var p = DATA.getProfessional(r.professionalId);
      return '<div class="req"><div class="req-top"><div class="grow"><div class="pro"><div class="p-avatar">'+initials(p?p.name:"?")+'</div>'+
        '<div><div class="pro-name">'+esc(p?p.name:"?")+'</div><div class="pro-job">'+esc(r.reason)+'</div></div></div></div>'+
        '<span class="badge '+(r.status==="new"?"red":r.status==="under_review"?"amber":"green")+'">'+esc(r.status)+'</span></div>'+
        '<div class="muted" style="margin:8px 0">'+esc(r.description)+'<br>Signalé par '+esc(r.reporter)+' le '+r.date+'</div>'+
        '<div class="req-actions">'+
          '<button class="btn btn-ghost btn-small" data-viewpro="'+r.professionalId+'">👤 Voir</button>'+
          (r.status!=="resolved"?
            '<button class="btn btn-primary btn-small" data-resolve="'+r.id+'" '+(AUTH.can("reports","resolve")?"":"disabled")+'>✓ Résoudre</button>'+
            '<button class="btn btn-danger btn-small" data-warn="'+r.id+'" '+(AUTH.can("reports","warn")?"":"disabled")+'>⚠️ Avertir</button>'+
            '<button class="btn btn-warn btn-small" data-susprof="'+r.id+'" '+(AUTH.can("reports","suspend")?"":"disabled")+'>⏸️ Suspendre</button>'+
            '<button class="btn btn-ghost btn-small" data-rejectrep="'+r.id+'" '+(AUTH.can("reports","resolve")?"":"disabled")+'>Rejeter</button>': '<span class="badge green">Traité</span>')+
        '</div></div>';
    }).join("");
    document.querySelectorAll("[data-viewpro]").forEach(function(b){ b.addEventListener("click", function(){ ROUTER.navigate("professionals/"+b.dataset.viewpro); }); });
    document.querySelectorAll("[data-resolve]").forEach(function(b){ b.addEventListener("click", function(){ setReport(+b.dataset.resolve, "resolved"); }); });
    document.querySelectorAll("[data-rejectrep]").forEach(function(b){ b.addEventListener("click", function(){ setReport(+b.dataset.rejectrep, "rejected"); }); });
    document.querySelectorAll("[data-warn]").forEach(function(b){ b.addEventListener("click", function(){
      UI.confirmAction({title:"Avertir le professionnel ?", reasonRequired:true, reasonLabel:"Motif de l'avertissement", confirmLabel:"Avertir", onConfirm:function(reason){
        setReport(+b.dataset.warn, "under_review"); UI.toast("Avertissement enregistré.");
      }});
    }); });
    document.querySelectorAll("[data-susprof]").forEach(function(b){ b.addEventListener("click", function(){
      UI.confirmAction({title:"Suspendre le professionnel ?", reasonRequired:true, reasonLabel:"Raison", confirmLabel:"Suspendre", onConfirm:function(reason){
        var r=DATA._store.reports.find(function(x){return x.id===+b.dataset.susprof;}); if(r){ DATA.updateProfessional(r.professionalId,{status:"suspended"}); r.status="resolved"; DATA.logAudit({admin:AUTH.getSession().name, action:"SUSPEND_PROFESSIONAL", entity:"Professional", entityId:r.professionalId, result:"Suspended", note:reason}); } UI.toast("Professionnel suspendu."); drawReports(currentReportFilter());
      }});
    }); });
  }
  function currentReportFilter(){ var a=document.querySelector(".tab.active"); return a?a.dataset.s:"all"; }
  function setReport(id, status){ var r=DATA._store.reports.find(function(x){return x.id===id;}); if(r){ r.status=status; DATA.logAudit({admin:AUTH.getSession().name, action:"REPORT_"+status.toUpperCase(), entity:"Report", entityId:id, result:status}); UI.toast("Signalement "+status+"."); drawReports(currentReportFilter()); } }

  /* ============================================================
     SUBSCRIPTIONS / PLANS
     ============================================================ */
  function renderSubscriptions(){
    UI.setTitle("Abonnements");
    var plans = DATA.getSubscriptionPlans();
    var subs = DATA.getSubscriptions();
    var html = '<div class="page-head"><h1>Abonnements</h1><div class="spacer muted">Vérification ≠ abonnement.</div></div>' +
      '<div class="grid-3">'+ plans.map(function(pl){
        var count = subs.filter(function(s){ return s.planName===pl.name; }).length;
        return '<div class="plan-card '+(pl.hot?"hot":"")+'"><div class="p-name" style="color:'+(pl.badge==="orange"?"var(--orange)":pl.badge==="teal"?"var(--teal)":"var(--muted)")+'">'+esc(pl.name)+'</div>'+
          '<div class="p-price">'+pl.price+' <span class="muted small">DH / '+esc(pl.period)+'</span></div>'+
          '<div class="muted" style="margin:4px 0 10px">'+esc(pl.description)+'</div>'+
          '<span class="badge '+(pl.active?"green":"gray")+'">'+(pl.active?"Actif":"Inactif")+'</span> <span class="muted small">· '+count+' abonné(s)</span>'+
          (AUTH.can("subscriptions","update")?'<div class="modal-actions" style="margin-top:14px;justify-content:flex-start"><button class="btn btn-ghost btn-small" data-subsedit="'+pl.id+'">✏️ Modifier</button><button class="btn btn-ghost btn-small" data-subsview="'+pl.id+'">Abonnés</button></div>':"")+
          '</div>';
      }).join("") + '</div>' +
      '<div class="card"><div class="card-title">Abonnés</div><div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Professionnel</th><th>Plan</th><th>Prix</th><th>Début</th><th>Renouvellement</th><th>Statut</th><th>Paiement</th></tr></thead><tbody>'+
      subs.map(function(s){
        var p=DATA.getProfessional(s.professionalId);
        var pkg = s.planName.toLowerCase()==="gold"?"gold":s.planName.toLowerCase()==="vérifié"||s.planName.toLowerCase()==="verifié"?"verified":"free";
        return '<tr><td><div class="pro"><div class="p-avatar">'+initials(p?p.name:"?")+'</div><div class="pro-name">'+esc(p?p.name:"?")+'</div></div></td>'+
          '<td>'+pkgBadge({package:pkg})+'</td><td>'+s.price+' DH</td><td>'+s.since+'</td><td>'+s.renewal+'</td>'+
          '<td>'+statusBadge(s.status)+'</td><td>'+payStatusBadge(s.paymentStatus)+'</td></tr>';
      }).join("") + '</tbody></table></div></div>';
    UI.setContent(html);
    document.querySelectorAll("[data-subsedit]").forEach(function(b){ b.addEventListener("click", function(){ editPlan(b.dataset.subsedit); }); });
    document.querySelectorAll("[data-subsview]").forEach(function(b){ b.addEventListener("click", function(){ viewPlanSubs(b.dataset.subsview); }); });
  }
  function payStatusBadge(s){ var m={confirmed:["green","Confirmé"],pending:["amber","En attente"],rejected:["red","Rejeté"],refunded:["gray","Remboursé"]}; var e=m[s]||["gray",s]; return '<span class="badge '+e[0]+'">'+e[1]+'</span>'; }
  function editPlan(id){
    var pl = DATA.getSubscriptionPlans().find(function(x){ return x.id===id; });
    UI.openModal('<h3>Modifier le plan '+esc(pl.name)+'</h3><div class="frm">'+
      '<div class="frm"><label>Nom</label><input id="plName" value="'+esc(pl.name)+'"></div>'+
      '<div class="frm"><label>Prix (DH)</label><input id="plPrice" type="number" value="'+pl.price+'"></div>'+
      '<div class="frm"><label>Description</label><input id="plDesc" value="'+esc(pl.description)+'"></div>'+
      '<div class="frm"><label>Avantages (un par ligne)</label><textarea id="plFeats">'+esc(pl.advantages.join("\n"))+'</textarea></div>'+
      '</div><div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">Annuler</button><button class="btn btn-primary" id="plSave">Enregistrer</button></div>');
    document.getElementById("plSave").addEventListener("click", function(){
      var old=pl.price;
      var data={ name:document.getElementById("plName").value, price:parseInt(document.getElementById("plPrice").value)||0, description:document.getElementById("plDesc").value, advantages:document.getElementById("plFeats").value.split("\n").filter(Boolean) };
      DATA.updateSubscriptionPlan(id, data);
      if(data.price!==old) DATA.logAudit({admin:AUTH.getSession().name, action:"PRICE_CHANGED", entity:"SubscriptionPlan", entityId:id, prev:old+" DH", next:data.price+" DH", result:"Updated"});
      UI.toast("Plan mis à jour."); UI.closeModal(); renderSubscriptions();
    });
  }
  function viewPlanSubs(id){
    var pl = DATA.getSubscriptionPlans().find(function(x){ return x.id===id; });
    UI.openModal('<h3>Abonnés — '+esc(pl.name)+'</h3>'+(DATA.getSubscriptions().filter(function(s){return s.planName===pl.name;}).length?'':'<div class="empty">Aucun abonné.</div>'), true);
  }

  /* ============================================================
     PAYMENTS + BANK TRANSFER WORKFLOW
     ============================================================ */
  function renderPayments(){
    UI.setTitle("Paiements");
    var pays = DATA.getPayments();
    UI.setContent(
      '<div class="page-head"><h1>Paiements</h1><div class="spacer muted">Virements bancaires manuels confirmés après contrôle.</div></div>' +
      '<div class="card"><div class="table-wrap"><table><thead><tr><th>Référence</th><th>Professionnel</th><th>Plan</th><th>Montant</th><th>Méthode</th><th>Réf. bancaire</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead><tbody>'+
      pays.map(function(pa){
        var p = DATA.getProfessional(pa.professionalId);
        return '<tr><td><b>'+esc(pa.reference)+'</b></td><td><div class="pro"><div class="p-avatar">'+initials(p?p.name:"?")+'</div><div class="pro-name">'+esc(p?p.name:"?")+'</div></div></td>'+
          '<td>'+esc(pa.planName)+'</td><td><b>'+pa.amount+' DH</b></td><td>'+esc(pa.method==="bank_transfer"?"🏦 Virement":pa.method)+'</td><td>'+esc(pa.reference||"—")+'</td><td>'+pa.date+'</td>'+
          '<td>'+payStatusBadge(pa.status)+'</td>'+
          '<td class="actions-cell">'+
            (AUTH.can("payments","approve") && pa.status==="pending" ? '<button class="icon-act" data-confp="'+pa.id+'" title="Confirmer" style="color:var(--green)">✓</button>' : "") +
            (AUTH.can("payments","reject") && pa.status==="pending" ? '<button class="icon-act danger" data-rejp="'+pa.id+'" title="Rejeter">✖</button>' : "") +
            '<button class="icon-act" data-whats="'+pa.id+'" title="Discuter sur WhatsApp">💬</button>' +
          '</td></tr>';
      }).join("") + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-title">Workflow virement bancaire</div>' +
      '<div class="verif-steps" style="margin-top:10px"><span class="step done">1. Professionnel choisit le plan</span><span class="step current">2. Virement bancaire</span><span class="step">3. Reçu téléversé</span><span class="step">4. Paiement = En attente</span><span class="step">5. Finance/Admin vérifie</span><span class="step">6. Confirmer/Rejeter</span><span class="step">7. Abonnement activé</span></div>' +
      '<p class="muted" style="margin-top:12px">La confirmation du paiement se fait après vérification du virement. Les réceptions de confirmation sont échangées via WhatsApp.</p></div>'
    );
    document.querySelectorAll("[data-confp]").forEach(function(b){ b.addEventListener("click", function(){ confirmPayment(+b.dataset.confp); }); });
    document.querySelectorAll("[data-rejp]").forEach(function(b){ b.addEventListener("click", function(){ rejectPayment(+b.dataset.rejp); }); });
    document.querySelectorAll("[data-whats]").forEach(function(b){ b.addEventListener("click", function(){
      var pa=DATA.getPayments().find(function(x){return x.id===+b.dataset.whats;}); if(pa){ window.open("https://wa.me/"+DATA.getConfig().phone+"?text="+encodeURIComponent("Sna3ti Admin — confirmation paiement "+pa.reference+" ("+pa.amount+" DH)"), "_blank"); }
    }); });
  }
  function confirmPayment(id){
    UI.confirmAction({ title:"Confirmer ce paiement ?", message:"Active l'abonnement correspondant après contrôle du virement.", confirmLabel:"Confirmer", onConfirm:function(){
      DATA.confirmPayment(id);
      DATA.logAudit({admin:AUTH.getSession().name, action:"CONFIRM_PAYMENT", entity:"Payment", entityId:id, result:"Confirmed"});
      UI.toast("Paiement confirmé — abonnement activé."); renderPayments();
    }});
  }
  function rejectPayment(id){
    UI.confirmAction({ title:"Rejeter ce paiement ?", reasonRequired:true, reasonLabel:"Raison du rejet", confirmLabel:"Rejeter", onConfirm:function(reason){
      DATA.rejectPayment(id);
      DATA.logAudit({admin:AUTH.getSession().name, action:"REJECT_PAYMENT", entity:"Payment", entityId:id, result:"Rejected", note:reason});
      UI.toast("Paiement rejeté."); renderPayments();
    }});
  }

  /* ============================================================
     ANALYTICS
     ============================================================ */
  var analyticsFilter = "12m";
  var MONTHS=["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
  function renderAnalytics(){
    UI.setTitle("Analytiques");
    var a = DATA.getAnalytics();
    var html =
      '<div class="page-head"><h1>Analytiques</h1><div class="spacer"><div class="tabs" style="border:none;padding:0;margin:0">'+
        ["today","7d","30d","90d","12m"].map(function(f){ return '<button class="tab '+(f===analyticsFilter?"active":"")+'" data-f="'+f+'">'+{"today":"Aujourd'hui","7d":"7 jours","30d":"30 jours","90d":"90 jours","12m":"12 mois"}[f]+'</button>'; }).join("")+
      '</div></div></div>' +
      '<div class="kpi-grid grid-4">'+
        kpiCard("Utilisateurs", "👥", "8 492","▲ 8,2%","up") + kpiCard("Recherches", "🔍", "1 845","▲ 18%","up") +
        kpiCard("Demandes de contact", "📞", secara(a.leads.contact),"▲ 6%","up") + kpiCard("Revenus", "💰", "67 430 DH","▲ 9,7%","up") +
      '</div>' +
      '<div class="grid-2" style="margin-top:20px">'+
        '<div class="card"><div class="card-title">Visites (12 mois)</div><div class="chart-bars">'+bars(a.visits)+'</div></div>'+
        '<div class="card"><div class="card-title">Nouvelles inscriptions</div><div class="chart-bars">'+bars(a.signups, true)+'</div></div>'+
      '</div>' +
      '<div class="grid-2" style="margin-top:20px;align-items:start">'+
        '<div class="card"><div class="card-title">Top services</div>' + a.topServices.map(function(s,i){ return '<div class="row-item"><div class="grow">'+esc(s)+'</div><span class="muted">#'+(i+1)+'</span></div>'; }).join("") + '</div>'+
        '<div class="card"><div class="card-title">Top villes</div>' + a.topCities.map(function(s,i){ return '<div class="row-item"><div class="grow">'+esc(s)+'</div><span class="muted">#'+(i+1)+'</span></div>'; }).join("") + '</div>'+
      '</div>';
    UI.setContent(html);
    document.querySelectorAll(".tab[data-f]").forEach(function(t){ t.addEventListener("click", function(){ analyticsFilter=t.dataset.f; renderAnalytics(); }); });
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
    UI.setTitle("AI Center");
    var html =
      '<div class="page-head"><h1>AI Center</h1><div class="spacer"><span class="badge purple">Bientôt disponible</span></div></div>' +
      '<div class="card"><div class="card-title">Recherche IA</div>' +
        '<p class="muted">Interprétation d\'une requête utilisateur en service, localisation et disponibilité.</p>' +
        '<div class="req" style="background:var(--sand);border:1px dashed var(--line-strong)">'+
          '<div class="muted" style="margin-bottom:8px"><b>Requête utilisateur :</b> « بغيت شي معلم ديال الجبس قريب ليا اليوم »</div>'+
          '<div class="verif-steps"><span class="step done">Service : Plâtrerie</span><span class="step done">Localisation : Position utilisateur</span><span class="step done">Disponibilité : Aujourd\'hui</span></div>'+
        '</div></div>' +
      '<div class="card"><div class="card-title">Capacités futures</div><div class="kpi-grid grid-3" style="margin-top:12px">'+
        '<div class="kpi"><div class="k-title">Recherche IA</div><div class="k-val" style="font-size:20px">Requête → service</div></div>'+
        '<div class="kpi"><div class="k-title">Mise en relation</div><div class="k-val" style="font-size:20px">Matching pro</div></div>'+
        '<div class="kpi"><div class="k-title">Assistant profil</div><div class="k-val" style="font-size:20px">Descriptions IA</div></div>'+
      '</div></div>';
    UI.setContent(html);
  }

  /* ============================================================
     NOTIFICATIONS, SETTINGS, ADMIN USERS, AUDIT
     ============================================================ */
  function renderNotifications(){
    UI.setTitle("Notifications");
    var list = DATA.getNotifications();
    UI.setContent('<div class="page-head"><h1>Notifications</h1></div><div class="card">'+
      (list.length ? list.map(function(n){ return '<div class="row-item"><span>'+(n.unread?'<span class="badge teal">Nouveau</span> ':'')+'</span><div class="grow">'+esc(n.text)+'<br><span class="muted">'+esc(n.when)+'</span></div></div>'; }).join("") : '<div class="empty">Aucune notification.</div>') +
      '</div>');
  }

  function renderSettings(){
    UI.setTitle("Réglages");
    var cfg = DATA.getConfig();
    var html =
      '<div class="page-head"><h1>Réglages</h1></div>' +
      '<div class="grid-2" style="align-items:start">' +
        '<div class="card"><div class="card-title">Général</div><div class="frm" style="margin-top:14px">'+
          '<div class="frm"><label>Nom de la plateforme</label><input id="sgName" value="'+esc(cfg.platformName)+'"></div>'+
          '<div class="frm"><label>Email de contact</label><input id="sgEmail" value="'+esc(cfg.contactEmail)+'"></div>'+
          '<div class="frm"><label>Téléphone</label><input id="sgPhone" value="'+esc(cfg.phone)+'"></div>'+
          '<div class="frm"><label>Langue par défaut</label><select id="sgLang"><option value="fr" '+(cfg.defaultLanguage==="fr"?"selected":"")+'>Français</option><option value="en" '+(cfg.defaultLanguage==="en"?"selected":"")+'>English</option><option value="ar" '+(cfg.defaultLanguage==="ar"?"selected":"")+'>العربية</option></select></div>'+
          '<button class="btn btn-primary" id="sgSave">Enregistrer</button>'+
        '</div></div>' +
        '<div class="card"><div class="card-title">Vérification</div>'+
          '<div class="detail-grid" style="margin-top:12px">'+drow("Documents requis", (cfg.verification.requiredDocuments||[]).join(", "))+'</div>'+
          '<div class="card-title" style="margin-top:16px">Contrôles requis</div><div class="checklist" style="margin-top:10px">'+
          (cfg.verification.requiredChecks||[]).map(function(c){ return '<label><input type="checkbox" checked disabled><span>'+esc(cfg.verification.checkLabels[c]||c)+'</span></label>'; }).join("")+
          '</div></div>' +
        '<div class="card"><div class="card-title">Règles marketplace</div><div class="feed" style="margin-top:10px">'+
          rule("Un compte gratuit peut exister sans vérification professionnelle.")+
          rule("La vérification d'identité est distincte de l'abonnement.")+
          rule("La vérification professionnelle est distincte de l'abonnement.")+
          rule("Le paiement n'accorde pas automatiquement la confiance.")+
          rule("GOLD ne signifie pas automatiquement vérifié.")+
          rule("Confirmation du paiement requise avant activation.")+
        '</div></div>' +
      '</div>';
    UI.setContent(html);
    document.getElementById("sgSave").addEventListener("click", function(){
      DATA.updateConfig({ platformName: document.getElementById("sgName").value, contactEmail: document.getElementById("sgEmail").value, phone: document.getElementById("sgPhone").value, defaultLanguage: document.getElementById("sgLang").value });
      DATA.logAudit({admin:AUTH.getSession().name, action:"SETTINGS_CHANGED", entity:"Settings", entityId:"config", result:"Updated"});
      UI.toast("Réglages enregistrés.");
    });
  }
  function rule(t){ return '<div class="feed-item"><div class="feed-dot teal"></div><div class="f-txt">'+esc(t)+'</div></div>'; }

  function renderAdminUsers(){
    UI.setTitle("Admin Users");
    var users = DATA.getAdminUsers();
    UI.setContent('<div class="page-head"><h1>Admin Users</h1><div class="spacer">'+(AUTH.can("adminUsers","update")?'<button class="btn btn-primary" id="auAdd">+ Ajouter</button>':"")+'</div></div>' +
      '<div class="card"><div class="table-wrap"><table><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th><th>Créé</th><th>Actions</th></tr></thead><tbody>'+
      users.map(function(u){
        var rl = AUTH.roles[u.role] || { label:u.role, color:"gray" };
        return '<tr><td><div class="pro"><div class="p-avatar">'+initials(u.name)+'</div><div class="pro-name">'+esc(u.name)+'</div></div></td><td>'+esc(u.email)+'</td>'+
          '<td><span class="badge '+rl.color+'">'+esc(rl.label)+'</span></td><td>'+userStatusBadge(u.status)+'</td><td>'+u.lastLogin+'</td><td>'+u.created+'</td>'+
          '<td class="actions-cell">'+(AUTH.can("adminUsers","update")?'<button class="icon-act" data-editau="'+u.id+'">✏️</button>':"")+'</td></tr>';
      }).join("") + '</tbody></table></div></div>');
    if(AUTH.can("adminUsers","update")){
      document.querySelectorAll("[data-editau]").forEach(function(b){ b.addEventListener("click", function(){ editAdminUser(b.dataset.editau); }); });
      document.getElementById("auAdd").addEventListener("click", function(){ editAdminUser(null); });
    }
  }
  function editAdminUser(id){
    var u = id ? DATA.getAdminUsers().find(function(x){ return x.id===id; }) : { id:null, name:"", email:"", role:"moderator" };
    UI.openModal('<h3>'+(id?"Modifier":"Ajouter")+' admin</h3><div class="frm">'+
      '<div class="frm"><label>Nom</label><input id="auName" value="'+esc(u.name)+'"></div>'+
      '<div class="frm"><label>Email</label><input id="auEmail" value="'+esc(u.email)+'"></div>'+
      '<div class="frm"><label>Rôle</label><select id="auRole">'+Object.keys(AUTH.roles).map(function(r){ return '<option value="'+r+'" '+(u.role===r?"selected":"")+'>'+esc(AUTH.roles[r].label)+'</option>'; }).join("")+'</select></div>'+
      '</div><div class="modal-actions"><button class="btn btn-ghost" onclick="window.Sna3tiUI.closeModal()">Annuler</button><button class="btn btn-primary" id="auSave">Enregistrer</button></div>');
    document.getElementById("auSave").addEventListener("click", function(){
      var d={ name:document.getElementById("auName").value, email:document.getElementById("auEmail").value, role:document.getElementById("auRole").value };
      if(id){ var ex=DATA._store.adminUsers.find(function(x){return x.id===id;}); if(ex)Object.assign(ex,d); } else { DATA._store.adminUsers.push(Object.assign({id:"AU-"+Date.now(), status:"active", lastLogin:"—", created:new Date().toISOString().slice(0,10)}, d)); }
      UI.toast("Admin enregistré."); UI.closeModal(); renderAdminUsers();
    });
  }

  function renderAuditLogs(){
    UI.setTitle("Audit Logs");
    var logs = DATA.getAuditLogs();
    UI.setContent('<div class="page-head"><h1>Audit Logs</h1><div class="spacer">'+(AUTH.can("auditLogs","export")?'<button class="btn btn-ghost" id="auExport">⬇ Exporter</button>':"")+'</div></div>' +
      '<div class="card"><div class="table-wrap"><table><thead><tr><th>Horodatage</th><th>Admin</th><th>Action</th><th>Entité</th><th>ID</th><th>Résultat</th><th>Note</th></tr></thead><tbody>'+
      logs.map(function(l){ return '<tr><td>'+esc(l.timestamp)+'</td><td>'+esc(l.admin)+'</td><td><code>'+esc(l.action)+'</code></td><td>'+esc(l.entity)+'</td><td>'+esc(l.entityId)+(l.prev?'<div class="muted">'+esc(l.prev)+' → '+esc(l.next)+'</div>':"")+'</td>'+
        '<td><span class="badge '+(String(l.result).toLowerCase()==="success"||String(l.result).toLowerCase()==="approved"||String(l.result).toLowerCase()==="confirmed"?"green":"amber")+'">'+esc(l.result)+'</span></td><td class="muted">'+esc(l.note||"—")+'</td></tr>'; }).join("") +
      '</tbody></table></div></div>');
    var ex = document.getElementById("auExport"); if(ex) ex.addEventListener("click", function(){
      var rows=[["Timestamp","Admin","Action","Entité","ID","Résultat","Note"]]; logs.forEach(function(l){ rows.push([l.timestamp,l.admin,l.action,l.entity,l.entityId,l.result,l.note||""]); });
      UI.exportCSV("audit-logs-sna3ti.csv", rows); UI.toast("Export généré.");
    });
  }

  /* ============================================================
     FORBIDDEN / NOT FOUND
     ============================================================ */
  function renderForbidden(){
    UI.setTitle("Accès refusé");
    UI.setContent('<div class="msg-box"><div class="b">🔒 Accès refusé</div><p class="muted">Vous n\'avez pas la permission d\'accéder à cette section avec votre rôle actuel.</p><button class="btn btn-ghost" onclick="window.Sna3tiRouter.navigate(\'dashboard\')">Retour au tableau de bord</button></div>');
  }
  function renderNotFound(){
    UI.setTitle("Introuvable");
    UI.setContent('<div class="msg-box"><div class="b">Page introuvable</div><p class="muted">La route demandée n\'existe pas.</p><button class="btn btn-ghost" onclick="window.Sna3tiRouter.navigate(\'dashboard\')">Tableau de bord</button></div>');
  }

  /* ============================================================
     ROUTE DISPATCH
     ============================================================ */
  function dispatch(route){
    UI.setActiveNav(route.route.view === "professionalDetail" ? "professionals" : route.route.view);
    switch(route.route.view){
      case "dashboard": renderDashboard(); break;
      case "professionals": renderProfessionals(); break;
      case "professionalDetail": renderProfessionalDetail(route.params.id); break;
      case "users": renderUsers(); break;
      case "verification": renderVerification(); break;
      case "categories": renderCategories(); break;
      case "cities": renderCities(); break;
      case "reviews": renderReviews(); break;
      case "reports": renderReports(); break;
      case "subscriptions": renderSubscriptions(); break;
      case "payments": renderPayments(); break;
      case "analytics": renderAnalytics(); break;
      case "ai": renderAI(); break;
      case "notifications": renderNotifications(); break;
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
