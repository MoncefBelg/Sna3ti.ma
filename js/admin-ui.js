/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/admin-ui.js
   UI shell: sidebar, topbar, global search, notifications,
   toast, modal, confirm, and reusable table/pagination/export
   components. Decoupled from view logic.
   ============================================================ */

(function (global) {
  "use strict";

  var AUTH = global.Sna3tiAuth;
  var DATA = global.Sna3tiData;
  var ROUTER = global.Sna3tiRouter;
  var I18N = global.Sna3tiI18n || { t:function(k,f){ return f!==undefined?f:k; }, getLang:function(){return "fr";}, setLang:function(){}, getTheme:function(){return "light";}, toggleTheme:function(){} };
  function T(key, fallback){ return I18N.t(key, fallback); }

  /* ---------- helpers ---------- */
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(m){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]; }); }
  function initials(name){ return esc((name||"?").charAt(0).toUpperCase()); }
  function fmtDate(d){ if(!d) return "—"; return d; }
  function debounce(fn, wait){
    var t; return function(){ var a=arguments, ctx=this; clearTimeout(t); t=setTimeout(function(){ fn.apply(ctx,a); }, wait); };
  }

  // Accessibility: derive a screen-reader label from `title` for icon-only
  // controls and make keyboard-focusable clickables (role="button") usable.
  function applyAriaFromTitle(root){
    var r = root || document;
    r.querySelectorAll("button[title], a[title], [role='button'][title]").forEach(function(el){
      if(!el.hasAttribute("aria-label") && !el.getAttribute("aria-labelledby")){
        el.setAttribute("aria-label", el.getAttribute("title"));
      }
    });
  }

  /* ---------- main shell ---------- */
  var appRoot, contentEl, topbarEl;

  function buildAppShell(){
    var navGroups = buildNavGroups();
    appRoot = document.getElementById("admin-root");
    appRoot.innerHTML =
      '<div class="app">' +
        '<aside class="sidebar" id="sidebar">' +
          '<div class="sidebar-head">' +
            '<div class="sidebar-brand"><div class="brand-logo">S</div><div><div class="brand-name">Sna3ti</div><div class="brand-sub">'+T("Administration")+'</div></div></div>' +
          '</div>' +
          '<nav class="sidebar-nav" id="sidebarNav">' + navGroups + '</nav>' +
          '<div class="sidebar-foot"><div id="sideUser"></div><div class="proto-note">'+T("Prototype — authentification de démonstration uniquement.")+'</div></div>' +
        '</aside>' +
        '<div class="app-main">' +
          '<header class="topbar">' +
            '<button class="hamburger" id="hamburger" aria-label="Menu">☰</button>' +
            '<div class="topbar-title" id="topbarTitle">'+T("Tableau de bord")+'</div>' +
            '<span class="badge purple prototype-badge">'+T("Prototype")+'</span>' +
            '<div class="topbar-spacer"></div>' +
            '<div class="topbar-tools">' +
              '<button class="icon-btn" id="themeToggle" title="Dark mode" aria-label="'+T("Mode sombre")+'">🌙</button>' +
              '<button class="lang-btn" id="langToggle" title="Language" aria-label="'+T("Changer la langue")+'">EN</button>' +
            '</div>' +
            '<div class="search-wrap" id="globalSearchWrap"><span class="s-ico">🔍</span><input id="globalSearch" type="search" placeholder="'+T("Rechercher...")+'" aria-label="'+T("Recherche globale")+'" />' +
              '<div class="search-panel" id="searchPanel"></div></div>' +
            '<div class="dropdown" id="notifDrop">' +
              '<button class="icon-btn" id="notifBtn" aria-label="Notifications">🔔<span class="dot" id="notifDot"></span></button>' +
              '<div class="notif-panel" id="notifPanel"></div>' +
            '</div>' +
            '<div class="dropdown" id="userDrop">' +
              '<div class="top-user" id="topUser" role="button" tabindex="0" aria-haspopup="menu" aria-label="'+T("Menu utilisateur")+'"></div>' +
              '<div class="menu" id="userMenu"></div>' +
            '</div>' +
          '</header>' +
          '<main class="content" id="content"></main>' +
        '</div>' +
      '</div>' +
      '<div class="modal-scrim" id="modalScrim" aria-hidden="true"><div class="modal" id="modal" role="dialog" aria-modal="true" tabindex="-1"><div id="modalBody"></div></div></div>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>';

    contentEl = document.getElementById("content");
    topbarEl = document.getElementById("topbarTitle");

    document.getElementById("hamburger").addEventListener("click", function(){ document.getElementById("sidebar").classList.toggle("open"); });
    document.getElementById("sidebar").addEventListener("click", function(e){
      var it = e.target.closest(".nav-item");
      if(it && it.dataset && it.dataset.route){ document.getElementById("sidebar").classList.remove("open"); }
    });

    // notifications
    var notifBtn = document.getElementById("notifBtn"), notifPanel = document.getElementById("notifPanel");
    notifBtn.addEventListener("click", function(e){
      e.stopPropagation();
      var open = notifPanel.classList.toggle("open");
      if(open) renderNotifications();
    });
    notifPanel.addEventListener("click", function(e){
      var it = e.target.closest(".notif-item");
      if(it && it.dataset.route){ notifPanel.classList.remove("open"); ROUTER.navigate(it.dataset.route); }
    });

    // user menu
    var userDrop = document.getElementById("userDrop");
    userDrop.addEventListener("click", function(e){
      var m = document.getElementById("userMenu");
      var insideMenu = e.target.closest("#userMenu");
      if(!insideMenu){ e.stopPropagation(); m.classList.toggle("open"); }
    });
    document.getElementById("topUser").addEventListener("keydown", function(e){
      if(e.key === "Enter" || e.key === " " || e.key === "Spacebar"){
        e.preventDefault();
        document.getElementById("userMenu").classList.toggle("open");
      }
    });
    document.getElementById("userMenu").addEventListener("click", function(e){
      var it = e.target.closest(".menu-item");
      if(!it) return;
      if(it.dataset.action === "logout"){ onLogout(); }
    });

    // global search
    var gs = document.getElementById("globalSearch");
    gs.addEventListener("input", debounce(function(){ renderGlobalSearch(gs.value); }, 220));
    gs.addEventListener("focus", function(){ if(gs.value) renderGlobalSearch(gs.value); });
    document.addEventListener("click", function(e){
      if(!e.target.closest("#globalSearchWrap")) document.getElementById("searchPanel").classList.remove("open");
      if(!e.target.closest("#notifDrop")) document.getElementById("notifPanel").classList.remove("open");
      if(!e.target.closest("#userDrop")) document.getElementById("userMenu").classList.remove("open");
    });

    // modal close
    document.getElementById("modalScrim").addEventListener("click", function(e){ if(e.target === this) closeModal(); });
    document.getElementById("modalScrim").addEventListener("keydown", trapModalFocus);

    // theme + language toggles
    var themeBtn = document.getElementById("themeToggle");
    if(themeBtn){
      var syncThemeIcon = function(){ themeBtn.textContent = (I18N.getTheme() === "dark") ? "☀️" : "🌙"; };
      themeBtn.addEventListener("click", function(){ I18N.toggleTheme(); syncThemeIcon(); });
      syncThemeIcon();
    }
    var langBtn = document.getElementById("langToggle");
    if(langBtn){
      langBtn.textContent = (I18N.getLang() === "en") ? "FR" : "EN";
      langBtn.addEventListener("click", function(){
        var to = (I18N.getLang() === "en") ? "fr" : "en";
        I18N.setLang(to);
        langBtn.textContent = (to === "en") ? "FR" : "EN";
        global.Sna3tiUI.reload();
      });
    }

    renderSidebarUser();
  }

  function buildNavGroups(){
    var groups = [
      { label:"", items:[ { route:"dashboard", ico:"📊", label:T("Tableau de bord") } ] },
      { label:T("Marketplace"), items:[
          { route:"professionals", ico:"🧑‍🔧", label:T("Professionnels") },
          { route:"users", ico:"👥", label:T("Utilisateurs") },
          { route:"categories", ico:"🗂️", label:T("Catégories") },
          { route:"cities", ico:"📍", label:T("Villes") }
        ]},
      { label:T("Confiance et sécurité"), items:[
          { route:"verification", ico:"✅", label:T("Vérification"), pill:"verification" },
          { route:"reviews", ico:"⭐", label:T("Avis") },
          { route:"reports", ico:"🚩", label:T("Signalements"), pill:"reports" },
          { route:"support", ico:"🧰", label:T("Support"), pill:"support" }
        ]},
      { label:T("Business"), items:[
          { route:"subscriptions", ico:"📦", label:T("Abonnements") },
          { route:"payments", ico:"💰", label:T("Paiements"), pill:"payments" }
        ]},
      { label:T("Insights"), items:[
          { route:"analytics", ico:"📈", label:T("Analytiques") },
          { route:"ai", ico:"🤖", label:T("AI Center") }
        ]},
      { label:T("Système"), items:[
          { route:"notifications", ico:"🔔", label:T("Notifications") },
          { route:"settings", ico:"⚙️", label:T("Réglages") },
          { route:"legal", ico:"⚖️", label:T("Contenu légal") },
          { route:"admin-users", ico:"🛡️", label:T("Admin Users") },
          { route:"audit-logs", ico:"📜", label:T("Audit Logs") }
        ]}
    ];
    var html = "";
    groups.forEach(function(g){
      var visible = g.items.filter(function(item){
        var perm = ROUTE_PERM[item.route];
        if(!perm) return true;
        return AUTH.can(perm[0], perm[1]);
      });
      if(visible.length === 0) return;
      html += (g.label ? '<div class="nav-group"><div class="nav-label">'+g.label+'</div>' : '<div class="nav-group">');
      visible.forEach(function(item){
        var pill = item.pill ? '<span class="pill" id="pill-'+item.pill+'"></span>' : "";
        html += '<button class="nav-item" data-route="'+item.route+'" data-view="'+item.route+'">' +
                '<span class="ico">'+item.ico+'</span> '+item.label+' '+pill +'</button>';
      });
      html += '</div>';
    });
    return html;
  }

  var ROUTE_PERM = {
    dashboard:["dashboard","read"], professionals:["professionals","read"], users:["users","read"],
    verification:["verification","read"], categories:["categories","read"], cities:["cities","read"],
    reviews:["reviews","read"], reports:["reports","read"], support:["support","read"],
    subscriptions:["subscriptions","read"],
    payments:["payments","read"], analytics:["analytics","read"], ai:["ai","read"],
    notifications:["notifications","read"], settings:["settings","read"], legal:["legal","read"],
    "admin-users":["adminUsers","read"], "audit-logs":["auditLogs","read"]
  };

  function bindNav(){
    var nav = document.getElementById("sidebarNav");
    if(!nav) return;
    nav.querySelectorAll(".nav-item").forEach(function(el){
      el.addEventListener("click", function(){
        var route = el.dataset.route;
        if(route) ROUTER.navigate(route);
      });
    });
  }

  function renderSidebarUser(){
    var s = AUTH.getSession();
    if(!s) return;
    document.getElementById("sideUser").innerHTML =
      '<div class="side-user"><div class="avatar">'+initials(s.name)+'</div><div class="side-user-info"><div class="side-user-name">'+esc(s.name)+'</div><div class="side-user-role">'+esc(AUTH.getRoleLabel())+'</div></div></div>';
  }

  function setActiveNav(route){
    var nav = document.getElementById("sidebarNav");
    if(!nav) return;
    var base = String(route || "dashboard").split("/")[0];
    nav.querySelectorAll(".nav-item").forEach(function(el){ el.classList.toggle("active", el.dataset.route === base); });
  }

  function renderTopUser(){
    var s = AUTH.getSession(); if(!s) return;
    document.getElementById("topUser").innerHTML =
      '<div class="avatar">'+initials(s.name)+'</div>' +
      '<div class="top-user-meta"><span class="top-user-name">'+esc(s.name)+'</span><span class="top-user-role">'+esc(AUTH.getRoleLabel())+'</span></div>';
    document.getElementById("userMenu").innerHTML =
      '<div class="menu-label">'+esc(s.email)+'</div>' +
      '<button class="menu-item" data-action="logout"><span>👋</span> '+T("Se déconnecter")+'</button>';
  }

  function updatePills(){
    var kpi = DATA.getKPIs();
    var set = function(id, n){ var el=document.getElementById("pill-"+id); if(el){ el.textContent=n; el.style.display = n>0?"":"none"; } };
    set("verification", kpi.pendingVerification);
    set("reports", DATA.getReports().filter(function(r){ return r.status==="new"||r.status==="under_review"; }).length);
    set("payments", kpi.pendingPayments);
    var openSupport = (DATA.getSupportTickets ? DATA.getSupportTickets().filter(function(t){ return t.status==="open"||t.status==="pending"; }).length : 0);
    set("support", openSupport);
    var dot = document.getElementById("notifDot");
    var unread = DATA.getNotifications().filter(function(n){ return n.unread; }).length;
    if(dot) dot.style.display = unread>0 ? "" : "none";
  }

  function renderNotifications(){
    var panel = document.getElementById("notifPanel");
    var list = DATA.getNotifications();
    var NOTIF_ICO = { verification:"✅", payment:"💰", report:"🚩", subscription:"📦", user:"👥", system:"⚙️" };
    panel.innerHTML = '<div class="np-head"><span>'+T("Notifications")+'</span><span class="muted small">'+list.filter(function(n){return n.unread;}).length+' '+T("non lues")+'</span></div>' +
      (list.length ? list.map(function(n){
        var ico = NOTIF_ICO[n.type] || "🔔";
        return '<div class="notif-item '+(n.unread?"unread":"")+'" data-id="'+n.id+'" data-route="'+(n.route||"")+'">' +
               '<div class="n-ico">'+ico+'</div><div><div class="n-txt">'+esc(n.text)+'</div><div class="n-when">'+esc(n.when)+'</div></div></div>';
      }).join("") : '<div class="sp-empty">'+T("Aucune notification")+'</div>');
    DATA.markNotificationsRead();
    updatePills();
  }

  function renderGlobalSearch(q){
    var panel = document.getElementById("searchPanel");
    q = (q||"").toLowerCase().trim();
    if(!q){ panel.classList.remove("open"); return; }
    var results = [];
    // professionals
    DATA.getProfessionals().forEach(function(p){
      var hay = (p.name+" "+p.job+" "+p.city+" "+p.category).toLowerCase();
      if(hay.indexOf(q)>-1){
        results.push({ group:T("Professionnels"), id:p.id, main : p.name, sub: p.job+" · "+p.city+" · "+p.id, route:"professionals/"+p.id, ico:"🧑‍🔧" });
      }
    });
    // users
    DATA.getUsers().forEach(function(u){
      if((u.name+" "+u.email+" "+(u.phone||"")).toLowerCase().indexOf(q)>-1){
        results.push({ group:T("Utilisateurs"), id:u.id, main:u.name, sub:u.email+" · "+(u.phone||""), route:"users", ico:"👥" });
      }
    });
    // cities
    DATA.getRegions().forEach(function(r){ r.cities.forEach(function(c){
      var cn = c.name.fr;
      if(cn.toLowerCase().indexOf(q)>-1){ results.push({ group:T("Villes"), id:c.id, main:cn, sub:"City ID "+c.id, route:"cities", ico:"📍" }); }
    }); });
    // payments
    DATA.getPayments().forEach(function(pa){
      if((pa.reference+" "+pa.planName+" "+pa.amount).toLowerCase().indexOf(q)>-1){
        results.push({ group:T("Paiements"), id:pa.id, main:pa.reference+" · "+pa.planName, sub:pa.amount+" DH · "+pa.status, route:"payments", ico:"💰" });
      }
    });
    // verifications
    DATA.getVerificationRequests().forEach(function(v){
      if((v.id).toLowerCase().indexOf(q)>-1){ results.push({ group:T("Vérification"), id:v.id, main:v.id, sub:T("Statut")+" "+v.status, route:"verification", ico:"✅" }); }
    });

    if(results.length === 0){
      panel.innerHTML = '<div class="sp-empty">'+ (I18N.getLang()==="en" ? "No results for \u00AB "+esc(q)+" \u00BB" : "Aucun résultat pour \u00AB "+esc(q)+" \u00BB") +'</div>';
    } else {
      var byGroup = {};
      results.forEach(function(r){ (byGroup[r.group]=byGroup[r.group]||[]).push(r); });
      var html="";
      Object.keys(byGroup).forEach(function(g){
        html += '<div class="sp-group"><div class="sp-label">'+g+'</div>';
        byGroup[g].slice(0,4).forEach(function(r){
          html += '<div class="sp-item" data-route="'+r.route+'"><span>'+r.ico+'</span><div><div class="sp-main">'+esc(r.main)+'</div><div class="sp-sub">'+esc(r.sub)+'</div></div></div>';
        });
        html += '</div>';
      });
      panel.innerHTML = html;
      panel.querySelectorAll(".sp-item").forEach(function(el){
        el.addEventListener("click", function(){ panel.classList.remove("open"); var inp=document.getElementById("globalSearch"); if(inp)inp.value=""; ROUTER.navigate(el.dataset.route); });
      });
    }
    panel.classList.add("open");
  }

  /* ---------- content helpers ---------- */

  function setTitle(title){ if(topbarEl) topbarEl.textContent = title; }

  function setContent(html){ contentEl.innerHTML = html || ""; applyAriaFromTitle(contentEl); }

  function getContent(){ return contentEl; }

  function renderSkeleton(lines, boxes){
    var h="";
    if(boxes){ h += '<div class="kpi-grid">'; for(var i=0;i<4;i++){ h += '<div class="card"><div class="skeleton skel-box"></div></div>'; } h += '</div>'; }
    if(lines){ h += '<div class="card"><div class="skeleton skel-line" style="width:30%"></div>'; for(var j=0;j<lines;j++){ h += '<div class="skeleton skel-row"></div>'; } h += '</div>'; }
    setContent(h);
  }

  function renderEmpty(text, ico){
    setContent('<div class="empty"><div class="e-ico">'+(ico||"📭")+'</div>'+esc(text)+'</div>');
  }

  function renderError(text){
    setContent('<div class="msg-box"><div class="b">🚧 '+T("Oups, une erreur est survenue")+'</div><p class="muted">'+esc(text||T("Veuillez réessayer."))+'</p><button class="btn btn-ghost" onclick="window.Sna3tiUI.reload()">'+T("Réessayer")+'</button></div>');
  }

  function reload(){ location.reload(); }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg, isErr){
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.toggle("err", !!isErr);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2800);
  }

  /* ---------- modal ---------- */
  var lastFocusedEl = null;
  function escLabelFromModal(){
    // Set aria-label / aria-labelledby from the first heading so SRs announce the dialog.
    var modal = document.getElementById("modal");
    var h = modal.querySelector("h1,h2,h3");
    if(h){
      if(!h.id) h.id = "modalTitle_" + Math.floor(Math.random()*1e6);
      modal.setAttribute("aria-labelledby", h.id);
      modal.removeAttribute("aria-label");
    } else {
      modal.setAttribute("aria-label", "Dialog");
      modal.removeAttribute("aria-labelledby");
    }
  }
  function openModal(html, wide){
    lastFocusedEl = document.activeElement;
    var scrim = document.getElementById("modalScrim");
    var modal = document.getElementById("modal");
    modal.classList.toggle("modal-wide", !!wide);
    document.getElementById("modalBody").innerHTML = html;
    applyAriaFromTitle(modal);
    scrim.classList.add("show");
    scrim.setAttribute("aria-hidden", "false");
    escLabelFromModal();
    var f = modal.querySelector("input, select, textarea");
    if(f){ setTimeout(function(){ f.focus(); }, 60); }
    else { modal.focus(); }
  }
  function closeModal(){
    var scrim = document.getElementById("modalScrim");
    scrim.classList.remove("show");
    scrim.setAttribute("aria-hidden", "true");
    if(lastFocusedEl && typeof lastFocusedEl.focus === "function"){ lastFocusedEl.focus(); }
    lastFocusedEl = null;
  }
  function trapModalFocus(e){
    if(e.key !== "Tab") return;
    var scrim = document.getElementById("modalScrim");
    if(!scrim.classList.contains("show")) return;
    var focusables = scrim.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if(focusables.length === 0) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if(e.shiftKey){
      if(document.activeElement === first || !scrim.contains(document.activeElement)){ e.preventDefault(); last.focus(); }
    } else {
      if(document.activeElement === last || !scrim.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
    }
  }
  function closeOnEscape(e){
    if(e.key !== "Escape" && e.key !== "Esc" && e.keyCode !== 27) return;
    if(document.getElementById("modalScrim").classList.contains("show")){ closeModal(); }
    [["searchPanel","globalSearchWrap"],["notifPanel","notifDrop"],["userMenu","userDrop"]].forEach(function(p){
      var panel = document.getElementById(p[0]);
      if(panel && panel.classList.contains("open")){ panel.classList.remove("open"); }
    });
  }
  document.addEventListener("keydown", closeOnEscape);

  // confirm with reason for destructive/sensitive actions
  function confirmAction(opts){
    // opts: { title, message, confirmLabel, reasonLabel(bool), reasonRequired(bool),
    //         options:[preset reason list], otherLabel, otherPlaceholder,
    //         onConfirm(reason) }
    var html = '<h3>'+esc(opts.title||T("Confirmer"))+'</h3>';
    if(opts.message) html += '<p class="subtle" style="font-size:13.5px;color:var(--muted)">'+opts.message+'</p>';
    var withReason = (opts.reasonLabel || opts.reasonRequired || opts.options);
    if(withReason){
      if(opts.options){
        var optsHtml = opts.options.map(function(o){ return '<option value="'+esc(o)+'" '+(o===opts.defaultOption?"selected":"")+'>'+esc(o)+'</option>'; }).join("");
        html += '<div class="frm"><label>'+(opts.reasonLabel||T("Raison"))+' *</label>'+
          '<select id="confirmReason">'+optsHtml+'</select></div>';
        if(opts.otherLabel){
          html += '<div class="frm" style="margin-top:10px"><label>'+esc(opts.otherLabel)+'</label><textarea id="confirmDetail" placeholder="'+esc(opts.otherPlaceholder||"")+'" rows="2"></textarea></div>';
        }
      } else {
        html += '<div class="frm"><label>'+(opts.reasonLabel||T("Raison"))+' *</label><textarea id="confirmReason" placeholder="'+T("Expliquez la raison...")+'" required="'+!!opts.reasonRequired+'"></textarea></div>';
      }
    }
    html += '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="window.Sna3tiUI.cancelAction()">'+T("Annuler")+'</button>' +
      '<button class="btn btn-danger-solid" id="confirmOk">'+esc(opts.confirmLabel||T("Confirmer"))+'</button>' +
      '</div>';
    openModal(html);
    var cb = opts.onConfirm;
    document.getElementById("confirmOk").addEventListener("click", function(){
      var reasonField = document.getElementById("confirmReason");
      var reason = reasonField ? String(reasonField.value).trim() : "";
      if(opts.options && reasonField && reasonField.tagName==="SELECT"){
        var detail = (document.getElementById("confirmDetail") ? document.getElementById("confirmDetail").value.trim() : "");
        if(detail) reason = reason + " — " + detail;
      }
      if(opts.options && !reason){
        toast(T("Veuillez fournir une raison."), true); return;
      }
      if(opts.reasonRequired && !reason){
        toast(T("Veuillez fournir une raison."), true); return;
      }
      closeModal();
      if(cb) cb(reason || "");
    });
  }
  function cancelAction(){ closeModal(); }

  /* ---------- simple link-based confirm (native) ---------- */
  // kept for trivial cases

  /* ---------- table + pagination ---------- */
  // Generic pagination helper returns slice of array + page UI
  function paginate(totalItems, page, perPage){
    var total = Math.max(1, Math.ceil(totalItems / perPage));
    page = Math.min(Math.max(1, page), total);
    return { page:page, total:total, from:(page-1)*perPage, to:Math.min(page*perPage, totalItems) };
  }

  function renderPagination(container, page, totalPages, onGo){
    var h = '<div class="pagination">' +
      '<button '+(page<=1?'disabled':'')+' data-p="'+Math.max(1,page-1)+'">‹</button>';
    for(var i=1;i<=totalPages;i++){
      h += '<button data-p="'+i+'" class="'+(i===page?'active':'')+'">'+i+'</button>';
    }
    h += '<button '+(page>=totalPages?'disabled':'')+' data-p="'+Math.min(totalPages,page+1)+'">›</button></div>';
    var holder = document.getElementById(container);
    if(holder){ holder.innerHTML = h; holder.querySelectorAll("button[data-p]").forEach(function(b){
      if(b.disabled) return;
      b.addEventListener("click", function(){ onGo(parseInt(b.dataset.p,10)); });
    }); }
  }

  /* ---------- export CSV ---------- */
  function exportCSV(filename, rows){
    // rows: array of arrays
    var csv = rows.map(function(r){ return r.map(function(c){
      c = String(c==null?"":c);
      if(/[",\n]/.test(c)){ c = '"'+c.replace(/"/g,'""')+'"'; }
      return c;
    }).join(","); }).join("\r\n");
    var blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8;" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  /* ---------- logout & init ---------- */
  function onLogout(){
    AUTH.logout();
    location.hash = "#/admin/login";
    location.reload();
  }

  function afterShell(){
    bindNav();
    renderTopUser();
    updatePills();
  }

  global.Sna3tiUI = {
    esc: esc, initials: initials, fmtDate: fmtDate,
    buildAppShell: buildAppShell, afterShell: afterShell,
    setActiveNav: setActiveNav, setTitle: setTitle, setContent: setContent,
    getContent: getContent, renderSkeleton: renderSkeleton,
    renderEmpty: renderEmpty, renderError: renderError, reload: reload,
    toast: toast, openModal: openModal, closeModal: closeModal,
    confirmAction: confirmAction, cancelAction: cancelAction,
    paginate: paginate, renderPagination: renderPagination,
    exportCSV: exportCSV, debounce: debounce, renderGlobalSearch: renderGlobalSearch, updatePills: updatePills
  };

})(window);
