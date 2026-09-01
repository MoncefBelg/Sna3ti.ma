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
    "Mode sombre": "Dark mode",
    "Changer la langue": "Change language",
    "Menu utilisateur": "User menu",
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
    "Contenu légal": "Legal content",
    "Documents juridiques publiés sur le site public.": "Legal documents published on the public site.",
    "Publié": "Published",
    "Non publié": "Unpublished",
    "Brouillon": "Draft",
    "Langue": "Language",
    "Titre": "Title",
    "Introduction": "Intro",
    "Sections": "Sections",
    "Ajouter une section": "Add section",
    "Titre de section": "Section heading",
    "Texte de section": "Section body",
    "Mis à jour par": "Updated by",
    "Chaque document est édité par langue (FR/EN/AR). Le contenu est structuré et sera servi par l'API backend à terme.": "Each document is edited per language (FR/EN/AR). Content is structured and will be served by the backend API later.",
    "Aucun document légal": "No legal documents",
    "Document introuvable.": "Document not found.",
    "Document enregistré.": "Document saved.",
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
    "Erreur de chargement": "Loading error",
    "Aucun paiement.": "No payments.",
    "Plan activé": "Plan activated",

    // ---- login ----
    "Connexion": "Sign in",
    "Rôles illustrés": "Illustrated roles",
    "Mot de passe": "Password",
    "Afficher le mot de passe": "Show password",
    "Se souvenir de moi": "Remember me",
    "Se connecter": "Sign in",
    "Connexion...": "Signing in...",
    "Prototype — authentification de démonstration uniquement.": "Prototype — demo authentication only.",
    "Prototype — stockage et authentification": "Prototype — storage & authentication",
    "Les données de démonstration sont stockées localement dans votre navigateur (localStorage) et les rôles / l'authentification sont simulés. Ce prototype n'implémente aucune sécurité de production : aucun serveur, aucune base de données réelle, aucun chiffrement réel. La couche de données est conçue pour être raccordée ultérieurement à une API backend et à une base de données PostgreSQL.": "Demo data is stored locally in your browser (localStorage) and roles/authentication are simulated. This is a prototype: it implements no production security — no server, no real database, no real encryption. The data layer is designed to be wired up later to a backend API and a PostgreSQL database.",
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
    "Métier": "Trade",
    "Date de soumission": "Submission date",
    "Trier :": "Sort:",
    "Plus ancien d'abord": "Oldest first",
    "Plus récent d'abord": "Newest first",
    "Priorité la plus haute": "Highest priority",
    "Réinitialiser": "Reset",
    "Rejeter vérification": "Reject verification",
    "Rejeter la vérification de ce professionnel ?": "Reject this professional's verification?",
    "Changer d'abonnement": "Change subscription",
    "Changer l'abonnement": "Change subscription",
    "Sélectionnez le nouveau plan de ce professionnel.": "Select the new plan for this professional.",
    "Sélectionnez un plan.": "Select a plan.",
    "Appliquer le plan": "Apply plan",
    "Abonnement changé vers ": "Subscription changed to ",
    "Action irréversible.": "Irreversible action.",
    "Action irréversible. Le profil, ses abonnements, paiements, avis et demandes seront retirés de la plateforme.": "Irreversible action. The profile, its subscriptions, payments, reviews and requests will be removed from the platform.",

    // ---- verification: rejection + request info ----
    "Document d'identité invalide": "Invalid identity document",
    "Incohérence d'informations": "Information mismatch",
    "Preuves insuffisantes": "Insufficient proof",
    "Portfolio insuffisant": "Portfolio insufficient",
    "Activité suspecte": "Suspicious activity",
    "Autre": "Other",
    "Précision (si « Autre »)": "Detail (if \"Other\")",
    "Détaillez le motif...": "Describe the reason...",
    "Demander des informations": "Request more information",
    "Informations demandées": "Information requested",
    "Envoyer la demande": "Send request",
    "Demande d'informations envoyée au professionnel.": "Information request sent to the professional.",

    // ---- subscriptions stats + benefits ----
    "Abonnés actifs": "Active subscribers",
    "Abonnements expirés": "Expired subscriptions",
    "Abonnements annulés": "Cancelled subscriptions",
    "Revenu mensuel récurrent (MRR)": "Monthly recurring revenue (MRR)",
    "abonnements en cours": "active subscriptions",
    "non renouvelés": "not renewed",
    "annulations": "cancellations",
    "plans payants actifs": "active paid plans",
    "Expiré": "Expired",
    "Annulé": "Cancelled",
    "Approbation requise": "Approval required",
    "Visibilité dans les recherches": "Search visibility",
    "Avis": "Reviews",
    "Visibilité prioritaire": "Priority visibility",
    "Profil mis en avant": "Featured profile",
    "Assistant IA de profil": "AI Profile Assistant",
    "Support VIP": "VIP support",

    // ---- reports (req 22) ----
    "Ouvrir": "Open",
    "Ouvrir / prendre en charge": "Open / take charge",
    "Créé": "Created",
    "Assigné à": "Assigned to",
    "Nouvelle": "New",
    "Signalement ouvert (en cours de traitement).": "Report opened (in progress).",
    "Faux professionnel": "Fake professional",
    "Prix trompeur": "Misleading price",
    "Faux avis": "Fake review",
    "Fraude": "Fraud",
    "Spam": "Spam",
    "Contenu inapproprié": "Inappropriate content",
    "Mauvaise information": "Wrong information",
    "Harcèlement": "Harassment",
    "Réclamation client": "Customer complaint",
    "Signalé par": "Reported by",

    // ---- users (req 20) ----
    "Trier": "Sort",
    "Inscription": "Registration",
    "Voir le profil": "View profile",
    "Page": "Page",
    "Précédent": "Previous",
    "Suivant": "Next",
    "utilisateurs": "users",
    "Inscrit le": "Registered on",
    "Activité de recherche": "Search activity",
    "recherches récentes enregistrées": "recent recorded searches",
    "Professionnels consultés": "Viewed professionals",
    "Demandes de contact": "Contact requests",
    "demandes de contact envoyées": "contact requests sent",
    "Profils gérés": "Managed profiles",
    "Signalements": "Reports",

    // ---- payments copy aligned with rule 19 ----
    "Confirmer (active la souscription VÉRIFIÉ/GOLD)": "Confirm (activates VÉRIFIÉ/GOLD subscription)",
    "Abonnement VÉRIFIÉ/GOLD activé (badge vérifié = processus distinct)": "VÉRIFIÉ/GOLD subscription activated (verified badge = separate process)",
    "Confirmer le paiement active la souscription VÉRIFIÉ (99 DH/mois) ou GOLD (199 DH/mois). Le badge “Professionnel Vérifié” reste soumis à une vérification distincte et ne se déclenche jamais automatiquement par le paiement seul.": "Confirming the payment activates the VÉRIFIÉ (99 DH/month) or GOLD (199 DH/month) subscription. The \"Verified Professional\" badge remains subject to a separate verification and is never triggered automatically by the payment alone.",
    "Après contrôle du virement, la souscription VÉRIFIÉ ou GOLD sera activée sur le profil. Le badge « Professionnel Vérifié » reste soumis à une vérification distincte, indépendante du paiement.": "After checking the transfer, the VÉRIFIÉ or GOLD subscription will be activated on the profile. The \"Verified Professional\" badge remains subject to a separate verification, independent of the payment.",
    "Paiement confirmé — souscription activée (vérification du badge = processus distinct).": "Payment confirmed - subscription activated (badge verification = separate process).",

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

    // ---- categories (req 23) ----
    "Sous-catégorie": "Subcategory",
    "sous-catégories": "subcategories",
    "services": "services",
    "Catégorie → Sous-catégorie → Service": "Category → Subcategory → Service",
    "Chaque service : nom FR/AR/EN, icône, description, statut et ordre d'affichage.": "Each service: FR/AR/EN name, icon, description, status and display order.",
    "Ordre": "Order",
    "Code": "Code",
    "Monter": "Move up",
    "Descendre": "Move down",
    "Dupliquer": "Duplicate",
    "Déjà en limite.": "Already at the limit.",
    "Statut mis à jour.": "Status updated.",
    "Impossible : élément utilisé par un professionnel.": "Not possible: item is used by a professional.",
    "Nom (FR) :": "Name (FR):",
    "Nom (AR) :": "Name (AR):",
    "Nom (EN) :": "Name (EN):",
    "Icône (emoji) :": "Icon (emoji):",
    "Description :": "Description:",
    "Catégorie ajoutée.": "Category added.",
    "Catégorie modifiée.": "Category updated.",
    "Catégorie dupliquée.": "Category duplicated.",
    "Catégorie supprimée.": "Category deleted.",
    "Sous-catégorie ajoutée.": "Subcategory added.",
    "Sous-catégorie modifiée.": "Subcategory updated.",
    "Sous-catégorie dupliquée.": "Subcategory duplicated.",
    "Sous-catégorie supprimée.": "Subcategory deleted.",
    "Service ajouté.": "Service added.",
    "Service modifié.": "Service updated.",
    "Service dupliqué.": "Service duplicated.",
    "Service supprimé.": "Service deleted.",
    "Supprimer cette catégorie ?": "Delete this category?",
    "La catégorie et ses sous-catégories/services seront retirés.": "The category and its subcategories/services will be removed.",
    "Supprimer cette sous-catégorie ?": "Delete this subcategory?",
    "La sous-catégorie et ses services seront retirés.": "The subcategory and its services will be removed.",
    "Supprimer ce service ?": "Delete this service?",

    // ---- cities (req 24) ----
    "Région": "Region",
    "villes": "cities",
    "quartiers": "neighborhoods",
    "Structure Région → Ville → Quartiers, multilingue FR/AR/EN avec statut et ordre.": "Region → City → Neighborhood structure, FR/AR/EN multilingual with status and order.",
    "Nom de la région (FR) :": "Region name (FR):",
    "Nom de la ville (FR) :": "City name (FR):",
    "Nom du quartier :": "Neighborhood name:",
    "Région ajoutée.": "Region added.",
    "Région modifiée.": "Region updated.",
    "Région dupliquée.": "Region duplicated.",
    "Région supprimée.": "Region deleted.",
    "Ville ajoutée.": "City added.",
    "Ville modifiée.": "City updated.",
    "Ville dupliquée.": "City duplicated.",
    "Ville supprimée.": "City deleted.",
    "Quartier ajouté.": "Neighborhood added.",
    "Impossible : région utilisée.": "Not possible: region in use.",
    "Impossible : ville utilisée par un utilisateur ou professionnel.": "Not possible: city used by a user or professional.",
    "Supprimer cette région ?": "Delete this region?",
    "Région et ses villes seront retirées.": "The region and its cities will be removed.",
    "Supprimer cette ville ?": "Delete this city?",

    // ---- analytics (req 25) ----
    "Visites": "Visits",
    "Inscriptions": "Signups",
    "Top villes": "Top cities",
    "Top services": "Top services",
    "Sources de leads": "Lead sources",
    "Téléphone": "Phone",
    "Formulaire": "Form",
    "mois": "months",
    "Période": "Period",
    "Période personnalisée": "Custom period",
    "Du": "From",
    "Au": "To",
    "Aujourd'hui": "Today",
    "7 jours": "7 days",
    "30 jours": "30 days",
    "90 jours": "90 days",
    "12 mois": "12 months",
    "Taux de conversion": "Conversion rate",
    "récurrent mensuel": "monthly recurring",
    "Note moyenne": "Average rating",
    "Free → Payant": "Free → Paid",
    "Recherches sans résultat": "Searches without results",

    // ---- AI Center (req 26, prototype-only) ----
    "Prototype": "Prototype",
    "Aperçu IA (insights mock)": "AI overview (mock insights)",
    "Exemples de demandes clients ayant transité par l'interprétation IA — données simulées en attendant l'API.": "Examples of customer requests processed by the AI interpreter — simulated data until the API is connected.",
    "Provider": "Provider",
    "endpoint API": "API endpoint",
    "Erreur d'interprétation.": "Interpretation error.",

    // ---- misc ----
    "Ville": "City",
    "Paiement": "Payment",
    "Statut": "Status",

    // ---- specs 27-30: notifications filters, settings, payment detail ----
    "Non lues": "Unread",
    "Lues": "Read",
    "Toutes": "All",
    "Tout marquer lu": "Mark all read",
    "Marquer comme lue": "Mark as read",
    "Notification lue.": "Notification read.",
    "Aucune notification.": "No notifications.",
    "Toutes les notifications lues.": "All notifications read.",
    "Nouveau": "New",
    "Modifications non enregistrées": "Unsaved changes",
    "Nom de la plateforme": "Platform name",
    "Email de contact": "Contact email",
    "Langue par défaut": "Default language",
    "Général": "General",
    "Documents requis": "Required documents",
    "Contrôles requis": "Required checks",
    "Règles marketplace": "Marketplace rules",
    "Un compte gratuit peut exister sans vérification professionnelle.": "A free account can exist without professional verification.",
    "La vérification d'identité est distincte de l'abonnement.": "Identity verification is separate from the subscription.",
    "La vérification professionnelle est distincte de l'abonnement.": "Professional verification is separate from the subscription.",
    "Le paiement n'accorde pas automatiquement la confiance.": "Payment does not automatically grant trust.",
    "GOLD ne signifie pas automatiquement vérifié.": "GOLD does not automatically mean verified.",
    "Confirmation du paiement requise avant activation.": "Payment confirmation required before activation.",
    "Réglages enregistrés.": "Settings saved.",
    "Modifications annulées.": "Changes cancelled.",
    "Réinitialiser les réglages ?": "Reset settings?",
    "Restaurera les valeurs par défaut. Les modifications non enregistrées seront perdues.": "Will restore the default values. Unsaved changes will be lost.",
    "Réglages réinitialisés.": "Settings reset.",
    "Tous les paiements": "All payments",
    "Référence": "Reference",
    "Professionnel": "Professional",
    "Plan": "Plan",
    "Montant": "Amount",
    "Méthode": "Method",
    "Réf. bancaire": "Bank ref.",
    "Référence bancaire": "Bank reference",
    "Raison du rejet": "Rejection reason",
    "Informations demandées": "Information requested",
    "Demande d'abonnement liée": "Linked subscription request",
    "Centre de modération": "Moderation center",
    "Export généré.": "Export generated.",
    "Prix": "Price",
    "Début": "Start",
    "Renouvellement": "Renewal",
    "Client": "Customer",
    "Commentaire": "Comment",
    "Description": "Description",
    "ID": "ID",
    "Abonnés": "Subscribers"
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
