require("./config/env");
const { prisma, connectDB } = require("./config/database");
const bcrypt = require("bcrypt");
const env = require("./config/env");

const ROLES = [
  { id: "ROLE-SA",  code: "super_admin", name: "Super Administrateur" },
  { id: "ROLE-AD",  code: "admin",       name: "Administrateur" },
  { id: "ROLE-MO",  code: "moderator",   name: "Modérateur" },
  { id: "ROLE-SU",  code: "support",     name: "Support" },
  { id: "ROLE-FI",  code: "finance",     name: "Finance" }
];

const PLANS = [
  { id: "PLAN-FREE",   code: "free",     name: "Free",       price: 0,   features: ["Perfil básico","Recherche standard"] },
  { id: "PLAN-VER",    code: "verified", name: "Vérifié",    price: 499, features: ["Badge vérifié","Visibilité prioritaire","Statistiques détaillées"] },
  { id: "PLAN-GOLD",   code: "gold",     name: "Gold",       price: 999, features: ["Badge vérifié + Gold","Support prioritaire","Mise en avant homepage","Analytics avancées"] }
];

const CATEGORIES = [
  { id: "CAT-1", code: "plombier",     label: "Plombier",      icon: "🔧" },
  { id: "CAT-2", code: "electricien",  label: "Électricien",   icon: "⚡" },
  { id: "CAT-3", code: "menuisier",    label: "Menuisier",     icon: "🪚" },
  { id: "CAT-4", code: "peintre",      label: "Peintre",       icon: "🎨" },
  { id: "CAT-5", code: "macon",        label: "Maçon",         icon: "🧱" },
  { id: "CAT-6", code: "jardinier",    label: "Jardinier",     icon: "🌿" }
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
  await connectDB();

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

  console.log("Seed complete.");
  await prisma.$disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });