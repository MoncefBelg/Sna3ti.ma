/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/admin-i18n.js
   Lightweight i18n (FR/EN) + dark-mode theme manager.
   Must be loaded first (before user-facing modules) so the
   whole shell and views can translate at render time.

   Model: T(frenchString, frenchFallback?) is the primary form.
   The argument IS the French source string (used as-is in FR).
   When the language is English, T() returns the English
   translation looked up from the FR->EN dictionary; unknown
   strings degrade gracefully back to French.
   ============================================================ */

(function (global) {
  "use strict";

  var STORE_LANG = "sna3ti-admin-lang";
  var STORE_THEME = "sna3ti-admin-theme";

  // FR -> EN translation table for every user-facing admin string.
  var EN = {
    // ---- app / shell ----
    "Administration": "Administration",
    "Tableau de bord": "Dashboard",
    "Rechercher...": "Search...",
    "Recherche globale": "Global search",
    "Se déconnecter": "Log out",
    "Notifications": "Notifications",
    "non lues": "unread",
    "Aucune notification": "No notifications",
    "Marketplace": "Marketplace",
    "Professionnels": "Professionals",
    "Utilisateurs": "Users",
    "Catégories": "Categories",
    "Villes": "Cities",
    "Confiance et sécurité": "Trust & safety",
    "Vérification": "Verification",
    "Avis": "Reviews",
    "Signalements": "Reports",
    "Business": "Business",
    "Abonnements": "Subscriptions",
    "Paiements": "Payments",
    "Insights": "Insights",
    "Analytiques": "Analytics",
    "AI Center": "AI Center",
    "Système": "System",
    "Réglages": "Settings",
    "Admin Users": "Admin Users",
    "Audit Logs": "Audit Logs",

    // ---- common actions ----
    "Annuler": "Cancel",
    "Confirmer": "Confirm",
    "Enregistrer": "Save",
    "Modifier": "Edit",
    "Supprimer": "Delete",
    "Retour": "Back",
    "Exporter": "Export",
    "Réessayer": "Retry",
    "Voir": "View",
    "Ajouter": "Add",
    "Raison": "Reason",
    "Expliquez la raison...": "Explain the reason...",
    "Veuillez fournir une raison.": "Please provide a reason.",
    "Oups, une erreur est survenue": "Oops, something went wrong",
    "Veuillez réessayer.": "Please try again.",

    // ---- login ----
    "Connexion": "Sign in",
    "Rôles illustrés": "Illustrated roles",
    "Mot de passe": "Password",
    "Afficher le mot de passe": "Show password",
    "Se souvenir de moi": "Remember me",
    "Se connecter": "Sign in",
    "Connexion...": "Signing in...",
    "Prototype — authentification de démonstration uniquement.": "Prototype — demo authentication only.",
    "Super Admin": "Super Admin",
    "Finance": "Finance",
    "Moderator": "Moderator",
    "Support": "Support",
    "Mot de passe": "Password",
    "Veuillez saisir votre email et mot de passe.": "Please enter your email and password.",
    "Identifiants invalides.": "Invalid credentials.",

    // ---- emails / roles labels -
    "Sna3ti": "Sna3ti",
    "Admin User": "Admin User",

    // ---- dashboard ----
    "Utilisateurs": "Users",
    "Professionnels": "Professionals",
    "Vérifiés": "Verified",
    "Vérifications en attente": "Pending verifications",
    "Abonnements actifs": "Active subscriptions",
    "Paiements en attente": "Pending payments",
    "Recherches": "Searches",
    "Revenus mensuels": "Monthly revenue",
    "vs mois dernier": "vs last month",
    "à traiter": "to process",
    "à confirmer": "to confirm",
    "vs hier": "vs yesterday",
    "Alertes": "Alerts",
    "Activité récente": "Recent activity",
    "Audit complet": "Full audit log",
    "Voir →": "View →",
    "File de travail Admin": "Admin work queue",
    "Actions humaines requises": "Human actions required",
    "en attente": "pending",
    "Type": "Type",
    "Priorité": "Priority",
    "Créé": "Created",
    "Assigné": "Assigned",
    "Statut": "Status",
    "Action": "Action",
    "Traiter": "Process",
    "Aucune tâche en attente.": "No pending tasks.",

    // ---- support module ----
    "Critique": "Critical",
    "Haute": "High",
    "Moyenne": "Medium",
    "Basse": "Low",
    "Demandes de support": "Support requests",
    "Tickets des professionnels et utilisateurs.": "Tickets from professionals and users.",
    "Ouvertes": "Open",
    "En attente": "Pending",
    "Résolues": "Resolved",
    "Ouverte": "Open",
    "Résolue": "Resolved",
    "Fermée": "Closed",
    "Aucun ticket.": "No tickets.",
    "Marquer résolu": "Mark resolved",
    "Répondre": "Reply",
    "Assigner": "Assign",
    "Envoyer": "Send",
    "Réponse": "Reply",
    "Réponse de": "Reply from",
    "Réponse envoyée.": "Reply sent.",
    "Ticket résolu.": "Ticket resolved.",
    "Ticket assigné.": "Ticket assigned.",
    "Assigner le ticket": "Assign the ticket",
    "Issue de paiement": "Payment issue",
    "Modification du profil": "Profile update",
    "Signalement d'un avis": "Review report",
    "Questions sur le pack GOLD": "Questions about the GOLD pack",
    "Mon virement est parti mais le badge n'est pas encore activé.": "My transfer was sent but the badge is not active yet.",
    "Je souhaite changer ma photo de profil et mon numéro de téléphone.": "I would like to change my profile photo and phone number.",
    "Un avis négatif non justifié a été publié sur mon profil.": "An unwarranted negative review was published on my profile.",
    "Comment passer au pack GOLD et combien ça coûte ?": "How do I upgrade to the GOLD pack and how much does it cost?",
    "Créé par": "Created by",
    "Assigné à": "Assigned to",
    "Clôturé": "Closed",

    // ---- professional 360 detail ----
    "avis": "reviews",
    "Description": "Description",
    "Services": "Services",
    "Zones d'intervention": "Service areas",
    "Relecteur": "Reviewer",
    "Documents soumis": "Submitted documents",
    "Décision": "Decision",
    "Date de décision": "Decision date",
    "Aucune demande de vérification.": "No verification request.",
    "Centre de vérification": "Verification center",
    "Approuvée": "Approved",
    "Rejetée": "Rejected",
    "En attente de décision.": "Pending a decision.",
    "Chronologique": "Chronological",
    "Activité": "Activity",
    "Compte professionnel créé": "Professional account created",
    "soumise": "submitted",
    "Total": "Total",
    "Signalés": "Flagged",

    // ---- professionals (list/filters) ----
    "Nouveau professionnel": "New professional",
    "Exporter CSV": "Export CSV",
    "Recherche": "Search",
    "Nom, métier, ville...": "Name, trade, city...",
    "Toutes": "All",
    "Profession": "Trade",
    "Vérification": "Verification",
    "Tous": "All",
    "Vérifiés": "Verified",
    "Non vérifiés": "Unverified",
    "Abonnement": "Subscription",
    "GRATUIT": "FREE",
    "VÉRIFIÉ": "VERIFIED",
    "GOLD": "GOLD",
    "Note min.": "Min. rating",
    "Toutes": "All",
    "et +": "and up",
    "Inscrit": "Registered",
    "Toute date": "Any date",
    "derniers jours": "last days",
    "Plus de 30 jours": "More than 30 days",
    "Sélection groupée": "Bulk actions",
    "Nom": "Name",
    "Note": "Rating",
    "Actions": "Actions",
    "sélectionné(s)": "selected",
    "Vérifier": "Verify",
    "Suspendre": "Suspend",
    "Activer": "Activate",
    "Fermer": "Close",

    // ---- misc ----
    "Ville": "City",
    "Paiement": "Payment",
    "Statut": "Status"
  };

  function loadLang(){
    try { return localStorage.getItem(STORE_LANG) || "fr"; } catch(e){ return "fr"; }
  }
  function loadTheme(){
    try { return localStorage.getItem(STORE_THEME) || "light"; } catch(e){ return "light"; }
  }

  var lang = (loadLang() === "en") ? "en" : "fr";
  var theme = (loadTheme() === "dark") ? "dark" : "light";

  function applyTheme(){
    if(global.document && global.document.documentElement){
      global.document.documentElement.setAttribute("data-theme", theme);
    }
  }

  // t(french, fallback?) -> if lang=en and french in dict, return en; else french.
  function t(fr, fallback){
    if(!fr && fr !== "") return fr;
    var base = String(fr);
    if(lang === "en"){
      return EN[base] || base;
    }
    return base;
  }

  function setLang(l){
    lang = (l === "en") ? "en" : "fr";
    try { localStorage.setItem(STORE_LANG, lang); } catch(e){}
    return lang;
  }

  function setTheme(th){
    theme = (th === "dark") ? "dark" : "light";
    try { localStorage.setItem(STORE_THEME, theme); } catch(e){}
    applyTheme();
    return theme;
  }

  function toggleTheme(){ return setTheme(theme === "dark" ? "light" : "dark"); }
  function getTheme(){ return theme; }
  function getLang(){ return lang; }

  // apply initial theme on load
  applyTheme();

  global.Sna3tiI18n = {
    t: t, setLang: setLang, getLang: getLang,
    setTheme: setTheme, toggleTheme: toggleTheme, getTheme: getTheme
  };

})(window);
