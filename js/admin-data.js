/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/admin-data.js
   Data layer: schema, roles, permissions, realistic Moroccan mock data,
   and a service facade (Sna3tiData) decoupled from UI.
   Future: swap mock implementations for real API calls.
   ============================================================ */

(function (global) {
  "use strict";

  var I18N = global.Sna3tiI18n || { t:function(s){ return s; } };
  function T(s){ return I18N.t(s); }

  // REQ 52: admin-scoped professional API (loaded before admin-data.js).
  var ProfApi = global.Sna3tiProfessionalsApi || null;
  // REQ 52: payments API (loaded before admin-data.js). The Sna3ti payment
  // model is manual bank transfer only; the professional never shares a bank
  // account/IBAN, card, CVV or online-banking credentials with Sna3ti. Only
  // tracking/proof references (reference, bankRef, receipt) are kept.
  var PayApi = global.Sna3tiPaymentsApi || null;

  // REQ 52: pure idempotency helper — true when a payment is already in a
  // terminal state and should not be re-processed (used to mirror the backend
  // 409 guard in the read model; the backend remains authoritative).
  function isPayTerminal(status){ return status === "confirmed" || status === "rejected"; }

  /* ---------- Roles & permissions (RBAC) ---------- */
  // NOTE: For prototype only. Production authorization MUST be
  // enforced server-side. Never trust client-side permissions alone.

  var PERMISSION_CATALOG = {
    dashboard: ["read"],
    users: ["read", "update", "suspend", "delete"],
    professionals: ["read", "update", "verify", "suspend", "activate", "delete"],
    verification: ["read", "approve", "reject"],
    reviews: ["read", "moderate", "delete"],
    reports: ["read", "resolve", "warn", "suspend"],
    support: ["read", "update", "assign"],
    categories: ["read", "update"],
    cities: ["read", "update"],
    subscriptions: ["read", "update"],
    payments: ["read", "approve", "reject"],
    analytics: ["read"],
    ai: ["read"],
    notifications: ["read", "send"],
    settings: ["read", "update"],
    legal: ["read", "update"],
    adminUsers: ["read", "update"],
    auditLogs: ["read", "export"]
  };

  var ROLES = {
    "super_admin": {
      label: T("Super Admin"),
      color: "purple",
      permissions: { dashboard:["read"], users:["read","update","suspend","delete"], professionals:["read","update","verify","suspend","activate","delete"], verification:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve","warn","suspend"], support:["read","update","assign"], categories:["read","update"], cities:["read","update"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], ai:["read"], notifications:["read","send"], settings:["read","update"], legal:["read","update"], adminUsers:["read","update"], auditLogs:["read","export"] }
    },
    "admin": {
      label: T("Admin"),
      color: "teal",
      permissions: { dashboard:["read"], users:["read","update","suspend"], professionals:["read","update","verify","suspend","activate"], verification:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve"], support:["read","update","assign"], categories:["read","update"], cities:["read","update"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], ai:["read"], notifications:["read","send"], settings:["read","update"], legal:["read","update"], adminUsers:["read"], auditLogs:["read"] }
    },
    "moderator": {
      label: T("Moderator"),
      color: "blue",
      permissions: { dashboard:["read"], users:["read"], professionals:["read","update","verify"], verification:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve","warn","suspend"], analytics:["read"], notifications:["read","send"], auditLogs:["read"] }
    },
    "support": {
      label: T("Support"),
      color: "orange",
      permissions: { dashboard:["read"], users:["read","update","suspend"], professionals:["read","update"], reviews:["read"], reports:["read","resolve"], support:["read","update","assign"], notifications:["read","send"], auditLogs:["read"] }
    },
    "finance": {
      label: T("Finance"),
      color: "amber",
      permissions: { dashboard:["read"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], auditLogs:["read","export"] }
    }
  };

  // Config has default verification checklist + required documents.
  var CONFIG = {
    platformName: "Sna3ti.ma",
    contactEmail: "support@sna3ti.ma",
    phone: "212600000000",
    defaultLanguage: "fr",
    verification: {
      requiredDocuments: [T("Photo de profil"), T("Photo de travail (échantillons)")],
      requiredChecks: [
        "profile_photo_clear",
        "profile_photo_no_sunglasses",
        "profile_photo_main_frame",
        "echantillons_reviewed"
      ],
      checkLabels: {
        profile_photo_clear: T("Photo de profil nette (pas floue)"),
        profile_photo_no_sunglasses: T("Photo sans lunettes de soleil"),
        profile_photo_main_frame: T("Personne dans le cadre principal"),
        echantillons_reviewed: T("Échantillons de travail conformes")
}
    }
  };

  // Pristine baseline of the default settings, so the Settings view's
  // "Reset" can restore them even after the user has saved custom values.
  var CONFIG_DEFAULTS = JSON.parse(JSON.stringify(CONFIG));

  /* ---------- Seed data ---------- */

  var CATEGORIES = [
    { id:"CAT-PLUMB", code:"plomberie", icon:"🔧", order:1, active:true,
      label:{ fr:"Plomberie", ar:"السباكة", en:"Plumbing" },
      services:[
        { id:"SVC-FUITE", code:"fuite-eau", label:{fr:"Fuite d'eau",ar:"تسرب الماء",en:"Leak repair"} },
        { id:"SVC-DEBO", code:"debouclage", label:{fr:"Débouchage",ar:"إزالة الانسداد",en:"Drain unclogging"} },
        { id:"SVC-CHA", code:"chauffe-eau", label:{fr:"Chauffe-eau",ar:"سخان الماء",en:"Water heater"} },
        { id:"SVC-INST", code:"installation-sanitaire", label:{fr:"Installation sanitaire",ar:"تركيب صحية",en:"Sanitary installation"} }
      ] },
    { id:"CAT-ELEC", code:"electricite", icon:"💡", order:2, active:true,
      label:{ fr:"Électricité", ar:"الكهرباء", en:"Electricity" },
      services:[
        { id:"SVC-ELEC-1", code:"installation", label:{fr:"Installation électrique",ar:"تركيب كهربائي",en:"Electrical installation"} },
        { id:"SVC-ELEC-2", code:"depannage", label:{fr:"Dépannage",ar:"إصلاح",en:"Repair"} }
      ] },
    { id:"CAT-COIF", code:"coiffure", icon:"💇", order:3, active:true,
      label:{ fr:"Coiffure", ar:"الحلاقة", en:"Hairdressing" },
      services:[
        { id:"SVC-COIF-1", code:"femme", label:{fr:"Coiffure femme",ar:"تصفيف نساء",en:"Womens styling"} },
        { id:"SVC-COIF-2", code:"homme", label:{fr:"Coiffure homme",ar:"حلاقة رجال",en:"Mens grooming"} }
      ] },
    { id:"CAT-MENU", code:"menuiserie", icon:"🪚", order:4, active:true,
      label:{ fr:"Menuiserie", ar:"النجارة", en:"Carpentry" },
      services:[
        { id:"SVC-MENU-1", code:"meubles", label:{fr:"Meubles sur mesure",ar:"أثاث حسب الطلب",en:"Custom furniture"} },
        { id:"SVC-MENU-2", code:"reparation", label:{fr:"Réparation",ar:"إصلاح",en:"Repair"} }
      ] },
    { id:"CAT-MAQC", code:"maçonnerie", icon:"🧱", order:5, active:true,
      label:{ fr:"Maçonnerie", ar:"البناء", en:"Masonry" },
      services:[
        { id:"SVC-MAQC-1", code:"gros-oeuvre", label:{fr:"Gros œuvre",ar:"أعمال البناء",en:"Structural work"} }
      ] },
    { id:"CAT-PEIN", code:"peinture", icon:"🎨", order:6, active:true,
      label:{ fr:"Peinture", ar:"الدهان", en:"Painting" },
      services:[
        { id:"SVC-PEIN-1", code:"interieur", label:{fr:"Peinture intérieure",ar:"دهن داخلي",en:"Interior painting"} },
        { id:"SVC-PEIN-2", code:"exterieur", label:{fr:"Peinture extérieure",ar:"دهن خارجي",en:"Exterior painting"} }
      ] },
    { id:"CAT-MECA", code:"mecanique", icon:"🔧", order:7, active:true,
      label:{ fr:"Mécanique", ar:"الميكانيك", en:"Mechanics" },
      services:[
        { id:"SVC-MECA-1", code:"auto", label:{fr:"Mécanique auto",ar:"ميكانيك السيارات",en:"Car mechanics"} }
      ] }
  ];

  var REGIONS = [
    { id:"REG-CASA", name:{fr:"Casablanca-Settat",ar:"الدار البيضاء - سطات",en:"Casablanca-Settat"}, order:1,
      cities:[
        { id:"CITY-CASA", name:{fr:"Casablanca",ar:"الدار البيضاء",en:"Casablanca"}, order:1,
          neighborhoods:["Maarif","Gauthier","Aïn Sebaâ","Sidi Maarouf","Hay Hassani","Sidi Bernoussi"] },
        { id:"CITY-MOHAM", name:{fr:"Mohammédia",ar:"المحمدية",en:"Mohammedia"}, order:2, neighborhoods:["Centre","Zone industrielle"] },
        { id:"CITY-ELJ", name:{fr:"El Jadida",ar:"الجديدة",en:"El Jadida"}, order:3, neighborhoods:["Centre","Sidi Bouzid"] },
        { id:"CITY-SETT", name:{fr:"Settat",ar:"سطات",en:"Settat"}, order:4, neighborhoods:["Centre"] }
      ] },
    { id:"REG-RABA", name:{fr:"Rabat-Salé-Kénitra",ar:"الرباط - سلا - القنيطرة",en:"Rabat-Sale-Kenitra"}, order:2,
      cities:[
        { id:"CITY-RABA", name:{fr:"Rabat",ar:"الرباط",en:"Rabat"}, order:1, neighborhoods:["Agdal","Hay Riad","Hassan"] },
        { id:"CITY-KENI", name:{fr:"Kénitra",ar:"القنيطرة",en:"Kenitra"}, order:2, neighborhoods:["Centre"] }
      ] },
    { id:"REG-MARR", name:{fr:"Marrakech-Safi",ar:"مراكش - آسفي",en:"Marrakech-Safi"}, order:3,
      cities:[
        { id:"CITY-MARR", name:{fr:"Marrakech",ar:"مراكش",en:"Marrakech"}, order:1, neighborhoods:["Guéliz","Médina","Hivernage","Daoudiate"] }
      ] },
    { id:"REG-FES", name:{fr:"Fès-Meknès",ar:"فاس - مكناس",en:"Fes-Meknes"}, order:4,
      cities:[
        { id:"CITY-FES", name:{fr:"Fès",ar:"فاس",en:"Fes"}, order:1, neighborhoods:["Ville Nouvelle","Médina"] },
        { id:"CITY-MEKN", name:{fr:"Meknès",ar:"مكناس",en:"Meknes"}, order:2, neighborhoods:["Centre","Hamria"] }
      ] },
    { id:"REG-TANG", name:{fr:"Tanger-Tétouan",ar:"طنجة - تطوان",en:"Tangier-Tetouan"}, order:5,
      cities:[
        { id:"CITY-TANG", name:{fr:"Tanger",ar:"طنجة",en:"Tangier"}, order:1, neighborhoods:["Centre","Malabata","Boukhalf"] }
      ] },
    { id:"REG-SOUS", name:{fr:"Souss-Massa",ar:"سوس - ماسة",en:"Souss-Massa"}, order:6,
      cities:[
        { id:"CITY-AGAD", name:{fr:"Agadir",ar:"أكادير",en:"Agadir"}, order:1, neighborhoods:["Centre","Founty","Tikiouine"] }
      ] },
    { id:"REG-ORIE", name:{fr:"Oriental",ar:"الشرق",en:"Oriental"}, order:7,
      cities:[
        { id:"CITY-OJDA", name:{fr:"Oujda",ar:"وجدة",en:"Oujda"}, order:1, neighborhoods:["Centre"] }
      ] }
  ];

  // Professionals. relationship to users via userId.
  var USERS = [
    { id:"USR-1", name:"Yassine El Amrani", email:"yassine.elamrani@mail.ma", phone:"0612345678", cityId:"CITY-CASA", status:"active", registered:"2025-03-12" },
    { id:"USR-2", name:"Ahmed Benali", email:"ahmed.benali@mail.ma", phone:"0611223344", cityId:"CITY-RABA", status:"active", registered:"2025-06-01" },
    { id:"USR-3", name:"Karim Alaoui", email:"karim.alaoui@mail.ma", phone:"0622334455", cityId:"CITY-MARR", status:"active", registered:"2024-11-20" },
    { id:"USR-4", name:"Omar Tazi", email:"omar.tazi@mail.ma", phone:"0633445566", cityId:"CITY-CASA", status:"active", registered:"2025-09-05" },
    { id:"USR-5", name:"Nadia Cherkaoui", email:"nadia.cherkaoui@mail.ma", phone:"0644556677", cityId:"CITY-FES", status:"active", registered:"2025-07-18" },
    { id:"USR-6", name:"Salma Bensalah", email:"salma.bensalah@mail.ma", phone:"0655667788", cityId:"CITY-AGAD", status:"active", registered:"2025-01-30" },
    { id:"USR-7", name:"Hicham Fassi", email:"hicham.fassi@mail.ma", phone:"0666778899", cityId:"CITY-RABA", status:"suspended", registered:"2024-08-14" },
    { id:"USR-8", name:"Leila Mansouri", email:"leila.mansouri@mail.ma", phone:"0677889900", cityId:"CITY-CASA", status:"active", registered:"2025-02-22" }
  ];

  var PROFESSIONALS = [
    { id:"PRO-10294", userId:"USR-1", professionId:"SVC-PLUMB-1", name:"Yassine El Amrani", job:"Plombier", categoryId:"CAT-PLUMB", category:"Plomberie",
      cityId:"CITY-CASA", city:"Casablanca", area:"Maarif", rating:4.8, reviewsCount:132, price:150,
      identityStatus:"verified", verificationStatus:"approved", professionStatus:"verified",
      subscriptionPlanId:"PLAN-VERIFIED", subscriptionStatus:"active", verified:true, package:"verified",
      status:"active", available:true, distance:2, phone:"0612345678", email:"yassine.elamrani@mail.ma",
      experience:"12 ans", languages:["français","arabe"], created:"2025-03-12",
      description:"Plombier professionnel spécialisé dans les installations et dépannages.",
      leads:{ profileViews:1240, phoneClicks:842, whatsappClicks:1200, contactRequests:437, conversion:3.4 },
      portfolio:[ { id:"PF-1", src:"", label:"Installation salle de bain" }, { id:"PF-2", src:"", label:"Dépannage chauffe-eau" } ] },
    { id:"PRO-10295", userId:"USR-2", professionId:"SVC-ELEC-1", name:"Ahmed Benali", job:"Électricien", categoryId:"CAT-ELEC", category:"Électricité",
      cityId:"CITY-RABA", city:"Rabat", area:"Agdal", rating:4.5, reviewsCount:98, price:180,
      identityStatus:"pending", verificationStatus:"pending", professionStatus:"pending",
      subscriptionPlanId:"PLAN-FREE", subscriptionStatus:"active", verified:false, package:"free",
      status:"pending", available:true, distance:5, phone:"0611223344", email:"ahmed.benali@mail.ma",
      experience:"8 ans", languages:["français","anglais"], created:"2025-06-01",
      description:"Électricien pour installations et dépannages électriques.",
      leads:{ profileViews:410, phoneClicks:205, whatsappClicks:360, contactRequests:118, conversion:2.1 },
      portfolio:[ { id:"PF-3", src:"", label:"Tableau électrique" } ] },
    { id:"PRO-10296", userId:"USR-3", professionId:"SVC-MENU-1", name:"Karim Alaoui", job:"Menuisier", categoryId:"CAT-MENU", category:"Menuiserie",
      cityId:"CITY-MARR", city:"Marrakech", area:"Guéliz", rating:4.9, reviewsCount:210, price:200,
      identityStatus:"verified", verificationStatus:"approved", professionStatus:"verified",
      subscriptionPlanId:"PLAN-GOLD", subscriptionStatus:"active", verified:true, package:"gold",
      status:"active", available:true, distance:3, phone:"0622334455", email:"karim.alaoui@mail.ma",
      experience:"20 ans", languages:["français","arabe","amazigh"], created:"2024-11-20",
      description:"Menuisier d'art, meubles sur mesure et agencements haut de gamme.",
      leads:{ profileViews:2300, phoneClicks:1420, whatsappClicks:1900, contactRequests:621, conversion:4.1 },
      portfolio:[ { id:"PF-4", src:"", label:"Bibliothèque sur mesure" }, { id:"PF-5", src:"", label:"Dressing GOLD" } ] },
    { id:"PRO-10297", userId:"USR-4", professionId:"SVC-PEIN-1", name:"Omar Tazi", job:"Peintre", categoryId:"CAT-PEIN", category:"Peinture",
      cityId:"CITY-CASA", city:"Casablanca", area:"Gauthier", rating:3.9, reviewsCount:41, price:90,
      identityStatus:"rejected", verificationStatus:"rejected", professionStatus:"rejected",
      subscriptionPlanId:"PLAN-FREE", subscriptionStatus:"active", verified:false, package:"free",
      status:"rejected", available:false, distance:4, phone:"0633445566", email:"omar.tazi@mail.ma",
      experience:"5 ans", languages:["arabe"], created:"2025-09-05",
      description:"Peintre en bâtiment intérieur et extérieur." },
    { id:"PRO-10298", userId:"USR-5", professionId:"SVC-MAQC-1", name:"Nadia Cherkaoui", job:"Maçon", categoryId:"CAT-MAQC", category:"Maçonnerie",
      cityId:"CITY-FES", city:"Fès", area:"Ville Nouvelle", rating:4.6, reviewsCount:77, price:160,
      identityStatus:"verified", verificationStatus:"approved", professionStatus:"verified",
      subscriptionPlanId:"PLAN-VERIFIED", subscriptionStatus:"active", verified:true, package:"verified",
      status:"active", available:true, distance:6, phone:"0644556677", email:"nadia.cherkaoui@mail.ma",
      experience:"15 ans", languages:["français","arabe"], created:"2025-07-18",
      description:"Maçonnerie générale, dallage et travaux de rénovation." },
    { id:"PRO-10299", userId:"USR-6", professionId:"SVC-COIF-1", name:"Salma Bensalah", job:"Coiffeuse", categoryId:"CAT-COIF", category:"Coiffure",
      cityId:"CITY-AGAD", city:"Agadir", area:"Founty", rating:4.7, reviewsCount:153, price:80,
      identityStatus:"pending", verificationStatus:"pending", professionStatus:"pending",
      subscriptionPlanId:"PLAN-FREE", subscriptionStatus:"active", verified:false, package:"free",
      status:"pending", available:true, distance:2, phone:"0655667788", email:"salma.bensalah@mail.ma",
      experience:"7 ans", languages:["français","arabe"], created:"2025-01-30",
      description:"Coiffure femme, coiffure de mariage et extensions." }
  ];

  var VERIFICATION_REQUESTS = [
    { id:"VR-201", professionalId:"PRO-10295", level:"identity", status:"pending", submitted:"2026-08-22", submittedAt:"2026-08-22T09:14:00", priority:"high", reviewerId:"AU-3",
      documents:["CIN","Justificatif de domicile"], history:[
        { date:"2026-08-22", text:T("Documents soumis") },
        { date:"2026-08-22", text:T("Téléphone vérifié") }
      ] },
    { id:"VR-202", professionalId:"PRO-10299", level:"professionnel", status:"pending", submitted:"2026-08-23", submittedAt:"2026-08-23T14:40:00", priority:"medium", reviewerId:"AU-2",
      documents:["CIN","Attestation","Portfolio"], history:[
        { date:"2026-08-23", text:T("Documents soumis") }
      ] },
    { id:"VR-203", professionalId:"PRO-10296", level:"identity", status:"approved", submitted:"2024-10-01", submittedAt:"2024-10-01T10:00:00", reviewedAt:"2024-10-03T16:20:00", reviewerId:"AU-1", priority:"medium",
      documents:["CIN"], history:[
        { date:"2024-10-01", text:T("Documents soumis") },
        { date:"2024-10-03", text:T("Identité examinée") },
        { date:"2024-10-03", text:T("Approuvée par Admin User") }
      ] },
    { id:"VR-204", professionalId:"PRO-10295", level:"plan", planId:"PLAN-VERIFIED", requestedPlan:"VÉRIFIÉ", price:99, status:"pending", submitted:"2026-08-28", submittedAt:"2026-08-28T09:00:00", priority:"high", paymentId:"PAY-7004",
      documents:["Virement bancaire"], history:[
        { date:"2026-08-28", text:T("Demande d'abonnement VÉRIFIÉ soumise") },
        { date:"2026-08-28", text:T("Virement bancaire reçu, en attente de confirmation") }
      ] },
    { id:"VR-205", professionalId:"PRO-10299", level:"plan", planId:"PLAN-GOLD", requestedPlan:"GOLD", price:199, status:"pending", submitted:"2026-08-29", submittedAt:"2026-08-29T11:30:00", priority:"high", paymentId:"PAY-7005",
      documents:["Virement bancaire"], history:[
        { date:"2026-08-29", text:T("Demande d'abonnement GOLD soumise") },
        { date:"2026-08-29", text:T("Virement bancaire reçu, en attente de confirmation") }
      ] },
    { id:"VR-206", professionalId:"PRO-10299", level:"join", status:"pending", submitted:"2026-08-30", submittedAt:"2026-08-30T08:00:00", priority:"medium",
      documents:["CIN","Justificatif de domicile"], history:[
        { date:"2026-08-30", text:T("Demande d'adhésion Gratuite soumise") },
        { date:"2026-08-30", text:T("Documents fournis, en attente de confirmation") }
      ] }
  ];

  var REVIEWS = [
    { id:"RV-301", professionalId:"PRO-10294", customer:"Omar Berrada", rating:5, comment:"Très professionnel, travail rapide et propre.", status:"published", date:"2026-08-15" },
    { id:"RV-302", professionalId:"PRO-10295", customer:"Leila Mansouri", rating:4, comment:"Bonne intervention, ponctuel.", status:"published", date:"2026-08-16" },
    { id:"RV-303", professionalId:"PRO-10296", customer:"Reda Alaoui", rating:5, comment:"Meubles superbes, je recommande.", status:"published", date:"2026-08-19" },
    { id:"RV-304", professionalId:"PRO-10294", customer:"Yassine M.", rating:5, comment:"Excellent rapport qualité/prix.", status:"pending", date:"2026-08-24" },
    { id:"RV-305", professionalId:"PRO-10297", customer:"Anonyme", rating:1, comment:"Travail bâclé, à éviter.", status:"flagged", date:"2026-08-25", flaggedReason:"Avis jugé non objectif", flaggedReporter:"Nadia Cherkaoui", flaggedDate:"2026-08-26" },
    { id:"RV-306", professionalId:"PRO-10298", customer:"Nabila K.", rating:5, comment:"Très sérieuse, bel ouvrage.", status:"published", date:"2026-08-26" }
  ];

  var REPORTS = [
    { id:"RP-401", professionalId:"PRO-10297", reason:"Fausse publicité", type:"false_professional", priority:"high", description:"Les photos du portfolio ne correspondent pas à la réalité.", reporter:"Omar Tazi", status:"new", date:"2026-08-20", created:"2026-08-20T09:10:00", assignedTo:"" },
    { id:"RP-402", professionalId:"PRO-10295", reason:"Prix trompeur", type:"price_misleading", priority:"medium", description:"Tarif annoncé différent en pratique.", reporter:"Ahmed Benali", status:"new", date:"2026-08-21", created:"2026-08-21T15:40:00", assignedTo:"" },
    { id:"RP-403", professionalId:"PRO-10299", reason:"Fake review", type:"false_review", priority:"high", description:"Revue suspecte, semble fausse.", reporter:"Système", status:"under_review", date:"2026-08-24", created:"2026-08-24T11:05:00", assignedTo:"AU-3" }
  ];

  var SUBSCRIPTION_PLANS = [
    { id:"PLAN-FREE", name:T("GRATUIT"), price:0, period:T("mois"), badge:"gray", active:true, hot:false,
      description:T("Pour démarrer"), limits:{ profile:1, echantillonPhotos:3, echantillonVideos:0, echantillonTotal:3, kind:T("1 photo de profil + 3 échantillons (pas de vidéo)") },
      advantages:[T("Profil de base"),T("Visibilité dans les recherches"),T("Réception de leads"),T("Téléphone / WhatsApp"),T("Avis"),T("Disponibilité"),T("Statistiques de base"),T("1 photo de profil + 3 échantillons (pas de vidéo)")] },
    { id:"PLAN-VERIFIED", name:T("VÉRIFIÉ"), price:99, period:T("mois"), badge:"teal", active:true, hot:false,
      description:T("Confiance & visibilité"), limits:{ profile:1, echantillonPhotos:10, echantillonVideos:3, echantillonTotal:10, kind:T("1 photo de profil + 10 échantillons (photos ou max 3 vidéos)") },
      advantages:[T("Tout ce qui est inclus dans Gratuit"),T("Badge Professionnel Vérifié SI approuvé séparément"),T("Meilleur classement"),T("Visibilité accrue"),T("Portfolio professionnel"),T("Statistiques avancées"),T("Mise en avant du profil"),T("Meilleure exposition aux leads"),T("Support prioritaire"),T("1 photo de profil + 10 échantillons (incl. jusqu'à 3 vidéos)")] },
    { id:"PLAN-GOLD", name:T("GOLD"), price:199, period:T("mois"), badge:"orange", active:true, hot:true,
      description:T("Impact maximal"), limits:{ profile:1, echantillonPhotos:20, echantillonVideos:3, echantillonTotal:20, kind:T("1 photo de profil + 20 échantillons (photos ou max 3 vidéos)") },
      advantages:[T("Tout ce qui est inclus dans Vérifié"),T("Badge GOLD"),T("Placement premium"),T("Profil mis en avant"),T("Boost de visibilité"),T("Analytiques avancées"),T("Leads prioritaires"),T("Assistant IA de profil"),T("Portfolio premium"),T("Support VIP"),T("Éligibilité au statut Top Pro"),T("1 photo de profil + 20 échantillons (incl. jusqu'à 3 vidéos)")] }
  ];

  var SUBSCRIPTIONS = [
    { id:"SUB-501", professionalId:"PRO-10296", planId:"PLAN-GOLD", planName:"GOLD", status:"active", paymentStatus:"confirmed",
      price:199, since:"2026-06-01", renewal:"2026-09-01" },
    { id:"SUB-502", professionalId:"PRO-10294", planId:"PLAN-VERIFIED", planName:"VÉRIFIÉ", status:"active", paymentStatus:"confirmed",
      price:99, since:"2026-05-10", renewal:"2026-08-10" },
    { id:"SUB-503", professionalId:"PRO-10298", planId:"PLAN-VERIFIED", planName:"VÉRIFIÉ", status:"active", paymentStatus:"confirmed",
      price:99, since:"2026-06-15", renewal:"2026-09-15" },
    { id:"SUB-504", professionalId:"PRO-10295", planId:"PLAN-FREE", planName:"GRATUIT", status:"active", paymentStatus:"confirmed",
      price:0, since:"2025-06-01", renewal:"—" },
    { id:"SUB-505", professionalId:"PRO-10299", planId:"PLAN-FREE", planName:"GRATUIT", status:"pending", paymentStatus:"pending",
      price:0, since:"2025-01-30", renewal:"—" }
  ];

  var SUBSCRIPTIONS_HISTORICAL = [
    { id:"SUB-506", professionalId:"PRO-10297", planId:"PLAN-VERIFIED", planName:"VÉRIFIÉ", status:"cancelled", paymentStatus:"confirmed",
      price:99, since:"2025-10-01", renewal:"—", cancelledAt:"2026-01-15" },
    { id:"SUB-507", professionalId:"PRO-10297", planId:"PLAN-GOLD", planName:"GOLD", status:"expired", paymentStatus:"confirmed",
      price:199, since:"2026-01-01", renewal:"2026-04-01", expiredAt:"2026-04-01" }
  ];

  var PAYMENTS = [
    { id:"PAY-7001", reference:"SNA3TI-48291", professionalId:"PRO-10296", planName:"GOLD", amount:199, method:"bank_transfer",
      bankRef:"REF-8821", date:"2026-08-01", status:"confirmed" },
    { id:"PAY-7002", reference:"SNA3TI-48292", professionalId:"PRO-10294", planName:"VÉRIFIÉ", amount:99, method:"bank_transfer",
      bankRef:"REF-5522", date:"2026-07-10", status:"confirmed" },
    { id:"PAY-7003", reference:"SNA3TI-48293", professionalId:"PRO-10298", planName:"VÉRIFIÉ", amount:99, method:"card",
      bankRef:"CARD-7710", date:"2026-06-15", status:"pending" },
    { id:"PAY-7004", reference:"SNA3TI-48294", professionalId:"PRO-10295", planName:"VÉRIFIÉ", amount:99, method:"bank_transfer",
      bankRef:"REF-9911", date:"2026-08-28", status:"pending" },
    { id:"PAY-7005", reference:"SNA3TI-48295", professionalId:"PRO-10299", planName:"GOLD", amount:199, method:"bank_transfer",
      bankRef:"REF-3312", date:"2026-08-29", status:"pending" }
  ];

  var NOTIFICATIONS = [
    { id:"NT-1", type:"verification", text:T("3 demandes de vérification en attente"), when:T("il y a 5 min"), unread:true, route:"verification" },
    { id:"NT-2", type:"payment", text:T("Paiement confirmé SNA3TI-48291"), when:T("il y a 18 min"), unread:true, route:"payments/PAY-7001" },
    { id:"NT-3", type:"report", text:T("Nouveau signalement: PRO-10297"), when:T("il y a 24 min"), unread:true, route:"reports" },
    { id:"NT-4", type:"report", text:T("Avis signalé: RV-305"), when:T("il y a 30 min"), unread:false, route:"reviews" },
    { id:"NT-5", type:"subscription", text:T("Abonnement GOLD renouvelé"), when:T("il y a 1 h"), unread:false, route:"subscriptions" },
    { id:"NT-6", type:"support", text:T("Nouveau ticket de support #SP-6002"), when:T("il y a 2 h"), unread:false, route:"support" },
    { id:"NT-7", type:"system", text:T("Sauvegarde automatique terminée"), when:T("hier"), unread:false, route:"" }
  ];

  var ADMIN_USERS = [
    { id:"AU-1", name:"Admin User", email:"admin@sna3ti.ma", role:"super_admin", status:"active", lastLogin:"2026-08-29 17:42", created:"2024-01-01" },
    { id:"AU-2", name:"Finance Manager", email:"finance@sna3ti.ma", role:"finance", status:"active", lastLogin:"2026-08-29 09:10", created:"2024-03-15" },
    { id:"AU-3", name:"Moderator Team", email:"mod@sna3ti.ma", role:"moderator", status:"active", lastLogin:"2026-08-28 20:05", created:"2024-05-20" },
    { id:"AU-4", name:"Support Agent", email:"support@sna3ti.ma", role:"support", status:"inactive", lastLogin:"2026-08-10 12:00", created:"2024-06-01" }
  ];

  var SUPPORT_TICKETS = [
    { id:"SP-6001", professionalId:"PRO-10295", user:"Sophie Martin", subject:T("Issue de paiement"), message:T("Mon virement est parti mais le badge n'est pas encore activé."), category:"billing", priority:"high", status:"open", created:"2026-08-29 10:15", assignedTo:"AU-4", history:[{ date:"2026-08-29 10:15", text:T("Créé par Sophie Martin") }] },
    { id:"SP-6002", professionalId:"PRO-10296", user:"Karim Alaoui", subject:T("Modification du profil"), message:T("Je souhaite changer ma photo de profil et mon numéro de téléphone."), category:"account", priority:"medium", status:"open", created:"2026-08-29 11:40", assignedTo:"", history:[{ date:"2026-08-29 11:40", text:T("Créé par Karim Alaoui") }] },
    { id:"SP-6003", professionalId:"PRO-10298", user:"Amine Bennani", subject:T("Signalement d'un avis"), message:T("Un avis négatif non justifié a été publié sur mon profil."), category:"moderation", priority:"critical", status:"pending", created:"2026-08-30 09:05", assignedTo:"AU-3", history:[{ date:"2026-08-30 09:05", text:T("Créé par Amine Bennani") }, { date:"2026-08-30 09:30", text:T("Assigné à Moderator Team") }] },
    { id:"SP-6004", professionalId:"PRO-10294", user:"Yassine El Amrani", subject:T("Questions sur le pack GOLD"), message:T("Comment passer au pack GOLD et combien ça coûte ?"), category:"billing", priority:"low", status:"resolved", created:"2026-08-27 14:22", assignedTo:"AU-4", history:[{ date:"2026-08-27 14:22", text:T("Créé par Yassine El Amrani") }, { date:"2026-08-27 15:00", text:T("Clôturé") }] }
  ];

  var AUDIT_LOGS = [
    { id:"AL-1", timestamp:"2026-08-30 17:42", admin:"Admin User", action:"LOGIN", entity:"Admin", entityId:"AU-1", result:"Success" },
    { id:"AL-2", timestamp:"2026-08-30 17:20", admin:"Admin User", action:"VERIFY_PROFESSIONAL", entity:"Professional", entityId:"PRO-10296", result:"Approved" },
    { id:"AL-3", timestamp:"2026-08-30 16:55", admin:"Finance Manager", action:"CONFIRM_PAYMENT", entity:"Payment", entityId:"PAY-7001", result:"Confirmed" },
    { id:"AL-4", timestamp:"2026-08-30 15:30", admin:"Moderator Team", action:"REVIEW_HIDE", entity:"Review", entityId:"RV-305", result:"Hidden" },
    { id:"AL-5", timestamp:"2026-08-30 14:10", admin:"Admin User", action:"SUSPEND_USER", entity:"User", entityId:"USR-7", result:"Suspended" }
  ];

  // Activity feed for dashboard
  var ACTIVITY = [
    { id:"AC-1", icon:"pro", text:T("Yassine El Amrani s'est inscrit comme professionnel"), when:T("il y a 5 min"), type:"teal" },
    { id:"AC-2", icon:"verif", text:T("Vérification approuvée pour Karim Alaoui"), when:T("il y a 12 min"), type:"green" },
    { id:"AC-3", icon:"payment", text:T("Paiement confirmé SNA3TI-48291"), when:T("il y a 18 min"), type:"orange" },
    { id:"AC-4", icon:"report", text:T("Avis signalé pour Omar Tazi"), when:T("il y a 24 min"), type:"red" },
    { id:"AC-5", icon:"sub", text:T("Abonnement VÉRIFIÉ renouvelé"), when:T("il y a 31 min"), type:"teal" }
  ];

  var USER_ACTIVITY = [
    { userId:"USR-1", icon:"view", text:T("A consulté son profil 12 fois"), when:T("aujourd'hui"), type:"teal" },
    { userId:"USR-2", icon:"search", text:T("5 recherches effectuées cette semaine"), when:T("il y a 2 h"), type:"teal" },
    { userId:"USR-3", icon:"contact", text:T("2 demandes de contact envoyées"), when:T("hier"), type:"orange" },
    { userId:"USR-4", icon:"report", text:T("A signalé un professionnel"), when:T("il y a 3 jours"), type:"red" }
  ];

  var ANALYTICS = {
    visits: [240,320,410,380,520,610,720,690,810,940,1010,1120],
    signups: [12,18,15,22,28,31,35,30,42,48,55,61],
    monthlyContacts: [218,246,271,299,326,358,391,422,468,512,568,640],
    leads: { phone:842, whatsapp:1240, contact:437 },
    topServices: ["Plomberie","Électricité","Menuiserie","Coiffure","Peinture"],
    topCities: ["Casablanca","Rabat","Marrakech","Fès","Agadir"],
    failedSearches: [14,22,19,31,27,33,41,35,48,52,60,66],
    conversion: [2.8,3.0,2.9,3.2,3.1,3.4,3.3,3.6,3.5,3.8,3.9,4.0],
    churn: [6.1,5.8,5.9,5.4,5.2,4.9,4.6,4.4,4.1,3.9,3.8,3.6],
    mrr: [4200,4650,5120,5380,5900,6400,7050,7420,8060,8620,9140,9740],
    goldPercent: 26,
    verifiedPercent: 54,
    freeToPaid: 12.4,
    avgRating: 4.6
  };

  // ============================================================
  // Service facade — future API integration points
  // Each *Async returns a Promise to mimic a backend.
  // ============================================================

  // Normalize categories to the 3-level structure:
  //   Category → Subcategory → Service
  // Each Service carries fr/ar/en name, icon, description, status, order.
  // Legacy categories that only had a flat `services` array are upgraded
  // into a default subcategory so nothing is lost.
  function normalizeService(s, i){
    return {
      id: s.id, code: s.code || "", icon: s.icon || "🔧",
      order: s.order || (i + 1), status: s.status || "active",
      description: s.description || "",
      label: s.label || { fr: s.name || "", ar: s.ar || "", en: s.en || "" }
    };
  }
  function normalizeSubcategory(sc, si){
    return {
      id: sc.id, code: sc.code || "", icon: sc.icon || "📁",
      order: sc.order || (si + 1), active: sc.active !== false,
      description: sc.description || "",
      label: sc.label || { fr: sc.fr || "", ar: "", en: "" },
      services: (sc.services || []).map(function(s, i){ return normalizeService(s, i); })
    };
  }
  function normalizeCategories(list){
    return list.map(function(c){
      var subs = (c.subcategories || []).map(function(sc, i){ return normalizeSubcategory(sc, i); });
      if(!subs.length && c.services && c.services.length){
        subs = [{
          id: c.id + "-G", code: (c.code || "") + "-general", icon: c.icon || "📁",
          order: 1, active: c.active !== false, description: "",
          label: { fr: c.label.fr + " — général", ar: c.label.ar || "", en: c.label.en || "" },
          services: c.services.map(function(s, i){ return normalizeService(s, i); })
        }];
      }
      return {
        id: c.id, code: c.code || "", icon: c.icon || "📁", order: c.order || 1,
        active: c.active !== false, description: c.description || "",
        label: c.label || { fr: "", ar: "", en: "" },
        subcategories: subs
      };
    });
  }

  // Legal documents (Terms of Service / Privacy Policy / About Us).
  // Content lives as structured, per-language documents so it can be served by
  // a backend later; for now it is published through shared localStorage and
  // read by the public site as progressive enhancement over a static fallback.
  var LEGAL_DEFAULTS = [
    { id:"terms", published:true, label:{ fr:"Conditions d'utilisation", en:"Terms of Service", ar:"شروط الاستخدام" },
      content:{
        fr:{ title:"Conditions d'utilisation",
          intro:"Les présentes Conditions d'utilisation encadrent l'accès et l'usage de la plateforme Sna3ti.ma, mise en relation entre particuliers et professionnels locaux.",
          sections:[
            { heading:"1. Objet de la plateforme", body:"Sna3ti.ma est une plateforme de mise en relation permettant aux demandeurs de trouver et de contacter des professionnels (maçons, plombiers, électriciens, etc.) selon leur ville, leur métier et leurs disponibilités." },
            { heading:"2. Comptes et responsabilité", body:"Le professionnel est seul responsable des informations publiées sur son profil (coordonnées, tarifs, échantillons de travaux). L'utilisateur s'engage à fournir des informations exactes lors de sa demande de mise en relation." },
            { heading:"3. Vérification et confiance", body:"La plateforme propose une démarche de vérification d'identité et de qualification. Elle ne garantit toutefois ni la qualité des prestations fournies ni la bonne exécution des travaux commandés en dehors de la plateforme." },
            { heading:"4. Tarifs et paiement", body:"Le paiement d'un abonnement (GRATUIT, VÉRIFIÉ, GOLD) confère des avantages de visibilité et de vérification. Il n'implique ni une relation d'emploi ni une garantie de résultats." },
            { heading:"5. Protection des données", body:"Les données personnelles sont traitées conformément à la Politique de confidentialité. La plateforme s'engage à ne pas revendre les coordonnées des utilisateurs à des tiers." }
          ] },
        en:{ title:"Terms of Service",
          intro:"These Terms of Service govern access to and use of the Sna3ti.ma platform, which connects consumers with local professionals.",
          sections:[
            { heading:"1. Purpose of the platform", body:"Sna3ti.ma is a matching platform that lets consumers find and contact professionals (masons, plumbers, electricians, etc.) by city, trade and availability." },
            { heading:"2. Accounts and responsibility", body:"Professionals are solely responsible for the information published on their profile (contact details, rates, work samples). Users agree to provide accurate information when requesting a match." },
            { heading:"3. Verification and trust", body:"The platform offers an identity and qualification verification process. It does not guarantee the quality of services delivered nor the proper execution of work ordered outside the platform." },
            { heading:"4. Pricing and payment", body:"Paying for a plan (FREE, VERIFIED, GOLD) grants visibility and verification benefits. It implies no employment relationship and no guarantee of results." },
            { heading:"5. Data protection", body:"Personal data is processed in accordance with the Privacy Policy. The platform does not sell users' contact details to third parties." }
          ] },
        ar:{ title:"شروط الاستخدام",
          intro:"تنظم هذه الشروط الوصول إلى منصة سنعتيم واستخدامها، وهي منصة للربط بين الزبناء والمهنيين المحليين.",
          sections:[
            { heading:"1. هدف المنصة", body:"سنعتيم.ma هي منصة للربط تتيح للزبناء إيجاد مهنيين (بنّائين، سبّاكين، كهربائيين...) والتواصل معهم حسب المدينة والمهنة والتوفر." },
            { heading:"2. الحسابات والمسؤولية", body:"المهني مسؤول وحده عن المعلومات المنشورة في ملفه (بيانات الاتصال والأثمنة ونماذج الأعمال)." },
            { heading:"3. التحقق والثقة", body:"توفر المنصة مسطرة للتحقق من الهوية والمؤهلات دون أن تضمن جودة الخدمات المقدمة." },
            { heading:"4. الأثمنة والدفع", body:"الاشتراك (مجاني، موثّق، ذهبي) يمنح مزايا للظهور والتحقق دون أن يعني علاقة عمل أو ضمان نتائج." }
          ] }
      } },
    { id:"privacy", published:true, label:{ fr:"Politique de confidentialité", en:"Privacy Policy", ar:"سياسة الخصوصية" },
      content:{
        fr:{ title:"Politique de confidentialité",
          intro:"Sna3ti.ma accorde une importance particulière à la protection des données personnelles de ses utilisateurs et professionnels.",
          sections:[
            { heading:"1. Données collectées", body:"Nous collectons les informations fournies lors de la création d'un profil ou d'une demande : nom, téléphone, email, ville et détails des demandes de mise en relation." },
            { heading:"2. Utilisation des données", body:"Les données servent à assurer la mise en relation, à afficher les profils, à prévenir les abus et à améliorer le service. Les contacts ne sont jamais partagés avec des tiers à des fins commerciales." },
            { heading:"3. Conservation et sécurité", body:"Les données sont conservées le temps nécessaire aux finalités décrites. La plateforme met en œuvre des mesures techniques pour limiter les accès non autorisés." },
            { heading:"4. Vos droits", body:"Conformément à la réglementation applicable, vous pouvez demander l'accès, la rectification ou la suppression de vos données en contactant support@sna3ti.ma." }
          ] },
        en:{ title:"Privacy Policy",
          intro:"Sna3ti.ma takes the protection of its users' and professionals' personal data very seriously.",
          sections:[
            { heading:"1. Data collected", body:"We collect the information provided when creating a profile or a request: name, phone, email, city and the details of matching requests." },
            { heading:"2. Use of data", body:"Data is used to enable matching, display profiles, prevent abuse and improve the service. Contacts are never shared with third parties for commercial purposes." },
            { heading:"3. Retention and security", body:"Data is kept as long as necessary for the purposes described. The platform applies technical measures to limit unauthorised access." },
            { heading:"4. Your rights", body:"Under applicable regulations, you may request access to, rectification of, or deletion of your data by contacting support@sna3ti.ma." }
          ] },
        ar:{ title:"سياسة الخصوصية",
          intro:"تولي سنعتيم.ma أهمية خاصة لحماية المعطيات الشخصية لمستخدميها ومهنييها.",
          sections:[
            { heading:"1. المعطيات المجمعة", body:"نجمع المعلومات المصرح بها عند إنشاء ملف أو طلب : الاسم والهاتف والبريد الإلكتروني والمدينة وتفاصيل طلبات الربط." },
            { heading:"2. استعمال المعطيات", body:"تستعمل المعطيات لضمان الربط وعرض الملفات ومنع الانتهاكات وتحسين الخدمة، دون مشاركتها مع أطراف ثالثة لأغراض تجارية." },
            { heading:"3. الاحتفاظ والأمن", body:"تحتفظ المنصة بالمعطيات للمدة اللازمة وتتخذ تدابير تقنية للحد من الوصول غير المصرح به." },
            { heading:"4. حقوقك", body:"بمقتضى القوانين الجاري بها العمل، يمكنك طلب الاطلاع على معطياتك أو تصحيحها أو حذفها عبر مراسلة support@sna3ti.ma." }
          ] }
      } },
    { id:"about", published:true, label:{ fr:"À propos", en:"About Us", ar:"من نحن" },
      content:{
        fr:{ title:"À propos de Sna3ti.ma",
          intro:"Sna3ti.ma connecte les particuliers aux artisans et professionnels de confiance au Maroc.",
          sections:[
            { heading:"Notre mission", body:"Faciliter la recherche d'un professionnel fiable près de chez vous : maçons, plombiers, électriciens, peintres et bien d'autres métiers, partout au Maroc." },
            { heading:"Confiance d'abord", body:"Chaque professionnel est invité à faire vérifier son identité et ses diplômes. Les avis des clients, publiés et modérés, aident chacun à choisir en toute confiance." },
            { heading:"Contact", body:"Une question ? Écrivez-nous à support@sna3ti.ma ou téléphonez au 06 00 00 00 00." }
          ] },
        en:{ title:"About Sna3ti.ma",
          intro:"Sna3ti.ma connects consumers with trusted craftsmen and professionals in Morocco.",
          sections:[
            { heading:"Our mission", body:"Make it easy to find a reliable professional near you: masons, plumbers, electricians, painters and many other trades across Morocco." },
            { heading:"Trust first", body:"Every professional is invited to have their identity and qualifications verified. Published and moderated client reviews help everyone choose with confidence." },
            { heading:"Contact", body:"A question? Write to us at support@sna3ti.ma or call 06 00 00 00 00." }
          ] },
        ar:{ title:"عن سنعتيم",
          intro:"سنعتيم.ma تربط الزبناء بالحرفيين والمهنيين الموثوقين في المغرب.",
          sections:[
            { heading:"مهمتنا", body:"تسهيل إيجاد مهني موثوق قريب منك : بنّاؤون وسبّاكون وكهربائيون ورسامون وغيرهم من المهن في جميع أنحاء المغرب." },
            { heading:"الثقة أولاً", body:"يُدعى كل مهني إلى التحقق من هويته ومؤهلاته، كما تساعد تقييمات الزبناء المعروضة والمراقَبة الجميع على الاختيار بثقة." },
            { heading:"اتصل بنا", body:"لديك سؤال؟ راسلنا على support@sna3ti.ma أو اتصل على الرقم 06 00 00 00 00." }
          ] }
      } }
  ];

  var store = {
    users: USERS, professionals: PROFESSIONALS, categories: normalizeCategories(CATEGORIES),
    regions: REGIONS, reviews: REVIEWS, reports: REPORTS,
    subscriptionPlans: SUBSCRIPTION_PLANS, subscriptions: SUBSCRIPTIONS.concat(SUBSCRIPTIONS_HISTORICAL),
    payments: PAYMENTS, notifications: NOTIFICATIONS, adminUsers: ADMIN_USERS,
    supportTickets: SUPPORT_TICKETS,
    auditLogs: AUDIT_LOGS, verificationRequests: VERIFICATION_REQUESTS,
    activity: ACTIVITY, analytics: ANALYTICS, config: CONFIG,
    legal: LEGAL_DEFAULTS, userActivity: USER_ACTIVITY
  };

  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function uid(prefix){ return prefix + "-" + Math.floor(100000 + Math.random()*900000); }
  function todayStr(){ return new Date().toISOString().slice(0,10); }

  // Monotonic professional ID counter: a persisted plain number that is never derived
  // from (or parsed from) an entity ID string, so all PRO- ids remain opaque strings.
  var PRO_COUNTER_KEY = "sna3ti_admin_pro_counter";
  function nextProfessionalId(){
    var cur = 10000;
    try { var raw = localStorage.getItem(PRO_COUNTER_KEY); if(raw && /^\d+$/.test(raw)){ cur = Number(raw); } } catch(e){}
    cur += 1;
    try { localStorage.setItem(PRO_COUNTER_KEY, String(cur)); } catch(e){}
    return "PRO-" + cur;
  }

  // Persist collections to localStorage (best-effort) for demo continuity.
  var MUTABLE_KEYS = ["professionals","users","subscriptions","payments","verificationRequests","reviews","reports","categories","regions","notifications","adminUsers","config","userActivity","analytics","supportTickets","auditLogs","legal"];
  function persist(){
    try { MUTABLE_KEYS.forEach(function(k){ localStorage.setItem("sna3ti_admin_"+k, JSON.stringify(store[k])); }); } catch(e){}
  }
  function hydrate(){
    try {
      MUTABLE_KEYS.forEach(function(k){
        var raw = localStorage.getItem("sna3ti_admin_"+k);
        if(raw){ var arr = JSON.parse(raw); store[k] = arr; }
      });
      CONFIG = store.config; // keep CONFIG reference in sync after hydrate
    } catch(e){}
  }
  hydrate();

  function where(list, fn){ return list.filter(fn); }
  function getById(list, id){ return list.find(function(x){ return x.id === id; }) || null; }
  function reviewerName(idOrName){
    if(!idOrName) return "";
    var a = getById(store.adminUsers, idOrName);
    if(a) return a.name;
    var b = store.adminUsers.find(function(x){ return (x.email||"").toLowerCase()===String(idOrName).toLowerCase(); });
    if(b) return b.name;
    return String(idOrName);
  }

  // Map a payment's plan name to a concrete paid plan (VÉRIFIÉ or GOLD). Returns null for free/unknown.
  function paidPlanByPayment(p){
    var name = String((p && p.planName)||"").toLowerCase();
    if(name.indexOf("gold")>-1) return "PLAN-GOLD";
    if(name.indexOf("vérifié")>-1 || name.indexOf("verifie")>-1 || name.indexOf("verified")>-1) return "PLAN-VERIFIED";
    return null;
  }

  // Apply a paid plan badge to a professional profile (drives the VÉRIFIÉ / GOLD icon).
  function applyPlanToProfessional(proId, planId){
    var p = getById(store.professionals, proId); if(!p) return false;
    var plan = getById(store.subscriptionPlans, planId) || null;
    p.subscriptionPlanId = planId;
    p.package = String(planId).replace("PLAN-","").toLowerCase();
    p.subscriptionStatus = "active";
    if(plan){ p.subscriptionPlanName = plan.name; }
    var s = store.subscriptions.find(function(x){ return x.professionalId === proId; });
    if(s){
      if(plan){ s.planId = plan.id; s.planName = plan.name; s.price = plan.price; }
      s.paymentStatus = "confirmed"; s.status = "active"; s.since = todayStr(); s.renewal = "—";
    } else if(plan){
      store.subscriptions.push({ id: uid("SUB"), professionalId: proId, planId: plan.id, planName: plan.name, status:"active", paymentStatus:"confirmed", price: plan.price, since: todayStr(), renewal:"—" });
    }
    return true;
  }

  // REQ 52: normalize a backend professional record into the UI shape.
  // Backend is authoritative: never invent ratings / verification / plans.
  // Opaque IDs (e.g. "PRO-10295") pass through verbatim — never coerce.
  function mapAdminProfessional(remote) {
    if (!remote) return null;
    var out = {
      id: remote.id,
      userId: remote.userId || null,
      name: remote.name || "",
      professionId: remote.professionId || "",
      job: remote.job || "",
      categoryId: remote.categoryId || null,
      cityId: remote.cityId || null,
      city: remote.city || "",
      area: remote.area || "",
      neighborhood: remote.neighborhood || "",
      phone: remote.phone || "",
      email: remote.email || "",
      description: remote.description || "",
      experience: remote.experience || "",
      status: remote.status || "pending",
      available: remote.available !== false,
      created: remote.createdAt || remote.created || "",
      // Fields the backend does not currently aggregate. Represent honestly
      // (0 / empty) rather than fabricating a realistic-looking value.
      rating: (typeof remote.rating === "number") ? remote.rating : 0,
      reviewsCount: (typeof remote.reviewsCount === "number") ? remote.reviewsCount : 0,
      verificationStatus: remote.verificationStatus || null,
      package: remote.package || ""
    };
    if (remote.verification) out.verificationStatus = remote.verification;
    if (remote.languages && Array.isArray(remote.languages)) out.languages = remote.languages;
    if (remote.services && Array.isArray(remote.services)) out.services = remote.services;
    if (remote.media && Array.isArray(remote.media)) out.portfolio = remote.media;
    return out;
  }

  // REQ 52: normalize a backend payment record into the UI shape.
  // Manual bank transfer only — no card / IBAN / CVV / online-banking
  // credentials are ever collected or stored by Sna3ti. Only tracking &
  // proof references (reference, bankRef, receipt) are surfaced. Opaque IDs
  // pass through verbatim — never coerced. Missing values are honest.
  function mapAdminPayment(remote) {
    if (!remote) return null;
    return {
      id: remote.id,
      reference: remote.reference || "",
      professionalId: remote.professionalId,
      planName: remote.planName || "",
      amount: remote.amount,
      currency: remote.currency || "MAD",
      method: remote.method || "bank_transfer",
      status: remote.status || "pending",
      bankRef: remote.bankRef || "",
      receipt: remote.receipt || "",
      rejectionReason: remote.rejectionReason || "",
      infoRequested: remote.infoRequested || "",
      reviewedBy: remote.reviewedById || remote.reviewedBy || "",
      date: remote.createdAt || remote.date || "",
      reviewedAt: remote.reviewedAt || ""
    };
  }

  var Sna3tiData = {
    permissionsCatalog: PERMISSION_CATALOG,
    roles: ROLES,

    // ---- Professionals ----
    nextProfessionalId: nextProfessionalId,
    getProfessionals: function(params){
      var list = clone(where(store.professionals, function(){ return true; }));
      if(params){
        if(params.q){ var q=params.q.toLowerCase(); list = list.filter(function(p){ return (p.name+" "+p.job+" "+p.city+" "+p.category).toLowerCase().indexOf(q)>-1; }); }
        if(params.city) list = list.filter(function(p){ return p.city === params.city; });
        if(params.category) list = list.filter(function(p){ return p.category === params.category; });
        if(params.job) list = list.filter(function(p){ return (p.job||"").toLowerCase() === params.job.toLowerCase(); });
        if(params.package) list = list.filter(function(p){ return p.package === params.package; });
        if(params.subscription){
          var m = { free:"PLAN-FREE", verified:"PLAN-VER", gold:"PLAN-GOLD" };
          var sub = params.subscription;
          list = list.filter(function(p){ return (p.package||"free")===sub || (p.subscriptionPlanId||"").indexOf(m[sub]||sub)>-1; });
        }
        if(params.minRating) list = list.filter(function(p){ return (p.rating||0) >= params.minRating; });
        if(params.created){
          var D28 = 28, D8 = 8;
          if(params.created === "7d") D28 = 7;
          if(params.created === "30d") D28 = 30;
          if(params.created === "older") D28 = 0;
          list = list.filter(function(p){
            var c = new Date(p.created||"2000-01-01");
            if(params.created === "older") return c < new Date(Date.now()-30*864e5);
            return Date.now() - c.getTime() <= D28*864e5;
          });
        }
        if(params.verification){ if(params.verification==="verified") list = list.filter(function(p){ return p.verificationStatus==="approved"; }); else if(params.verification==="unverified") list = list.filter(function(p){ return p.verificationStatus!=="approved"; }); }
        if(params.status) list = list.filter(function(p){ return p.status === params.status; });
      }
      return list;
    },
    getProfessional: function(id){ return clone(getById(store.professionals, id)); },
    countProfessionals: function(){ return store.professionals.length; },

    // ---- REQ 52: async admin reads. Source of truth = GET /admin/professionals.
    // These call the real backend through the central API client. A successful
    // empty response ([]) resolves as an EMPTY state (not an error); a network /
    // server / 429 / 500 failure rejects so the UI renders an error/offline
    // state — never demo data. Opaque IDs pass through unchanged.
    fetchProfessionals: function(params){
      if(!ProfApi || !ProfApi.adminList) return Promise.reject({ success:false, code:"UNSUPPORTED", message:"Module API professionnels non chargé." });
      return ProfApi.adminList(params || {}).then(function(res){
        var list = (res && res.data) ? res.data : [];
        return { success:true, data: list.map(mapAdminProfessional), pagination: (res && res.pagination) || null };
      });
    },
    fetchProfessional: function(id){
      if(!ProfApi || !ProfApi.adminGet) return Promise.reject({ success:false, code:"UNSUPPORTED", message:"Module API professionnels non chargé." });
      return ProfApi.adminGet(id).then(function(res){
        var p = (res && res.data) ? res.data : null;
        return { success:true, data: p ? mapAdminProfessional(p) : null };
      });
    },

    // ---- REQ 52: async admin payments read. Source of truth = GET /admin/payments.
    // Manual bank transfer model: only tracking/proof references are returned,
    // never banking credentials. A successful empty response ([]) resolves as
    // an EMPTY state; a network / server / 429 / 500 failure rejects so the UI
    // renders an error/offline state — never demo payments. Opaque IDs verbatim.
    fetchPayments: function(){
      if(!PayApi || !PayApi.list) return Promise.reject({ success:false, code:"UNSUPPORTED", message:"Module API paiements non chargé." });
      return PayApi.list().then(function(res){
        var list = (res && res.data) ? res.data : [];
        return { success:true, data: list.map(mapAdminPayment), pagination: (res && res.pagination) || null };
      });
    },

    updateProfessional: function(id, data){
      var p = getById(store.professionals, id); if(!p) return false;
      Object.keys(data).forEach(function(k){ if(data[k]!==undefined) p[k]=data[k]; });
      return true;
    },
    deleteProfessional: function(id){
      var p = getById(store.professionals, id); if(!p) return false;
      store.professionals = store.professionals.filter(function(x){ return x.id!==id; });
      store.verificationRequests = store.verificationRequests.filter(function(x){ return x.professionalId!==id; });
      store.subscriptions = store.subscriptions.filter(function(x){ return x.professionalId!==id; });
      store.payments = store.payments.filter(function(x){ return x.professionalId!==id; });
      store.reviews = store.reviews.filter(function(x){ return x.professionalId!==id; });
      store.reports = store.reports.filter(function(x){ return x.professionalId!==id; });
      persist();
      return true;
    },
    // ---- AI lead capture ----
    logLead: function(proId, via){
      var p = getById(store.professionals, proId); if(!p) return false;
      p.leads = p.leads || { profileViews:0, phoneClicks:0, whatsappClicks:0, contactRequests:0, conversion:0 };
      p.leads.contactRequests = (p.leads.contactRequests||0) + 1;
      persist();
      return p.leads.contactRequests;
    },
    getProfessionalsAsync: function(params){
      return new Promise(function(resolve){ setTimeout(function(){ resolve(Sna3tiData.getProfessionals(params)); }, 300); });
    },

    // ---- AI search: match professionals from a parsed user intent ----
    // intent: { svc (resolved category or job token), city, cityId, avail }
    searchByIntent: function(intent){
      intent = intent || {};
      var svc = String(intent.svc||"").toLowerCase().trim();
      var city = String(intent.city||"");
      var cityId = intent.cityId || "";
      var avail = String(intent.avail||"").toLowerCase();
      var cityMatched = !!(city && city!=="Position utilisateur" && String(city).toLowerCase()!=="position utilisateur");
      var results = [];
      store.professionals.forEach(function(p){
        if(p.status!=="active" && p.status!=="pending") return;
        var score = 0;
        var matchedService = false;
        var category = String(p.category||"").toLowerCase();
        var job = String(p.job||"").toLowerCase();
        var hay = category + " " + job;
        if(svc){
          if(svc.length>=3 && (hay.indexOf(svc)>-1)){ score += 55; matchedService = true; }
          else if(svc.length<3 && category.indexOf(svc)>-1){ score += 55; matchedService = true; }
          // For an intent search, only surface professionals whose service matches the query.
          if(!matchedService){ return; }
        }
        // city
        var pCity = String(p.city||"").toLowerCase();
        var pCityId = p.cityId || "";
        if(cityMatched){
          if((cityId && pCityId===cityId) || (pCity && pCity===city.toLowerCase())){ score += 30; }
          else { return; } // city filter: exclude other cities
        } else {
          score += 15;
        }
        // availability
        var wantsToday = avail.indexOf("aujourd")>-1 || avail.indexOf("اليوم")>-1;
        var wantsTomorrow = avail.indexOf("demain")>-1 || avail.indexOf("غدا")>-1;
        if(!wantsToday && !wantsTomorrow){ score += 8; }
        else if(wantsToday && p.available){ score += 10; }
        else if(wantsToday && !p.available){ return; }
        // quality
        if(p.rating >= 4.7) score += 6; else if(p.rating >= 4.2) score += 4; else if(p.rating >= 3.8) score += 2;
        if(String(p.package||"")==="gold") score += 7;
        else if(String(p.package||"")==="verified") score += 4;
        if(p.verificationStatus==="approved") score += 4;
        results.push({
          professionalId: p.id,
          score: score,
          serviceMatched: matchedService,
          name: p.name, job: p.job, category: p.category, city: p.city, area: p.area,
          rating: p.rating, reviewsCount: p.reviewsCount, price: p.price,
          package: p.package, verified: p.verificationStatus==="approved", available: p.available,
          phone: p.phone, idCode: p.id,
          leads: p.leads ? clone(p.leads) : null
        });
      });
      results.sort(function(a,b){ return (b.score-a.score) || (b.rating-a.rating); });
      return results.slice(0, 8);
    },

    // ---- Users ----
    getUsers: function(params){
      var list = clone(store.users);
      if(params && params.q){ var q=params.q.toLowerCase(); list = list.filter(function(u){ return (u.name+" "+u.email).toLowerCase().indexOf(q)>-1; }); }
      if(params && params.status) list = list.filter(function(u){ return u.status===params.status; });
      return list;
    },
    getUser: function(id){ return clone(getById(store.users, id)); },
    updateUser: function(id, data){ var u=getById(store.users,id); if(!u) return false; Object.keys(data).forEach(function(k){ if(data[k]!==undefined)u[k]=data[k]; }); return true; },

    // ---- Verification ----
    getVerificationRequests: function(params){
      var list = clone(store.verificationRequests);
      if(params && params.status) list = list.filter(function(v){ return v.status === params.status; });
      if(params && params.level) list = list.filter(function(v){ return v.level === params.level; });
      return list;
    },
    approveVerification: function(id, adminName){
      var v = getById(store.verificationRequests, id); if(!v || v.status==="approved") return false;
      v.status="approved";
      v.history.push({ date: todayStr(), text:T("Approuvée par "+adminName) });
      if(v.level==="plan"){
        // Plan (VÉRIFIÉ/GOLD) request: approval ACTIVATES the requested
        // subscription. The "Professionnel Vérifié" badge is a separate
        // identity/professionnal check and is NEVER granted by subscription
        // approval or payment confirmation (see level !== "plan" below).
        var p = getById(store.professionals, v.professionalId);
        if(p){ p.planEligible = true; }
        if(v.planId && getById(store.subscriptionPlans, v.planId)){ applyPlanToProfessional(v.professionalId, v.planId); }
        v.history.push({ date: todayStr(), text:T("Plan activé")+" — "+(v.requestedPlan||v.planId||"") });
        return true;
      }
      var p = getById(store.professionals, v.professionalId);
      if(p){ p.verificationStatus="approved"; p.verified=true; if(v.level==="professionnel"){ p.professionStatus="verified"; } else { p.identityStatus="verified"; } }
      return true;
    },
    rejectVerification: function(id, reason, adminName){
      var v = getById(store.verificationRequests, id); if(!v) return false;
      v.status="rejected"; v.reason=reason||"";
      v.history.push({ date: todayStr(), text:T("Rejetée par "+adminName+(reason?" — "+reason:"")) });
      var p = getById(store.professionals, v.professionalId);
      if(p && v.level==="plan"){ p.planEligible = false; return true; }
      if(p && v.level==="join"){ p.professionStatus="rejected"; p.status="rejected"; return true; }
      if(p && v.level==="professionnel"){ p.professionStatus="rejected"; } else { p.identityStatus="rejected"; }
      return true;
    },
    requestMoreInfo: function(id, note, adminName){
      var v = getById(store.verificationRequests, id); if(!v) return false;
      v.status="needs_info"; v.infoRequested = note||"";
      v.history.push({ date: todayStr(), text:T("Informations demandées par "+adminName+(note?" — "+note:"")) });
      return true;
    },

    // ---- Gratuit (join) admission + media upload quotas ----
    // Joining the platform on the GRATUIT pack generates a "join" request the admin confirms.
    approveJoin: function(id, adminName){
      var v = getById(store.verificationRequests, id); if(!v || v.level!=="join") return false;
      v.status="approved"; v.reviewedAt=new Date().toISOString();
      v.history.push({ date: todayStr(), text:T("Adhésion confirmée par "+adminName) });
      var p = getById(store.professionals, v.professionalId);
      if(p && p.status!=="active"){ p.status="active"; p.professionStatus="pending"; }
      // Activate the (free) subscription so the profile is live on the platform.
      var s = store.subscriptions.find(function(x){ return x.professionalId===v.professionalId; });
      if(s){ s.status="active"; s.paymentStatus="confirmed"; }
      else { store.subscriptions.push({ id: uid("SUB"), professionalId:v.professionalId, planId:"PLAN-FREE", planName:"GRATUIT", status:"active", paymentStatus:"confirmed", price:0, since: todayStr(), renewal:"—" }); }
      return true;
    },
    rejectJoin: function(id, reason, adminName){
      var v = getById(store.verificationRequests, id); if(!v || v.level!=="join") return false;
      v.status="rejected"; v.reason=reason||"";
      v.history.push({ date: todayStr(), text:T("Adhésion rejetée par "+adminName+(reason?" — "+reason:"")) });
      return true;
    },
    // Media upload quotas by package.
    // Profile photo = 1 for every package. Échantillon budgets:
    //   Gratuit = 3 photos (no video); VÉRIFIÉ = 10 total (incl. max 3 video); GOLD = 20 total (incl. max 3 video).
    packageLimits: function(pkg){
      var key = String(pkg||"free").toLowerCase();
      if(key==="gold") return { profile:1, echantillonPhotos:20, echantillonVideos:3, echantillonTotal:20, kind:T("1 photo de profil + 20 échantillons (photos ou max 3 vidéos)") };
      if(key==="verified") return { profile:1, echantillonPhotos:10, echantillonVideos:3, echantillonTotal:10, kind:T("1 photo de profil + 10 échantillons (photos ou max 3 vidéos)") };
      return { profile:1, echantillonPhotos:3, echantillonVideos:0, echantillonTotal:3, kind:T("1 photo de profil + 3 échantillons (pas de vidéo)") };
    },
    getMediaUsage: function(proId){
      var p = getById(store.professionals, proId);
      var media = (p && p.media) || [];
      return {
        profileCount: media.filter(function(m){ return m.kind==="profile"; }).length,
        echantillonPhotos: media.filter(function(m){ return m.kind==="echantillon" && m.type==="photo"; }).length,
        echantillonVideos: media.filter(function(m){ return m.kind==="echantillon" && m.type==="video"; }).length,
        echantillonTotal: media.filter(function(m){ return m.kind==="echantillon"; }).length
      };
    },
    // Can this professional upload media? opts: { kind:"profile"|"echantillon", type:"photo"|"video" }.
    canUploadMedia: function(proId, opts){
      var p = getById(store.professionals, proId);
      var pkg = (p && String(p.package||"free").toLowerCase()) || "free";
      var lim = Sna3tiData.packageLimits(pkg);
      var use = Sna3tiData.getMediaUsage(proId);
      var upg = T("Pour débloquer plus de médias, faites évoluer votre pack : GOLD = 1 photo de profil + 20 échantillons, VÉRIFIÉ = 1 photo de profil + 10 échantillons.");
      var kind = (opts&&opts.kind) || "echantillon";
      var type = (opts&&opts.type) || "photo";
      if(kind==="profile"){
        if(use.profileCount >= lim.profile){ return { ok:false, reason:T("Une seule photo de profil est autorisée pour tous les packs."), upgrade:false, msg:"" }; }
        return { ok:true };
      }
      // échantillon
      if(type==="video"){
        if(lim.echantillonVideos<=0){ return { ok:false, reason:T("Le pack Gratuit n'autorise pas les vidéos d'échantillons."), upgrade:true, msg:upg }; }
        if(use.echantillonTotal >= lim.echantillonTotal){ return { ok:false, reason:T("Quota d'échantillons atteint ("+lim.echantillonTotal+" max)."), upgrade:true, msg:upg }; }
        if(use.echantillonVideos >= lim.echantillonVideos){ return { ok:false, reason:T("Maximum de "+lim.echantillonVideos+" vidéo(s) pour ce pack."), upgrade:true, msg:upg }; }
      } else {
        if(use.echantillonTotal >= lim.echantillonTotal){ return { ok:false, reason:T("Quota d'échantillons atteint ("+lim.echantillonTotal+" max)."), upgrade:true, msg:upg }; }
      }
      return { ok:true };
    },
    addMedia: function(proId, item){
      var p = getById(store.professionals, proId); if(!p) return { ok:false, reason:T("Professionnel introuvable.") };
      var kind = (item&&item.kind) || "echantillon";
      var type = (item&&item.type==="video") ? "video" : "photo";
      var gate = Sna3tiData.canUploadMedia(proId, { kind:kind, type:type });
      if(!gate.ok) return gate;
      p.media = p.media || [];
      var n = p.media.length;
      p.media.push({ id: uid("MED"), kind:kind, type:type, label: item.label||"", src: item.src||"", added: todayStr(), order: n+1 });
      persist();
      return { ok:true, usage: Sna3tiData.getMediaUsage(proId), limits: Sna3tiData.packageLimits(p.package) };
    },
    removeMedia: function(proId, mediaId){
      var p = getById(store.professionals, proId); if(!p) return false;
      p.media = (p.media||[]).filter(function(m){ return m.id!==mediaId; });
      persist();
      return true;
    },

    // ---- Reviews ----
    getReviews: function(params){
      var list = clone(store.reviews);
      if(params && params.status) list = list.filter(function(r){ return r.status===params.status; });
      return list;
    },
    // ---- Reports ----
    getReports: function(params){ var list=clone(store.reports); if(params&&params.status) list=list.filter(function(r){return r.status===params.status;}); return list; },
    openReport: function(id, adminName){
      var r=getById(store.reports,id); if(!r) return false; 
      if(r.status==="new"){ r.status="under_review"; r.openedAt=new Date().toISOString(); }
      return true;
    },
    // ---- Support tickets ----
    getSupportTickets: function(params){
      var list = clone(store.supportTickets);
      if(params && params.status) list = list.filter(function(t){ return t.status===params.status; });
      if(params && params.priority) list = list.filter(function(t){ return t.priority===params.priority; });
      return list;
    },
    updateSupportTicket: function(id, data){
      var t = getById(store.supportTickets, id); if(!t) return false;
      Object.keys(data||{}).forEach(function(k){ if(data[k]!==undefined) t[k]=data[k]; });
      return true;
    },
    assignSupportTask: function(id, adminId){
      var t = getById(store.supportTickets, id); if(!t) return false;
      t.assignedTo = adminId;
      t.history.push({ date: todayStr(), text:T("Assigné à ")+this.adminName(adminId) });
      return true;
    },
    // ---- Categories / cities ----
    getCategories: function(){ return clone(store.categories); },
    getRegions: function(){ return clone(store.regions); },
    // "No hard-delete" guards for referenced categories/services/locations.
    isCategoryUsed: function(catId){ return store.professionals.some(function(p){ return p.categoryId === catId; }); },
    isServiceUsed: function(svcId){ return store.professionals.some(function(p){ return p.professionId === svcId; }); },
    isRegionUsed: function(regId){ return store.professionals.some(function(p){ return p.regionId === regId; }); },
    isProvinceUsed: function(provId){ return store.professionals.some(function(p){ return p.provinceId === provId; }); },
    isCityUsed: function(cityId){ return store.professionals.some(function(p){ return p.cityId === cityId; }) || store.users.some(function(u){ return u.cityId === cityId; }); },
    isNeighborhoodUsed: function(hoodId){ return store.professionals.some(function(p){ return p.neighborhoodId === hoodId || (p.area && p.area === hoodId); }); },
    // ---- Plans / subs / payments ----
    getSubscriptionPlans: function(){ return clone(store.subscriptionPlans); },
    getSubscriptions: function(){ return clone(store.subscriptions); },
    updateSubscriptionPlan: function(id, data){ var p=getById(store.subscriptionPlans,id); if(!p)return false; Object.keys(data).forEach(function(k){ if(data[k]!==undefined)p[k]=data[k]; }); return true; },
    getPayments: function(){ return clone(store.payments); },
    confirmPayment: function(id){ var p=getById(store.payments,id); if(!p)return false; p.status="confirmed"; p.reviewedAt=new Date().toISOString(); p.reviewedBy=(global.Sna3tiAuth&&global.Sna3tiAuth.getSession)?(global.Sna3tiAuth.getSession()||{}).name:"admin"; var s=store.subscriptions.find(function(x){return x.professionalId===p.professionalId && x.planName===p.planName;}); if(s){s.paymentStatus="confirmed"; s.status="active"; s.activeAt=p.reviewedAt;}
      // Auto-apply the paid-plan badge (VÉRIFIÉ / GOLD) on the professional profile once payment is confirmed.
      var planId = paidPlanByPayment(p);
      if(planId){ applyPlanToProfessional(p.professionalId, planId); }
      // Close the linked plan request (Verification centre) so both areas stay in sync.
      var vr = store.verificationRequests.find(function(x){ return x.paymentId === p.id && x.level==="plan"; });
      if(vr && vr.status!=="approved" && vr.status!=="rejected"){
        vr.status="approved"; vr.reviewedAt=p.reviewedAt; vr.history.push({ date: todayStr(), text:T("Paiement confirmé — plan "+ (vr.requestedPlan||"") +" activé") });
        if(planId){ applyPlanToProfessional(vr.professionalId, planId); }
      }
      return true; },
    rejectPayment: function(id, reason){ var p=getById(store.payments,id); if(!p)return false; p.status="rejected"; p.rejectionReason=reason||""; p.reviewedAt=new Date().toISOString(); p.reviewedBy=(global.Sna3tiAuth&&global.Sna3tiAuth.getSession)?(global.Sna3tiAuth.getSession()||{}).name:"admin";
      // Keep the linked plan request (Verification centre) in sync: reject it and never grant the badge.
      var vr = store.verificationRequests.find(function(x){ return x.paymentId === p.id && x.level==="plan"; });
      if(vr && vr.status!=="approved" && vr.status!=="rejected"){
        vr.status="rejected"; vr.reason=reason||""; vr.reviewedAt=new Date().toISOString();
        vr.history.push({ date: todayStr(), text:T("Paiement rejeté — plan non activé")+(reason?(" — "+reason):"") });
        var pr=getById(store.professionals, vr.professionalId);
        if(pr){ pr.planEligible = false; }
      }
      return true; },
    requestPaymentInfo: function(id, note){ var p=getById(store.payments,id); if(!p)return false; p.status="needs_info"; p.infoRequested=note||""; p.reviewedAt=new Date().toISOString(); p.reviewedBy=(global.Sna3tiAuth&&global.Sna3tiAuth.getSession)?(global.Sna3tiAuth.getSession()||{}).name:"admin"; return true; },
    addPayment: function(data){
      var np = { id:uid("PAY"), reference:"SNA3TI-"+(48290+Math.floor(Math.random()*900)), status:"pending", currency:"MAD", method:"bank_transfer", date:todayStr(), createdAt:new Date().toISOString(),
        professionalId:"", planName:"VÉRIFIÉ", amount:99, bankRef:"", receipt:"" };
      store.payments.unshift(Object.assign(np, data));
      return clone(np);
    },
    // ---- Subscriptions lifecycle ----
    setPlanActive: function(id, active){
      var p=getById(store.subscriptionPlans,id); if(!p)return false;
      p.active=!!active; return true;
    },
    setSubscription: function(proId, planId){
      var p=getById(store.professionals,proId); if(!p)return false;
      var plan=getById(store.subscriptionPlans,planId); if(!plan)return false;
      p.subscriptionPlanId=plan.id; p.package=plan.id.replace("PLAN-","").toLowerCase(); p.subscriptionStatus="active";
      var s=store.subscriptions.find(function(x){return x.professionalId===proId;});
      if(s){ s.planId=plan.id; s.planName=plan.name; s.price=plan.price; s.status="active"; s.paymentStatus="confirmed"; s.since=todayStr(); s.renewal="—"; }
      else {
        store.subscriptions.push({ id:uid("SUB"), professionalId:proId, planId:plan.id, planName:plan.name, status:"active", paymentStatus:"confirmed", price:plan.price, since:todayStr(), renewal:"—" });
      }
      return true;
    },
    // ---- Work queue (dashboard) ----
    getWorkQueue: function(){
      var q = [];
      store.verificationRequests.forEach(function(v){
        if(v.status==="pending"||v.status==="needs_info"){
          q.push({ type:"verification", label:T("Vérification"), id:v.id, ref:(getById(store.professionals,v.professionalId)||{}).name||v.professionalId,
            priority:v.priority==="high"?T("Critique"):v.priority==="medium"?T("Haute"):T("Moyenne"), pclass:v.priority||"medium",
            created:v.submitted, assigned:reviewerName(v.reviewerId), status:v.status, route:"verification" });
        }
      });
      store.payments.forEach(function(p){
        if(p.status==="pending"){
          q.push({ type:"payment", label:T("Paiement"), id:p.id, ref:p.reference+" · "+(getById(store.professionals,p.professionalId)||{}).name||"",
            priority:T("Critique"), pclass:"critical", created:p.date, assigned:reviewerName(p.reviewedBy)||T("Finance"), status:p.status, route:"payments" });
        }
      });
      store.reports.forEach(function(r){
        if(r.status==="new"||r.status==="under_review"){
          var pr = r.priority||(r.status==="new"?"high":"medium");
          q.push({ type:"report", label:T("Signalement"), id:r.id, ref:(getById(store.professionals,r.professionalId)||{}).name||r.professionalId,
            priority:pr==="critical"?T("Critique"):pr==="high"?T("Haute"):pr==="low"?T("Basse"):T("Moyenne"), pclass:pr||"medium",
            created:r.date, assigned:reviewerName(r.assignedTo)||"—", status:r.status, route:"reports" });
        }
      });
      store.reviews.forEach(function(r){
        if(r.status==="flagged"){
          q.push({ type:"review", label:T("Avis signalé"), id:r.id, ref:(getById(store.professionals,r.professionalId)||{}).name||"",
            priority:T("Moyenne"), pclass:"medium", created:r.date, assigned:reviewerName(r.assignedTo)||"—", status:r.status, route:"reviews" });
        }
      });
      store.subscriptions.forEach(function(s){
        if(s.status==="pending"||s.paymentStatus==="pending"){
          q.push({ type:"subscription", label:T("Abonnement"), id:s.id, ref:(getById(store.professionals,s.professionalId)||{}).name||"",
            priority:T("Moyenne"), pclass:"medium", created:s.since, assigned:reviewerName(s.assignedTo)||"—", status:s.status, route:"subscriptions" });
        }
      });
      store.supportTickets.forEach(function(t){
        if(t.status==="open"||t.status==="pending"){
          var pr = t.priority||"medium";
          q.push({ type:"support", label:T("Support"), id:t.id, ref:t.subject,
            priority:pr==="critical"?T("Critique"):pr==="high"?T("Haute"):pr==="low"?T("Basse"):T("Moyenne"), pclass:pr||"medium",
            created:t.created, assigned:reviewerName(t.assignedTo)||"—", status:t.status, route:"support" });
        }
      });
      return q;
    },
    // ---- Delegation: assign verification/report/payment to an admin ----
    assignTask: function(kind, id, adminId){
      if(kind==="verification"){ var v=getById(store.verificationRequests,id); if(v){ v.reviewerId=adminId; return true; } }
      if(kind==="report"){ var r=getById(store.reports,id); if(r){ r.assignedTo=adminId; return true; } }
      if(kind==="payment"){ var p=getById(store.payments,id); if(p){ p.assignedTo=adminId; return true; } }
      return false;
    },
    // ---- User activity ----
    getUserActivity: function(userId){
      var a = [];
      (store.userActivity||[]).forEach(function(x){ if(x.userId===userId) a.push(clone(x)); });
      if(a.length===0){
        a.push({ icon:"search", text:T("5 recherches effectuées cette semaine"), when:T("il y a 2 h"), type:"teal" });
        a.push({ icon:"view", text:T("A consulté 3 professionnels (Maçon, Plombier)"), when:T("il y a 1 h"), type:"blue" });
        a.push({ icon:"contact", text:T("2 demandes de contact envoyées"), when:T("hier"), type:"orange" });
      }
      return a;
    },
    // ---- Users: rich detail (search activity, viewed professionals, contact requests, reviews, reports) ----
    getUserDetail: function(userId){
      var u = getById(store.users, userId);
      var name = u ? u.name : (userId||"");
      var own = store.professionals.filter(function(p){ return p.userId===userId; });
      var others = store.professionals.filter(function(p){ return p.userId!==userId; });
      // deterministic pseudo-random offsets from the user id
      var h = 0; (String(userId)).split("").forEach(function(ch){ h=(h*31+ch.charCodeAt(0))>>>0; });
      function pick(arr, i){ return arr[Math.max(0,1)%arr.length] || arr[0]; }
      var searches = [
        { q:"plombier Casablanca", when:"il y a 2 h" },
        { q:"électricien Rabat", when:"hier" },
        { q:"peintre Marrakech", when:"il y a 2 j" },
        { q:"maçon Agadir", when:"il y a 5 j" }
      ];
      var searchActivity = searches.map(function(s,i){ return { q:s.q, when:s.when, count:(h+i)%5+1 }; });
      var viewedProfessionals = others.slice(0,(h%3)+2).map(function(p){ return { id:p.id, name:p.name, job:p.job, city:p.city }; });
      var contactRequests = (h%3)+1;
      var reviews = store.reviews.filter(function(r){ return r.customer===name; }).map(function(r){ return { id:r.id, professionalId:r.professionalId, rating:r.rating, comment:r.comment, date:r.date, status:r.status }; });
      var reports = store.reports.filter(function(r){ return r.reporter===name; }).map(function(r){ return { id:r.id, professionalId:r.professionalId, reason:r.reason, status:r.status }; });
      var recentSearches = searches.map(function(s){ return s.q; });
      return {
        searches: searchActivity,
        recentSearches: recentSearches,
        viewed: viewedProfessionals,
        contactRequests: contactRequests,
        reviews: reviews,
        reports: reports
      };
    },
    // ---- Dashboard ----
    getKPIs: function(){
      var pros = store.professionals;
      return {
        users: store.users.length,
        professionals: pros.length,
        verified: pros.filter(function(p){ return p.verificationStatus==="approved"; }).length,
        pendingVerification: store.verificationRequests.filter(function(v){ return v.status==="pending"; }).length,
        active: pros.filter(function(p){ return p.status==="active"; }).length,
        activeSubscriptions: store.subscriptions.filter(function(s){ return s.status==="active"; }).length,
        pendingSubscriptions: store.subscriptions.filter(function(s){ return s.status==="pending" || s.paymentStatus==="pending"; }).length,
        flaggedReviews: store.reviews.filter(function(r){ return r.status==="flagged"; }).length,
        openReports: store.reports.filter(function(r){ return r.status==="new" || r.status==="under_review"; }).length,
        searches: 1845,
        contactRequests: 437,
        monthlyRevenue: 67430,
        pendingPayments: store.payments.filter(function(p){ return p.status==="pending"; }).length,
        reported: 3
      };
    },
    getAlerts: function(){ return [
      { type:"warn", icon:"⚠️", title: T(this.getKPIs().pendingVerification + " demandes de vérification en attente"), sub:T("Cliquez pour traiter"), route:"verification" },
      { type:"warn", icon:"💰", title: T(store.payments.filter(function(p){return p.status==="pending";}).length + " paiements en attente de confirmation"), sub:T("Dont virements bancaires à vérifier"), route:"payments" },
      { type:"bad", icon:"🚩", title: T(store.reports.filter(function(r){return r.status==="new" || r.status==="under_review";}).length + " professionnels signalés"), sub:T("Consulter le centre de modération"), route:"reports" },
      { type:"bad", icon:"⭐", title: T(store.reviews.filter(function(r){return r.status==="flagged";}).length + " avis suspects"), sub:T("Vérifier les avis signalés"), route:"reviews" },
      { type:"good", icon:"✓", title: T("Nouveaux professionnels aujourd'hui"), sub:T("2 inscriptions aujourd'hui"), route:"professionals" }
    ]; },
    getActivity: function(){ return clone(store.activity); },
    getAnalytics: function(){ return clone(store.analytics); },
    // Record a real contact/lead event (e.g. a visitor tapping "WhatsApp")
    // into the CURRENT month's slot of monthlyContacts, then persist so the
    // public site's live stats pick it up under the same localStorage key.
    recordContactVisit: function(){
      var series = store.analytics.monthlyContacts || [];
      if(series.length === 12){ series = series.slice(1); store.analytics.monthlyContacts = series; }
      series.push((series.length ? series[series.length-1] : 233) + 1);
      persist();
      return clone(store.analytics.monthlyContacts);
    },
    getNotifications: function(){ return clone(store.notifications); },
    markNotificationsRead: function(){ store.notifications.forEach(function(n){ n.unread=false; }); persist(); },
    markNotificationRead: function(id){ var n=getById(store.notifications,id); if(n){ n.unread=false; persist(); } return !!n; },
    // ---- Admin users & audit ----
    getAdminUsers: function(){ return clone(store.adminUsers); },
    getAuditLogs: function(){ return clone(store.auditLogs); },
    logAudit: function(entry){
      var session = (typeof Sna3tiAuth !== "undefined" && Sna3tiAuth.getSession) ? Sna3tiAuth.getSession() : null;
      var sid = session ? (session.adminId || session.id || "") : "";
      store.auditLogs.unshift(Object.assign(
        { id: uid("AL"), timestamp: new Date().toLocaleString("fr-MA"), result: "Success" },
        sid ? { adminId: sid } : {},
        entry
      ));
      persist();
    },
    getConfig: function(){ return clone(store.config); },
    updateConfig: function(data){
      var merged = Object.assign({}, CONFIG, data);
      if(data.verification){ merged.verification = Object.assign({}, CONFIG.verification, data.verification); }
      CONFIG = merged;
      store.config = merged;
      persist();
      return true;
    },
    resetConfig: function(){
      CONFIG = JSON.parse(JSON.stringify(CONFIG_DEFAULTS));
      store.config = CONFIG;
      persist();
      return true;
    },
    // ---- Legal content (Terms / Privacy / About) ----
    getLegalDocuments: function(){ return clone(store.legal); },
    getLegalDocument: function(id){ return clone(getById(store.legal, id)); },
    updateLegalDocument: function(id, data){
      var d = getById(store.legal, id); if(!d) return false;
      Object.keys(data||{}).forEach(function(k){ if(data[k]!==undefined) d[k]=data[k]; });
      persist();
      return true;
    },
    // ---- Data-layer accessors (spec 36) ----
    // UI controllers go through these facades instead of mutating _store directly,
    // so the persistence boundary (localStorage -> future API -> PostgreSQL) is
    // centralized here and never reached into by presentation code.
    addProfessional: function(pro){
      store.professionals.push(pro);
      persist();
      return pro;
    },
    deleteUser: function(id){
      var u = getById(store.users, id); if(!u) return false;
      store.users = store.users.filter(function(x){ return x.id!==id; });
      persist();
      return true;
    },
    // Live (mutable) references for structured editors (categories / cities).
    // They are read/written exclusively through this facade and persisted only
    // via Sna3tiData.persist(), never by direct localStorage from the UI.
    getCategoriesLive: function(){ return store.categories; },
    getRegionsLive: function(){ return store.regions; },
    deleteReview: function(id){
      var r = getById(store.reviews, id); if(!r) return false;
      store.reviews = store.reviews.filter(function(x){ return x.id!==id; });
      persist();
      return true;
    },
    setReviewStatus: function(id, status){
      var r = getById(store.reviews, id); if(!r) return false;
      r.status = status;
      persist();
      return true;
    },
    flagReview: function(id, data){
      var r = getById(store.reviews, id); if(!r) return false;
      r.status = "flagged";
      r.flaggedReason = (data && data.reason) || "";
      r.flaggedReporter = (data && data.reporter) || "";
      r.flaggedDate = (data && data.date) || todayStr();
      persist();
      return true;
    },
    warnReport: function(id, reason){
      var r = getById(store.reports, id); if(!r) return false;
      r.status = "under_review"; r.warnReason = reason || "";
      persist();
      return true;
    },
    suspendProfessionalByReport: function(id){
      var r = getById(store.reports, id); if(!r) return false;
      var p = getById(store.professionals, r.professionalId);
      if(p){ p.status = "suspended"; }
      r.status = "resolved";
      persist();
      return true;
    },
    setReportStatus: function(id, status){
      var r = getById(store.reports, id); if(!r) return false;
      r.status = status;
      persist();
      return true;
    },
    addSupportReply: function(id, data){
      var t = getById(store.supportTickets, id); if(!t) return false;
      t.history = t.history || [];
      t.history.push({ date: (data && data.date) || todayStr(), text: (data && data.text) || "" });
      t.status = "pending";
      persist();
      return true;
    },
    updateAdminUser: function(id, data){
      var a = getById(store.adminUsers, id); if(!a) return false;
      Object.keys(data||{}).forEach(function(k){ if(data[k]!==undefined) a[k]=data[k]; });
      persist();
      return true;
    },
    addAdminUser: function(data){
      var a = Object.assign({ id: uid("AU"), status:"active", lastLogin:"—", created:new Date().toISOString().slice(0,10) }, data);
      store.adminUsers.push(a);
      persist();
      return a;
    },
    // ---- helpers ----
    cityName: function(id){ var c = store.regions.reduce(function(a,r){ return a.concat(r.cities); },[]).find(function(x){return x.id===id;}); return c ? c.name.fr : id; },
    userName: function(id){ var u=getById(store.users,id); return u?u.name:""; },
    adminName: function(id){ var a=getById(store.adminUsers,id); return a? a.name : (id||"—"); },
    adminIdByEmail: function(email){ var a=store.adminUsers.find(function(x){return (x.email||"").toLowerCase()===String(email||"").toLowerCase();}); return a?a.id:""; },
    _store: store,
    persist: persist
  };

  global.Sna3tiData = Sna3tiData;
  global.Sna3tiRoles = ROLES;

})(window);
