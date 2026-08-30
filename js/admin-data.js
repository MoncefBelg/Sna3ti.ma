/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/admin-data.js
   Data layer: schema, roles, permissions, realistic Moroccan mock data,
   and a service facade (Sna3tiData) decoupled from UI.
   Future: swap mock implementations for real API calls.
   ============================================================ */

(function (global) {
  "use strict";

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
    categories: ["read", "update"],
    cities: ["read", "update"],
    subscriptions: ["read", "update"],
    payments: ["read", "approve", "reject"],
    analytics: ["read"],
    ai: ["read"],
    notifications: ["read", "send"],
    settings: ["read", "update"],
    adminUsers: ["read", "update"],
    auditLogs: ["read", "export"]
  };

  var ROLES = {
    "super_admin": {
      label: "Super Admin",
      color: "purple",
      permissions: { dashboard:["read"], users:["read","update","suspend","delete"], professionals:["read","update","verify","suspend","activate","delete"], verification:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve","warn","suspend"], categories:["read","update"], cities:["read","update"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], ai:["read"], notifications:["read","send"], settings:["read","update"], adminUsers:["read","update"], auditLogs:["read","export"] }
    },
    "admin": {
      label: "Admin",
      color: "teal",
      permissions: { dashboard:["read"], users:["read","update","suspend"], professionals:["read","update","verify","suspend","activate"], verification:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve"], categories:["read","update"], cities:["read","update"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], ai:["read"], notifications:["read","send"], settings:["read","update"], adminUsers:["read"], auditLogs:["read"] }
    },
    "moderator": {
      label: "Moderator",
      color: "blue",
      permissions: { dashboard:["read"], users:["read"], professionals:["read","verify"], verification:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve","warn","suspend"], analytics:["read"], notifications:["read","send"], auditLogs:["read"] }
    },
    "support": {
      label: "Support",
      color: "orange",
      permissions: { dashboard:["read"], users:["read","update","suspend"], professionals:["read","update"], reviews:["read"], reports:["read","resolve"], notifications:["read","send"], auditLogs:["read"] }
    },
    "finance": {
      label: "Finance",
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
      requiredDocuments: ["CIN", "Photo de profil", "Justificatif professionnel (si applicable)"],
      requiredChecks: [
        "identity_checked",
        "phone_confirmed",
        "profession_reviewed",
        "portfolio_reviewed",
        "documents_reviewed",
        "references_reviewed"
      ],
      checkLabels: {
        identity_checked: "Identité vérifiée",
        phone_confirmed: "Téléphone confirmé",
        profession_reviewed: "Profession vérifiée",
        portfolio_reviewed: "Portfolio vérifié",
        documents_reviewed: "Documents vérifiés",
        references_reviewed: "Références vérifiées"
      }
    }
  };

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
      description:"Plombier professionnel spécialisé dans les installations et dépannages." },
    { id:"PRO-10295", userId:"USR-2", professionId:"SVC-ELEC-1", name:"Ahmed Benali", job:"Électricien", categoryId:"CAT-ELEC", category:"Électricité",
      cityId:"CITY-RABA", city:"Rabat", area:"Agdal", rating:4.5, reviewsCount:98, price:180,
      identityStatus:"pending", verificationStatus:"pending", professionStatus:"pending",
      subscriptionPlanId:"PLAN-FREE", subscriptionStatus:"active", verified:false, package:"free",
      status:"pending", available:true, distance:5, phone:"0611223344", email:"ahmed.benali@mail.ma",
      experience:"8 ans", languages:["français","anglais"], created:"2025-06-01",
      description:"Électricien pour installations et dépannages électriques." },
    { id:"PRO-10296", userId:"USR-3", professionId:"SVC-MENU-1", name:"Karim Alaoui", job:"Menuisier", categoryId:"CAT-MENU", category:"Menuiserie",
      cityId:"CITY-MARR", city:"Marrakech", area:"Guéliz", rating:4.9, reviewsCount:210, price:200,
      identityStatus:"verified", verificationStatus:"approved", professionStatus:"verified",
      subscriptionPlanId:"PLAN-GOLD", subscriptionStatus:"active", verified:true, package:"gold",
      status:"active", available:true, distance:3, phone:"0622334455", email:"karim.alaoui@mail.ma",
      experience:"20 ans", languages:["français","arabe","amazigh"], created:"2024-11-20",
      description:"Menuisier d'art, meubles sur mesure et agencements haut de gamme." },
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
    { id:"VR-201", professionalId:"PRO-10295", level:"identity", status:"pending", submitted:"2026-08-22",
      documents:["CIN","Justificatif de domicile"], history:[
        { date:"2026-08-22", text:"Documents soumis" },
        { date:"2026-08-22", text:"Téléphone vérifié" }
      ] },
    { id:"VR-202", professionalId:"PRO-10299", level:"professionnel", status:"pending", submitted:"2026-08-23",
      documents:["CIN","Attestation","Portfolio"], history:[
        { date:"2026-08-23", text:"Documents soumis" }
      ] },
    { id:"VR-203", professionalId:"PRO-10296", level:"identity", status:"approved", submitted:"2024-10-01",
      documents:["CIN"], history:[
        { date:"2024-10-01", text:"Documents soumis" },
        { date:"2024-10-03", text:"Identité examinée" },
        { date:"2024-10-03", text:"Approuvée par Karim Alaoui (Super Admin)" }
      ] }
  ];

  var REVIEWS = [
    { id:"RV-301", professionalId:"PRO-10294", customer:"Omar Berrada", rating:5, comment:"Très professionnel, travail rapide et propre.", status:"published", date:"2026-08-15" },
    { id:"RV-302", professionalId:"PRO-10295", customer:"Leila Mansouri", rating:4, comment:"Bonne intervention, ponctuel.", status:"published", date:"2026-08-16" },
    { id:"RV-303", professionalId:"PRO-10296", customer:"Reda Alaoui", rating:5, comment:"Meubles superbes, je recommande.", status:"published", date:"2026-08-19" },
    { id:"RV-304", professionalId:"PRO-10294", customer:"Yassine M.", rating:5, comment:"Excellent rapport qualité/prix.", status:"pending", date:"2026-08-24" },
    { id:"RV-305", professionalId:"PRO-10297", customer:"Anonyme", rating:1, comment:"Travail bâclé, à éviter.", status:"flagged", date:"2026-08-25" },
    { id:"RV-306", professionalId:"PRO-10298", customer:"Nabila K.", rating:5, comment:"Très sérieuse, bel ouvrage.", status:"published", date:"2026-08-26" }
  ];

  var REPORTS = [
    { id:"RP-401", professionalId:"PRO-10297", reason:"Fausse publicité", description:"Les photos du portfolio ne correspondent pas à la réalité.", reporter:"Omar Berrada", status:"new", date:"2026-08-20" },
    { id:"RP-402", professionalId:"PRO-10295", reason:"Prix trompeur", description:"Tarif annoncé différent en pratique.", reporter:"Leila Mansouri", status:"new", date:"2026-08-21" },
    { id:"RP-403", professionalId:"PRO-10299", reason:"Fake review", description:"Revue suspecte, semble fausse.", reporter:"Système", status:"under_review", date:"2026-08-24" }
  ];

  var SUBSCRIPTION_PLANS = [
    { id:"PLAN-FREE", name:"GRATUIT", price:0, period:"mois", badge:"gray", active:true, hot:false,
      description:"Pour démarrer", advantages:["Profil de base","Visibilité dans les recherches","Réception de leads","Téléphone / WhatsApp","Avis","Disponibilité","Statistiques de base"] },
    { id:"PLAN-VERIFIED", name:"VÉRIFIÉ", price:99, period:"mois", badge:"teal", active:true, hot:false,
      description:"Confiance & visibilité", advantages:["Tout ce qui est inclus dans Gratuit","Badge Professionnel Vérifié SI approuvé séparément","Meilleur classement","Visibilité accrue","Portfolio professionnel","Statistiques avancées","Mise en avant du profil","Meilleure exposition aux leads","Support prioritaire"] },
    { id:"PLAN-GOLD", name:"GOLD", price:199, period:"mois", badge:"orange", active:true, hot:true,
      description:"Impact maximal", advantages:["Tout ce qui est inclus dans Vérifié","Badge GOLD","Placement premium","Profil mis en avant","Boost de visibilité","Analytiques avancées","Leads prioritaires","Assistant IA de profil","Portfolio premium","Support VIP","Éligibilité au statut Top Pro"] }
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

  var PAYMENTS = [
    { id:"PAY-7001", reference:"SNA3TI-48291", professionalId:"PRO-10296", planName:"GOLD", amount:199, method:"bank_transfer",
      bankRef:"REF-8821", date:"2026-08-01", status:"confirmed" },
    { id:"PAY-7002", reference:"SNA3TI-48292", professionalId:"PRO-10294", planName:"VÉRIFIÉ", amount:99, method:"bank_transfer",
      bankRef:"REF-5522", date:"2026-07-10", status:"confirmed" },
    { id:"PAY-7003", reference:"SNA3TI-48293", professionalId:"PRO-10298", planName:"VÉRIFIÉ", amount:99, method:"card",
      bankRef:"CARD-7710", date:"2026-06-15", status:"pending" },
    { id:"PAY-7004", reference:"SNA3TI-48294", professionalId:"PRO-10295", planName:"VÉRIFIÉ", amount:99, method:"bank_transfer",
      bankRef:"REF-9911", date:"2026-08-28", status:"pending" }
  ];

  var NOTIFICATIONS = [
    { id:"NT-1", type:"verification", text:"3 demandes de vérification en attente", when:"il y a 5 min", unread:true, route:"verification" },
    { id:"NT-2", type:"payment", text:"2 paiements en attente de confirmation", when:"il y a 18 min", unread:true, route:"payments" },
    { id:"NT-3", type:"report", text:"Nouveau signalement: PRO-10297", when:"il y a 24 min", unread:true, route:"reports" },
    { id:"NT-4", type:"report", text:"Avis signalé: RV-305", when:"il y a 30 min", unread:false, route:"reports" },
    { id:"NT-5", type:"subscription", text:"Abonnement GOLD renouvelé", when:"il y a 1 h", unread:false, route:"subscriptions" }
  ];

  var ADMIN_USERS = [
    { id:"AU-1", name:"Admin User", email:"admin@sna3ti.ma", role:"super_admin", status:"active", lastLogin:"2026-08-29 17:42", created:"2024-01-01" },
    { id:"AU-2", name:"Finance Manager", email:"finance@sna3ti.ma", role:"finance", status:"active", lastLogin:"2026-08-29 09:10", created:"2024-03-15" },
    { id:"AU-3", name:"Moderator Team", email:"mod@sna3ti.ma", role:"moderator", status:"active", lastLogin:"2026-08-28 20:05", created:"2024-05-20" },
    { id:"AU-4", name:"Support Agent", email:"support@sna3ti.ma", role:"support", status:"inactive", lastLogin:"2026-08-10 12:00", created:"2024-06-01" }
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
    { id:"AC-1", icon:"pro", text:"Yassine El Amrani s'est inscrit comme professionnel", when:"il y a 5 min", type:"teal" },
    { id:"AC-2", icon:"verif", text:"Vérification approuvée pour Karim Alaoui", when:"il y a 12 min", type:"green" },
    { id:"AC-3", icon:"payment", text:"Paiement confirmé SNA3TI-48291", when:"il y a 18 min", type:"orange" },
    { id:"AC-4", icon:"report", text:"Avis signalé pour Omar Tazi", when:"il y a 24 min", type:"red" },
    { id:"AC-5", icon:"sub", text:"Abonnement VÉRIFIÉ renouvelé", when:"il y a 31 min", type:"teal" }
  ];

  var ANALYTICS = {
    visits: [240,320,410,380,520,610,720,690,810,940,1010,1120],
    signups: [12,18,15,22,28,31,35,30,42,48,55,61],
    leads: { phone:842, whatsapp:1240, contact:437 },
    topServices: ["Plomberie","Électricité","Menuiserie","Coiffure","Peinture"],
    topCities: ["Casablanca","Rabat","Marrakech","Fès","Agadir"]
  };

  // ============================================================
  // Service facade — future API integration points
  // Each *Async returns a Promise to mimic a backend.
  // ============================================================

  var store = {
    users: USERS, professionals: PROFESSIONALS, categories: CATEGORIES,
    regions: REGIONS, reviews: REVIEWS, reports: REPORTS,
    subscriptionPlans: SUBSCRIPTION_PLANS, subscriptions: SUBSCRIPTIONS,
    payments: PAYMENTS, notifications: NOTIFICATIONS, adminUsers: ADMIN_USERS,
    auditLogs: AUDIT_LOGS, verificationRequests: VERIFICATION_REQUESTS,
    activity: ACTIVITY, analytics: ANALYTICS, config: CONFIG
  };

  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function uid(prefix){ return prefix + "-" + Math.floor(100000 + Math.random()*900000); }
  function todayStr(){ return new Date().toISOString().slice(0,10); }

  // Persist collections to localStorage (best-effort) for demo continuity.
  var MUTABLE_KEYS = ["professionals","users","subscriptions","payments","verificationRequests","reviews","reports","categories","regions","notifications","adminUsers","config"];
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

  var Sna3tiData = {
    permissionsCatalog: PERMISSION_CATALOG,
    roles: ROLES,

    // ---- Professionals ----
    getProfessionals: function(params){
      var list = clone(where(store.professionals, function(){ return true; }));
      if(params){
        if(params.q){ var q=params.q.toLowerCase(); list = list.filter(function(p){ return (p.name+" "+p.job+" "+p.city+" "+p.category).toLowerCase().indexOf(q)>-1; }); }
        if(params.city) list = list.filter(function(p){ return p.city === params.city; });
        if(params.category) list = list.filter(function(p){ return p.category === params.category; });
        if(params.package) list = list.filter(function(p){ return p.package === params.package; });
        if(params.verification){ if(params.verification==="verified") list = list.filter(function(p){ return p.verificationStatus==="approved"; }); else if(params.verification==="unverified") list = list.filter(function(p){ return p.verificationStatus!=="approved"; }); }
        if(params.status) list = list.filter(function(p){ return p.status === params.status; });
      }
      return list;
    },
    getProfessional: function(id){ return clone(getById(store.professionals, id)); },
    countProfessionals: function(){ return store.professionals.length; },
    updateProfessional: function(id, data){
      var p = getById(store.professionals, id); if(!p) return false;
      Object.keys(data).forEach(function(k){ if(data[k]!==undefined) p[k]=data[k]; });
      return true;
    },
    getProfessionalsAsync: function(params){
      return new Promise(function(resolve){ setTimeout(function(){ resolve(Sna3tiData.getProfessionals(params)); }, 300); });
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
      v.history.push({ date: todayStr(), text:"Approuvée par "+adminName });
      var p = getById(store.professionals, v.professionalId);
      if(p){ p.verificationStatus="approved"; p.verified=true; if(v.level==="professionnel"){ p.professionStatus="verified"; } else { p.identityStatus="verified"; } }
      return true;
    },
    rejectVerification: function(id, reason, adminName){
      var v = getById(store.verificationRequests, id); if(!v) return false;
      v.status="rejected"; v.reason=reason||"";
      v.history.push({ date: todayStr(), text:"Rejetée par "+adminName+(reason?" — "+reason:"") });
      var p = getById(store.professionals, v.professionalId);
      if(p && v.level==="professionnel"){ p.professionStatus="rejected"; } else { p.identityStatus="rejected"; }
      return true;
    },
    requestMoreInfo: function(id, note, adminName){
      var v = getById(store.verificationRequests, id); if(!v) return false;
      v.status="needs_info"; v.history.push({ date: todayStr(), text:"Informations demandées par "+adminName+(note?" — "+note:"") });
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
    // ---- Categories / cities ----
    getCategories: function(){ return clone(store.categories); },
    getRegions: function(){ return clone(store.regions); },
    // ---- Plans / subs / payments ----
    getSubscriptionPlans: function(){ return clone(store.subscriptionPlans); },
    getSubscriptions: function(){ return clone(store.subscriptions); },
    updateSubscriptionPlan: function(id, data){ var p=getById(store.subscriptionPlans,id); if(!p)return false; Object.keys(data).forEach(function(k){ if(data[k]!==undefined)p[k]=data[k]; }); return true; },
    getPayments: function(){ return clone(store.payments); },
    confirmPayment: function(id){ var p=getById(store.payments,id); if(!p)return false; p.status="confirmed"; var s=store.subscriptions.find(function(x){return x.professionalId===p.professionalId && x.planName===p.planName;}); if(s){s.paymentStatus="confirmed"; s.status="active";} return true; },
    rejectPayment: function(id){ var p=getById(store.payments,id); if(!p)return false; p.status="rejected"; return true; },
    // ---- Dashboard ----
    getKPIs: function(){
      var pros = store.professionals;
      return {
        users: store.users.length,
        professionals: pros.length,
        verified: pros.filter(function(p){ return p.verificationStatus==="approved"; }).length,
        pendingVerification: store.verificationRequests.filter(function(v){ return v.status==="pending"; }).length,
        active: pros.filter(function(p){ return p.status==="active"; }).length,
        searches: 1845,
        contactRequests: 437,
        monthlyRevenue: 67430,
        pendingPayments: store.payments.filter(function(p){ return p.status==="pending"; }).length,
        reported: 3
      };
    },
    getAlerts: function(){ return [
      { type:"warn", icon:"⚠️", title: this.getKPIs().pendingVerification + " demandes de vérification en attente", sub:"Cliquez pour traiter", route:"verification" },
      { type:"warn", icon:"💰", title: store.payments.filter(function(p){return p.status==="pending";}).length + " paiements en attente de confirmation", sub:"Dont virements bancaires à vérifier", route:"payments" },
      { type:"bad", icon:"🚩", title: store.reports.filter(function(r){return r.status==="new" || r.status==="under_review";}).length + " professionnels signalés", sub:"Consulter le centre de modération", route:"reports" },
      { type:"bad", icon:"⭐", title: store.reviews.filter(function(r){return r.status==="flagged";}).length + " avis suspects", sub:"Vérifier les avis signalés", route:"reviews" },
      { type:"good", icon:"✓", title: "Nouveaux professionnels aujourd'hui", sub:"2 inscriptions aujourd'hui", route:"professionals" }
    ]; },
    getActivity: function(){ return clone(store.activity); },
    getAnalytics: function(){ return clone(store.analytics); },
    getNotifications: function(){ return clone(store.notifications); },
    markNotificationsRead: function(){ store.notifications.forEach(function(n){ n.unread=false; }); },
    // ---- Admin users & audit ----
    getAdminUsers: function(){ return clone(store.adminUsers); },
    getAuditLogs: function(){ return clone(store.auditLogs); },
    logAudit: function(entry){ store.auditLogs.unshift(Object.assign({ id:uid("AL"), timestamp:new Date().toLocaleString("fr-MA"), result:"Success" }, entry)); },
    getConfig: function(){ return clone(store.config); },
    updateConfig: function(data){
      var merged = Object.assign({}, CONFIG, data);
      if(data.verification){ merged.verification = Object.assign({}, CONFIG.verification, data.verification); }
      CONFIG = merged;
      store.config = merged;
      return true;
    },
    // ---- helpers ----
    cityName: function(id){ var c = store.regions.reduce(function(a,r){ return a.concat(r.cities); },[]).find(function(x){return x.id===id;}); return c ? c.name.fr : id; },
    userName: function(id){ var u=getById(store.users,id); return u?u.name:""; },
    _store: store,
    persist: persist
  };

  global.Sna3tiData = Sna3tiData;
  global.Sna3tiRoles = ROLES;

})(window);
