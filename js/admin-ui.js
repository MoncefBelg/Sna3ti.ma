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

  /* ---------- helpers ---------- */
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(m){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]; }); }
  function initials(name){ return esc((name||"?").charAt(0).toUpperCase()); }
  function fmtDate(d){ if(!d) return "—"; return d; }
  function debounce(fn, wait){
    var t; return function(){ var a=arguments, ctx=this; clearTimeout(t); t=setTimeout(function(){ fn.apply(ctx,a); }, wait); };
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
            '<div class="sidebar-brand"><div class="brand-logo">S</div><div><div class="brand-name">Sna3ti</div><div class="brand-sub">Administration</div></div></div>' +
          '</div>' +
          '<nav class="sidebar-nav" id="sidebarNav">' + navGroups + '</nav>' +
          '<div class="sidebar-foot" id="sideUser"></div>' +
        '</aside>' +
        '<div class="app-main">' +
          '<header class="topbar">' +
            '<button class="hamburger" id="hamburger" aria-label="Menu">☰</button>' +
            '<div class="topbar-title" id="topbarTitle">Tableau de bord</div>' +
            '<div class="topbar-spacer"></div>' +
            '<div class="search-wrap" id="globalSearchWrap"><span class="s-ico">🔍</span><input id="globalSearch" type="search" placeholder="Rechercher..." aria-label="Recherche globale" />' +
              '<div class="search-panel" id="searchPanel"></div></div>' +
            '<div class="dropdown" id="notifDrop">' +
              '<button class="icon-btn" id="notifBtn" aria-label="Notifications">🔔<span class="dot" id="notifDot"></span></button>' +
              '<div class="notif-panel" id="notifPanel"></div>' +
            '</div>' +
            '<div class="dropdown" id="userDrop">' +
              '<div class="top-user" id="topUser"></div>' +
              '<div class="menu" id="userMenu"></div>' +
            '</div>' +
          '</header>' +
          '<main class="content" id="content"></main>' +
        '</div>' +
      '</div>' +
      '<div class="modal-scrim" id="modalScrim"><div class="modal" id="modal"><div id="modalBody"></div></div></div>' +
      '<div class="toast" id="toast"></div>';

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

    renderSidebarUser();
  }

  function buildNavGroups(){
    var groups = [
      { label:"", items:[ { route:"dashboard", ico:"📊", label:"Tableau de bord" } ] },
      { label:"Marketplace", items:[
          { route:"professionals", ico:"🧑‍🔧", label:"Professionnels" },
          { route:"users", ico:"👥", label:"Utilisateurs" },
          { route:"categories", ico:"🗂️", label:"Catégories" },
          { route:"cities", ico:"📍", label:"Villes" }
        ]},
      { label:"Confiance et sécurité", items:[
          { route:"verification", ico:"✅", label:"Vérification", pill:"verification" },
          { route:"reviews", ico:"⭐", label:"Avis" },
          { route:"reports", ico:"🚩", label:"Signalements", pill:"reports" }
        ]},
      { label:"Business", items:[
          { route:"subscriptions", ico:"📦", label:"Abonnements" },
          { route:"payments", ico:"💰", label:"Paiements", pill:"payments" }
        ]},
      { label:"Insights", items:[
          { route:"analytics", ico:"📈", label:"Analytiques" },
          { route:"ai", ico:"🤖", label:"AI Center" }
        ]},
      { label:"Système", items:[
          { route:"notifications", ico:"🔔", label:"Notifications" },
          { route:"settings", ico:"⚙️", label:"Réglages" },
          { route:"admin-users", ico:"🛡️", label:"Admin Users" },
          { route:"audit-logs", ico:"📜", label:"Audit Logs" }
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
    reviews:["reviews","read"], reports:["reports","read"], subscriptions:["subscriptions","read"],
    payments:["payments","read"], analytics:["analytics","read"], ai:["ai","read"],
    notifications:["notifications","read"], settings:["settings","read"],
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
      '<button class="menu-item" data-action="logout"><span>👋</span> Se déconnecter</button>';
  }

  function updatePills(){
    var kpi = DATA.getKPIs();
    var set = function(id, n){ var el=document.getElementById("pill-"+id); if(el){ el.textContent=n; el.style.display = n>0?"":"none"; } };
    set("verification", kpi.pendingVerification);
    set("reports", DATA.getReports().filter(function(r){ return r.status==="new"||r.status==="under_review"; }).length);
    set("payments", kpi.pendingPayments);
    var dot = document.getElementById("notifDot");
    var unread = DATA.getNotifications().filter(function(n){ return n.unread; }).length;
    if(dot) dot.style.display = unread>0 ? "" : "none";
  }

  function renderNotifications(){
    var panel = document.getElementById("notifPanel");
    var list = DATA.getNotifications();
    panel.innerHTML = '<div class="np-head"><span>Notifications</span><span class="muted small">'+list.filter(function(n){return n.unread;}).length+' non lues</span></div>' +
      (list.length ? list.map(function(n){
        return '<div class="notif-item '+(n.unread?"unread":"")+'" data-id="'+n.id+'" data-route="'+n.route+'">' +
               '<div class="n-ico">'+n.ico+'</div><div><div class="n-txt">'+esc(n.text)+'</div><div class="n-when">'+esc(n.when)+'</div></div></div>';
      }).join("") : '<div class="sp-empty">Aucune notification</div>');
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
        results.push({ group:"Professionnel", id:p.id, main : p.name, sub: p.job+" · "+p.city+" · "+p.id, route:"professionals/"+p.id, ico:"🧑‍🔧" });
      }
    });
    // users
    DATA.getUsers().forEach(function(u){
      if((u.name+" "+u.email+" "+(u.phone||"")).toLowerCase().indexOf(q)>-1){
        results.push({ group:"Utilisateur", id:u.id, main:u.name, sub:u.email+" · "+(u.phone||""), route:"users", ico:"👥" });
      }
    });
    // cities
    DATA.getRegions().forEach(function(r){ r.cities.forEach(function(c){
      var cn = c.name.fr;
      if(cn.toLowerCase().indexOf(q)>-1){ results.push({ group:"Ville", id:c.id, main:cn, sub:"City ID "+c.id, route:"cities", ico:"📍" }); }
    }); });
    // payments
    DATA.getPayments().forEach(function(pa){
      if((pa.reference+" "+pa.planName+" "+pa.amount).toLowerCase().indexOf(q)>-1){
        results.push({ group:"Paiement", id:pa.id, main:pa.reference+" · "+pa.planName, sub:pa.amount+" DH · "+pa.status, route:"payments", ico:"💰" });
      }
    });
    // verifications
    DATA.getVerificationRequests().forEach(function(v){
      if((v.id).toLowerCase().indexOf(q)>-1){ results.push({ group:"Vérification", id:v.id, main:v.id, sub:"statut "+v.status, route:"verification", ico:"✅" }); }
    });

    if(results.length === 0){
      panel.innerHTML = '<div class="sp-empty">Aucun résultat pour « '+esc(q)+' »</div>';
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

  function setContent(html){ contentEl.innerHTML = html || ""; }

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
    setContent('<div class="msg-box"><div class="b">🚧 Oups, une erreur est survenue</div><p class="muted">'+esc(text||"Veuillez réessayer.")+'</p><button class="btn btn-ghost" onclick="window.Sna3tiUI.reload()">Réessayer</button></div>');
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
  function openModal(html, wide){
    var scrim = document.getElementById("modalScrim");
    var modal = document.getElementById("modal");
    modal.classList.toggle("modal-wide", !!wide);
    document.getElementById("modalBody").innerHTML = html;
    scrim.classList.add("show");
    var f = modal.querySelector("input, select, textarea");
    if(f) setTimeout(function(){ f.focus(); }, 60);
  }
  function closeModal(){ document.getElementById("modalScrim").classList.remove("show"); }

  // confirm with reason for destructive/sensitive actions
  function confirmAction(opts){
    // opts: { title, message, confirmLabel, reasonLabel(bool), reasonRequired(bool),
    //         onConfirm(reason) }
    var html = '<h3>'+esc(opts.title||"Confirmer")+'</h3>';
    if(opts.message) html += '<p class="subtle" style="font-size:13.5px;color:var(--muted)">'+opts.message+'</p>';
    if(opts.reasonLabel || opts.reasonRequired){
      html += '<div class="frm"><div class="frm"><label>'+esc(opts.reasonLabel||"Raison")+' *</label><textarea id="confirmReason" placeholder="Expliquez la raison..." required="'+!!opts.reasonRequired+'"></textarea></div></div>';
    }
    html += '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="window.Sna3tiUI.cancelAction()">Annuler</button>' +
      '<button class="btn btn-danger-solid" id="confirmOk">'+esc(opts.confirmLabel||"Confirmer")+'</button>' +
      '</div>';
    openModal(html);
    var cb = opts.onConfirm;
    document.getElementById("confirmOk").addEventListener("click", function(){
      var reason = (document.getElementById("confirmReason") ? document.getElementById("confirmReason").value.trim() : "");
      if(opts.reasonRequired && !reason){
        toast("Veuillez fournir une raison.", true); return;
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
