require("../src/config/env");
const { prisma, disconnectDb } = require("../src/config/database");
const bcrypt = require("bcrypt");
const env = require("../src/config/env");

// NOTE: seed.js is partially out of sync with schema.prisma (Role label/Json,
// Plan features vs limits, trilingual Json labels, User.name...). Only Role +
// AdminUser are required for admin login. Set true to attempt the extended seed
// (may fail on models whose shape drifted). Kept as-is for a later full sync.
const SEED_EXTENDED = false;

const ROLES = [
  { id: "super_admin", label: "Super Admin", color: "#7f3ff2", permissions: { dashboard:["read"], users:["read","update","suspend","delete"], professionals:["read","update","verify","suspend","activate","delete"], verification:["read","approve","reject"], professionalRequests:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve","warn","suspend"], support:["read","update","assign"], categories:["read","update"], cities:["read","update"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], ai:["read"], notifications:["read","send"], settings:["read","update"], legal:["read","update"], adminUsers:["read","update"], auditLogs:["read","export"] } },
  { id: "admin", label: "Admin", color: "#1f9d55", permissions: { dashboard:["read"], users:["read","update","suspend"], professionals:["read","update","verify","suspend","activate"], verification:["read","approve","reject"], professionalRequests:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve"], support:["read","update","assign"], categories:["read","update"], cities:["read","update"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], ai:["read"], notifications:["read","send"], settings:["read","update"], legal:["read","update"], adminUsers:["read"], auditLogs:["read"] } },
  { id: "moderator", label: "Moderator", color: "#db8a00", permissions: { dashboard:["read"], users:["read"], professionals:["read","update","verify"], verification:["read","approve","reject"], professionalRequests:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve","warn","suspend"], analytics:["read"], notifications:["read","send"], auditLogs:["read"] } },
  { id: "support", label: "Support", color: "#0b94a6", permissions: { dashboard:["read"], users:["read","update","suspend"], professionals:["read","update"], professionalRequests:["read"], reviews:["read"], reports:["read","resolve"], support:["read","update","assign"], notifications:["read","send"], auditLogs:["read"] } },
  { id: "finance", label: "Finance", color: "#9b2d2d", permissions: { dashboard:["read"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], auditLogs:["read","export"] } }
];

const PLANS = [
  { id: "PLAN-FREE",   code: "free",     name: "Free",       price: 0,   features: ["Perfil básico","Recherche standard"] },
  { id: "PLAN-VER",    code: "verified", name: "Vérifié",    price: 99,  features: ["Badge vérifié","Visibilité prioritaire","Statistiques détaillées"] },
  { id: "PLAN-GOLD",   code: "gold",     name: "Gold",       price: 199, features: ["Badge vérifié + Gold","Support prioritaire","Mise en avant homepage","Analytics avancées"] }
];

const CATEGORIES = [
  { id: "CAT-1", code: "plombier",     label: "Plombier",      icon: "🔧" },
  { id: "CAT-2", code: "electricien",  label: "Électricien",   icon: "⚡" },
  { id: "CAT-3", code: "menuisier",    label: "Menuisier",     icon: "🪚" },
  { id: "CAT-4", code: "peintre",      label: "Peintre",       icon: "🎨" },
  { id: "CAT-5", code: "macon",        label: "Maçon",         icon: "🧱" },
  { id: "CAT-6", code: "jardinier",    label: "Jardinier",     icon: "🌿" },
  { id: "CAT-7", code: "autres",       label: { fr: "Autres services", ar: "خدمات أخرى", en: "Other services" }, icon: "🛠️" }
];

const REGIONS = [
  { id: "REG-1", name: "Casablanca-Settat",  order: 1 },
  { id: "REG-2", name: "Rabat-Salé-Kénitra", order: 2 },
  { id: "REG-3", name: "Marrakech-Safi",     order: 3 },
  { id: "REG-4", name: "Tanger-Tétouan-Al Hoceïma", order: 4 }
];

const CITIES = [
  { id: "CITY-1", name: "Casablanca",  regionId: "REG-1" },
  { id: "CITY-2", name: "Rabat",       regionId: "REG-2" },
  { id: "CITY-3", name: "Marrakech",   regionId: "REG-3" },
  { id: "CITY-4", name: "Tanger",      regionId: "REG-4" }
];

async function seed() {
  // PrismaClient connects lazily on first query; nothing to pre-connect.

  // Roles
  for (const r of ROLES) {
    await prisma.role.upsert({ where: { id: r.id }, update: {}, create: r });
  }

  if (SEED_EXTENDED) {
  // Plans
  for (const p of PLANS) {
    await prisma.plan.upsert({ where: { id: p.id }, update: {}, create: { ...p, features: JSON.stringify(p.features) } });
  }

  // Categories
  for (const c of CATEGORIES) {
    await prisma.category.upsert({ where: { id: c.id }, update: {}, create: c });
  }

  // Regions + cities
  for (const r of REGIONS) {
    await prisma.region.upsert({ where: { id: r.id }, update: {}, create: r });
  }
  for (const c of CITIES) {
    await prisma.city.upsert({ where: { id: c.id }, update: {}, create: c });
  }
  }

  // Admin users
  const hash = await bcrypt.hash("admin123", env.bcryptRounds);
  const admins = [
    { id: "admin-1", name: "Super Admin", email: "admin@sna3ti.ma",   role: "super_admin", password: hash, status: "active" },
    { id: "admin-2", name: "Admin Test",  email: "admin2@sna3ti.ma",  role: "admin",       password: hash, status: "active" },
    { id: "admin-3", name: "Modérateur",  email: "mod@sna3ti.ma",     role: "moderator",   password: hash, status: "active" },
    { id: "admin-4", name: "Support",     email: "support@sna3ti.ma", role: "support",     password: hash, status: "active" },
    { id: "admin-5", name: "Finance",     email: "finance@sna3ti.ma", role: "finance",     password: hash, status: "active" }
  ];
  for (const a of admins) {
    await prisma.adminUser.upsert({ where: { id: a.id }, update: {}, create: a });
  }

  if (SEED_EXTENDED) {
  // Platform users (auth foundation) — passwords stored as bcrypt hashes only.
  const users = [
    {
      id: "USR-10001", firstName: "Karim", lastName: "Bennani", phone: "+212600000010",
      email: "karim@sna3ti.ma", passwordHash: hash, role: "user", status: "active"
    },
    {
      id: "USR-10002", firstName: "Salma", lastName: "Idrissi", phone: "+212600000011",
      email: "salma@sna3ti.ma", passwordHash: hash, role: "professional", status: "active"
    }
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        ...u,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email.toLowerCase(),
        cityId: null, createdAt: new Date()
      }
    });
  }
}

  // IdSequence counters so generated ids resume past seeded values.
  for (const [prefix, value] of Object.entries({ USR: 10001, PRO: 10001 })) {
    await prisma.idSequence.upsert({ where: { prefix }, update: {}, create: { prefix, value } });
  }

  // DEV-ONLY demo professionals for the public marketplace (Phase 1 — Public
  // Professionals). NEVER seeded in production: the public API serves real
  // registered professionals there instead. These are explicit, clearly-labeled
  // DÉMO entries with opaque ids out of the PRO:10001+ generated range. They
  // exercise the public UI tiers: GOLD≠Vérifié, free, no-rating, unavailable,
  // and a city filter, so the manual API check covers every state.
  if (!env.isProduction) {
    const demoLogo = "assets/img/sna3ti_logo.png";
    const demoProfessionals = [
      {
        id: "PRO-DEV-01", name: "Démo Karim (Électricité GOLD)", job: "Électricien",
        city: "Casablanca", area: "Maarif", phone: "+212600000001",
        description: "DÉMO — installation et dépannage électrique (tableaux, prises, éclairage, mise aux normes).",
        status: "active", available: true,
        media: [demoLogo], services: ["electricite"],
        identityStatus: "approved", professionStatus: "approved",
        verificationStatus: "approved", verified: true,
        package: "gold", rating: 4.8, reviewsCount: 32
      },
      {
        id: "PRO-DEV-02", name: "Démo Salma (Plomberie Vérifiée)", job: "Plombier",
        city: "Rabat", area: "Agdal", phone: "+212600000002",
        description: "DÉMO — réparations de fuites, installations sanitaires, débouchage et chauffe-eau.",
        status: "active", available: true,
        media: [demoLogo], services: ["plomberie"],
        identityStatus: "approved", professionStatus: "approved",
        verificationStatus: "approved", verified: true,
        package: "free", rating: 4.5, reviewsCount: 18
      },
      {
        id: "PRO-DEV-03", name: "Démo Youssef (Peinture Gratuit)", job: "Peintre",
        city: "Marrakech", area: "Guéliz", phone: "+212600000003",
        description: "DÉMO — peinture intérieure/extérieure, rénovation, plafonds et finitions.",
        status: "active", available: true,
        media: [demoLogo], services: ["peinture"],
        identityStatus: "approved", professionStatus: "approved",
        verificationStatus: "pending", verified: false,
        package: "free", rating: null, reviewsCount: 0
      },
      {
        id: "PRO-DEV-04", name: "Démo Mehdi (Menuiserie, sans éval.)", job: "Menuisier",
        city: "Casablanca", area: "Bourgogne", phone: "+212600000004",
        description: "DÉMO — menuiserie sur mesure : portes, fenêtres, placards et cuisines.",
        status: "active", available: false,
        media: [demoLogo], services: ["menuiserie"],
        identityStatus: "approved", professionStatus: "approved",
        verificationStatus: "pending", verified: false,
        package: "free", rating: 4.2, reviewsCount: 9
      },
      {
        id: "PRO-DEV-05", name: "Démo Nadia (Clim GOLD)", job: "Climaticien",
        city: "Tanger", area: "Malabata", phone: "+212600000005",
        description: "DÉMO — installation, entretien et réparation de climatiseurs et chauffage.",
        status: "active", available: true,
        media: [demoLogo], services: ["climatisation"],
        identityStatus: "approved", professionStatus: "approved",
        verificationStatus: "approved", verified: true,
        package: "gold", rating: 4.9, reviewsCount: 47
      },
      {
        id: "PRO-DEV-06", name: "Démo Rachid (Maçonnerie)", job: "Maçon",
        city: "Casablanca", area: "Californie",
        description: "DÉMO — maçonnerie et gros œuvre : murs, cloisons, parpaings et dalles.",
        status: "active", available: true,
        media: [demoLogo], services: ["maconnerie"],
        identityStatus: "approved", professionStatus: "approved",
        verificationStatus: "pending", verified: false,
        package: "free", rating: 4.0, reviewsCount: 12
      }
    ];
    for (const d of demoProfessionals) {
      await prisma.professional.upsert({ where: { id: d.id }, update: d, create: d });
    }
    console.log(`Seeded ${demoProfessionals.length} DEMO professionals (dev only).`);
  }

  if (SEED_EXTENDED) {
  // Legal content (req 24) — terms / privacy / about across en / fr / ar.
  const LEGAL = (type) => ({
    terms: {
      en: { title: "Terms of Service",      content: "Terms of Service for Sna3ti.ma." },
      fr: { title: "Conditions d'utilisation", content: "Conditions d'utilisation de Sna3ti.ma." },
      ar: { title: "شروط الاستخدام",          content: "شروط استخدام موقع سنعتي.ما." }
    },
    privacy: {
      en: { title: "Privacy Policy",        content: "Privacy Policy for Sna3ti.ma." },
      fr: { title: "Politique de confidentialité", content: "Politique de confidentialité de Sna3ti.ma." },
      ar: { title: "سياسة الخصوصية",        content: "سياسة الخصوصية لموقع سنعتي.ما." }
    },
    about: {
      en: { title: "About Us",              content: "About Sna3ti.ma." },
      fr: { title: "À propos de nous",      content: "À propos de Sna3ti.ma." },
      ar: { title: "من نحن",                content: "من نحن - سنعتي.ما." }
    }
  }[type]);

  for (const type of ["terms", "privacy", "about"]) {
    for (const language of ["en", "fr", "ar"]) {
      const l = LEGAL(type)[language];
      await prisma.legalDocument.upsert({
        where: { id: `${type}-${language}` },
        update: {},
        create: {
          id: `${type}-${language}`, type, language,
          title: l.title, content: l.content, version: 1, published: true
        }
      });
    }
  }
}

  console.log("Seed complete.");
  await disconnectDb();
}

seed().catch((e) => { console.error(e); process.exit(1); });