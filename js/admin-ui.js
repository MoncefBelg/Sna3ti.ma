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
    var sess = (typeof Sna3tiAuth !== "undefined" && Sna3tiAuth.getSession) ? Sna3tiAuth.getSession() : null;
    var demo = !sess || sess.api !== true;
    appRoot = document.getElementById("admin-root");
    appRoot.innerHTML =
      '<div class="app">' +
        '<aside class="sidebar" id="sidebar">' +
          '<div class="sidebar-head">' +
            '<div class="sidebar-brand"><div class="brand-logo">S</div><div><div class="brand-name">Sna3ti</div><div class="brand-sub">'+T("Administration")+'</div></div></div>' +
          '</div>' +
          '<nav class="sidebar-nav" id="sidebarNav">' + navGroups + '</nav>' +
          '<div class="sidebar-foot"><div id="sideUser"></div>'+(demo?'<div class="proto-note">'+T("Prototype — authentification de démonstration uniquement.")+'</div>':"")+'</div>' +
        '</aside>' +
        '<div class="app-main">' +
          '<header class="topbar">' +
            '<button class="hamburger" id="hamburger" aria-label="Menu">☰</button>' +
            '<div class="topbar-title" id="topbarTitle">'+T("Tableau de bord")+'</div>' +
            (demo?'<span class="badge purple prototype-badge">'+T("Prototype")+'</span>':"") +
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
    if(open){
      if(global.Sna3tiNotificationsLive){
        Sna3tiNotificationsLive.refresh().then(renderNotifications);
      } else {
        renderNotifications();
      }
    }
    });
    notifPanel.addEventListener("click", function(e){
      var it = e.target.closest(".notif-item");
      if(it){
        var id = it.dataset.id;
        // Reading happens one-by-one: clicking a notification marks THAT
        // notification read (the counter decreases only then).
        if(id){
          if(global.Sna3tiNotificationsLive && Sna3tiNotificationsLive.isReady()){
            Sna3tiNotificationsLive.markRead(id).then(updatePills);
          } else {
            DATA.markNotificationRead(id);
            updatePills();
          }
        }
        if(it.dataset.route){ notifPanel.classList.remove("open"); ROUTER.navigate(it.dataset.route); }
      }
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
      // 3-way cycle: fr -> en -> ar -> fr ; the button always shows the
      // NEXT target language so the user knows what one click will do.
      var NEXT_LANG = { fr:"en", en:"ar", ar:"fr" };
      var LANG_LABEL = { en:"EN", ar:"عربية", fr:"FR" };
      var syncLangBtn = function(){
        var next = NEXT_LANG[I18N.getLang()] || "en";
        langBtn.textContent = LANG_LABEL[next];
        langBtn.setAttribute("aria-label", "Language: " + next);
      };
      langBtn.addEventListener("click", function(){
        var to = NEXT_LANG[I18N.getLang()] || "en";
        I18N.setLang(to);
        global.Sna3tiUI.reload();
      });
      syncLangBtn();
    }

    renderSidebarUser();
    if(global.Sna3tiNotificationsLive){
      // Keep the bell badge in sync: the 20s background poll refreshes the
      // cached feed, so the unread counter updates without any action.
      Sna3tiNotificationsLive.onChange(function(){ updatePills(); });
      Sna3tiNotificationsLive.refresh().then(updatePills);
    }
  }

  function buildNavGroups(){
    var groups = [
      { label:"", items:[ { route:"dashboard", ico:"📊", label:T("Tableau de bord") } ] },
      { label:T("Marketplace"), items:[
          { route:"professionals", ico:"🧑‍🔧", label:T("Artisans") },
          { route:"users", ico:"👥", label:T("Utilisateurs") },
          { route:"categories", ico:"🗂️", label:T("Catégories") },
          { route:"cities", ico:"📍", label:T("Villes") }
        ]},
      { label:T("Confiance et sécurité"), items:[
          { route:"registrations", ico:"📋", label:T("Demandes d'inscription"), pill:"professionalRequests" },
          { route:"reviews", ico:"⭐", label:T("Avis") },
          { route:"reports", ico:"🚩", label:T("Signalements"), pill:"reports" },
          { route:"match-requests", ico:"🤝", label:T("Demandes de mise en relation"), pill:"matchRequests" },
          { route:"support", ico:"🧰", label:T("Support"), pill:"support" }
        ]},
      { label:T("Business"), items:[
          { route:"subscriptions", ico:"📦", label:T("Abonnements") },
          { route:"payments", ico:"💰", label:T("Paiements"), pill:"payments" },
          { route:"billing-history", ico:"🧾", label:T("Historique de facturation") }
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
    registrations:["professionalRequests","read"],
    reviews:["reviews","read"], reports:["reports","read"], "match-requests":["matchRequests","read"], support:["support","read"],
    subscriptions:["subscriptions","read"],
    payments:["payments","read"], analytics:["analytics","read"], ai:["ai","read"],
    "billing-history":["payments","read"],
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
    set("reports", DATA.getReports().filter(function(r){ return r.status==="new"||r.status==="under_review"; }).length);
    set("matchRequests", (DATA.getMatchRequests()||[]).filter(function(r){ return r.status==="new" || r.status==="reviewing"; }).length);
    // Backend-driven count when available (REQ 55); fall back to the page
    // cache count for the pending filter when the stats didn't load.
    var stats = (typeof DATA.getProfessionalRequestStats === "function") ? DATA.getProfessionalRequestStats() : null;
    var regPending = (stats && typeof stats.pending === "number") ? stats.pending :
      ((DATA.getProfessionalRequests ? (DATA.getProfessionalRequests()||[]) : []).filter(function(r){ return r.status==="pending"; }).length);
    set("professionalRequests", regPending);
    set("payments", kpi.pendingPayments);
    var openSupport = (DATA.getSupportTickets ? DATA.getSupportTickets().filter(function(t){ return t.status==="open"||t.status==="pending"; }).length : 0);
    set("support", openSupport);
    var dot = document.getElementById("notifDot");
    var unread = (global.Sna3tiNotificationsLive && Sna3tiNotificationsLive.isReady())
      ? Sna3tiNotificationsLive.unreadCount()
      : DATA.getNotifications().filter(function(n){ return n.unread; }).length;
    if(dot){ dot.textContent = unread > 99 ? "99+" : (unread || ""); dot.style.display = unread>0 ? "" : "none"; }
  }

  function renderNotifications(){
    var panel = document.getElementById("notifPanel");
    var live = global.Sna3tiNotificationsLive;
    var ready = !!(live && live.isReady());
    if(live && !ready){ return; }
    var list = ready ? live.list() : DATA.getNotifications();
    var unread = ready ? live.unreadCount() : list.filter(function(n){ return n.unread; }).length;
    var NOTIF_ICO = { verification:"✅", payment:"💰", report:"🚩", subscription:"📦", registration:"📋", review:"⭐", user:"👥", system:"⚙️" };
    panel.innerHTML = '<div class="np-head"><span>'+T("Notifications")+'</span><span class="muted small">'+unread+' '+T("non lues")+'</span></div>' +
      (list.length ? list.map(function(n){
        var ico = NOTIF_ICO[n.type] || "🔔";
        return '<div class="notif-item '+(n.unread?"unread":"")+'" data-id="'+n.id+'" data-route="'+(n.route||"")+'">' +
               '<div class="n-ico">'+ico+'</div><div><div class="n-txt">'+esc(n.text)+'</div><div class="n-when">'+esc(n.when)+'</div></div></div>';
      }).join("") : '<div class="sp-empty">'+T("Aucune notification")+'</div>');
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
        results.push({ group:T("Artisans"), id:p.id, main : p.name, sub: p.job+" · "+p.city+" · "+p.id, route:"professionals/"+p.id, ico:"🧑‍🔧" });
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
    // registration requests
    DATA.getProfessionalRequests().forEach(function(r){
      if((r.id).toLowerCase().indexOf(q)>-1){ results.push({ group:T("Inscriptions"), id:r.id, main:idLabel(r), sub:T("Statut")+" "+r.status, route:"registrations", ico:"📋" }); }
    });

    if(results.length === 0){
      panel.innerHTML = '<div class="sp-empty">'+ T("Aucun résultat pour « {q} »").replace("{q}", esc(q)) +'</div>';
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
    // opts: { title, message, confirmLabel, confirmClass, cancelLabel,
    //         reasonLabel(bool), reasonRequired(bool),
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
      '<button class="btn '+(opts.confirmClass||"btn-danger-solid")+'" id="confirmOk">'+esc(opts.confirmLabel||T("Confirmer"))+'</button>' +
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
    // Bounded window: keep the current page centered (±2) and always expose
    // first/last so large server-side page counts stay navigable.
    totalPages = Math.max(1, Math.floor(+totalPages||1));
    page = Math.min(Math.max(1, Math.floor(+page||1)), totalPages);
    var h = '<div class="pagination">' +
      '<button '+(page<=1?'disabled':'')+' data-p="'+Math.max(1,page-1)+'" aria-label="'+T("Précédent")+'">‹</button>';
    var windowStart = Math.max(1, page-2);
    var windowEnd = Math.min(totalPages, page+2);
    var items = [];
    if(windowStart > 1){ items.push(1); if(windowStart > 2) items.push("gap"); }
    for(var i=windowStart;i<=windowEnd;i++){ items.push(i); }
    if(windowEnd < totalPages){ if(windowEnd < totalPages-1) items.push("gap"); items.push(totalPages); }
    items.forEach(function(p){
      if(p === "gap"){ h += '<span class="pg-gap">…</span>'; }
      else { h += '<button data-p="'+p+'" class="'+(p===page?'active':'')+'">'+p+'</button>'; }
    });
    h += '<button '+(page>=totalPages?'disabled':'')+' data-p="'+Math.min(totalPages,page+1)+'" aria-label="'+T("Suivant")+'">›</button></div>';
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
