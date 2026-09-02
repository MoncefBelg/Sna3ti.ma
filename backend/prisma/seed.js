require("../src/config/env");
const { prisma, disconnectDb } = require("../src/config/database");
const bcrypt = require("bcrypt");
const env = require("../src/config/env");

const ROLES = [
  { id: "ROLE-SA",  code: "super_admin", name: "Super Administrateur" },
  { id: "ROLE-AD",  code: "admin",       name: "Administrateur" },
  { id: "ROLE-MO",  code: "moderator",   name: "Modérateur" },
  { id: "ROLE-SU",  code: "support",     name: "Support" },
  { id: "ROLE-FI",  code: "finance",     name: "Finance" }
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

  // IdSequence counters so generated ids resume past seeded values.
  for (const [prefix, value] of Object.entries({ USR: 10001, PRO: 10001 })) {
    await prisma.idSequence.upsert({ where: { prefix }, update: {}, create: { prefix, value } });
  }

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

  console.log("Seed complete.");
  await disconnectDb();
}

seed().catch((e) => { console.error(e); process.exit(1); });