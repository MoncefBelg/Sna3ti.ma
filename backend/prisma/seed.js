require("../src/config/env");
const { prisma, disconnectDb } = require("../src/config/database");
const bcrypt = require("bcrypt");
const env = require("../src/config/env");

const SEED_EXTENDED = false;

const ROLES = [
  { id: "super_admin", label: "Super Admin", color: "#7f3ff2", permissions: { dashboard:["read"], users:["read","update","suspend","delete"], professionals:["read","update","verify","suspend","activate","delete"], verification:["read","approve","reject"], professionalRequests:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve","warn","suspend"], support:["read","update","assign"], categories:["read","update"], cities:["read","update"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], ai:["read"], notifications:["read","send"], settings:["read","update"], legal:["read","update"], adminUsers:["read","update"], auditLogs:["read","export"] } },
  { id: "admin", label: "Admin", color: "#1f9d55", permissions: { dashboard:["read"], users:["read","update","suspend"], professionals:["read","update","verify","suspend","activate"], verification:["read","approve","reject"], professionalRequests:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve"], support:["read","update","assign"], categories:["read","update"], cities:["read","update"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], ai:["read"], notifications:["read","send"], settings:["read","update"], legal:["read","update"], adminUsers:["read"], auditLogs:["read"] } },
  { id: "moderator", label: "Moderator", color: "#db8a00", permissions: { dashboard:["read"], users:["read"], professionals:["read","update","verify"], verification:["read","approve","reject"], professionalRequests:["read","approve","reject"], reviews:["read","moderate","delete"], reports:["read","resolve","warn","suspend"], analytics:["read"], notifications:["read","send"], auditLogs:["read"] } },
  { id: "support", label: "Support", color: "#0b94a6", permissions: { dashboard:["read"], users:["read","update","suspend"], professionals:["read","update"], professionalRequests:["read"], reviews:["read"], reports:["read","resolve"], support:["read","update","assign"], notifications:["read","send"], auditLogs:["read"] } },
  { id: "finance", label: "Finance", color: "#9b2d2d", permissions: { dashboard:["read"], subscriptions:["read","update"], payments:["read","approve","reject"], analytics:["read"], auditLogs:["read","export"] } }
];

const PLANS = [
  {
    id: "PLAN-FREE",
    code: "free",
    name: "Free",
    price: 0,
    currency: "MAD",
    active: true,
    limits: {
      profile: 1,
      echantillonPhotos: 3,
      echantillonVideos: 0,
      echantillonTotal: 3
    }
  },
  {
    id: "PLAN-VERIFIED",
    code: "verified",
    name: "Vérifié",
    price: 99,
    currency: "MAD",
    active: true,
    limits: {
      profile: 1,
      echantillonPhotos: 10,
      echantillonVideos: 3,
      echantillonTotal: 10
    }
  },
  {
    id: "PLAN-GOLD",
    code: "gold",
    name: "Gold",
    price: 199,
    currency: "MAD",
    active: true,
    limits: {
      profile: 1,
      echantillonPhotos: 20,
      echantillonVideos: 3,
      echantillonTotal: 20
    }
  }
];

const CATEGORIES = [
  { id:"CAT-1", code:"plombier", icon:"🔧", order:1, active:true, label:{fr:"Plombier",ar:"سباك",en:"Plumber"}, services:["plomberie"] },
  { id:"CAT-2", code:"electricien", icon:"⚡", order:2, active:true, label:{fr:"Électricien",ar:"كهربائي",en:"Electrician"}, services:["electricite"] },
  { id:"CAT-3", code:"menuisier", icon:"🪚", order:3, active:true, label:{fr:"Menuisier",ar:"نجار",en:"Carpenter"}, services:["menuiserie"] },
  { id:"CAT-4", code:"peintre", icon:"🎨", order:4, active:true, label:{fr:"Peintre",ar:"صباغ",en:"Painter"}, services:["peinture"] },
  { id:"CAT-5", code:"macon", icon:"🧱", order:5, active:true, label:{fr:"Maçon",ar:"بنّاء",en:"Mason"}, services:["maconnerie"] },
  { id:"CAT-6", code:"jardinier", icon:"🌿", order:6, active:true, label:{fr:"Jardinier",ar:"بستاني",en:"Gardener"}, services:["jardinage"] },
  { id:"CAT-7", code:"autres", icon:"🛠️", order:7, active:true, label:{fr:"Autres services",ar:"خدمات أخرى",en:"Other services"}, services:["autres"] }
];

const REGIONS = [
  { id:"REG-1", name:{fr:"Casablanca-Settat",ar:"الدار البيضاء-سطات",en:"Casablanca-Settat"}, slug:"casablanca-settat", order:1 },
  { id:"REG-2", name:{fr:"Rabat-Salé-Kénitra",ar:"الرباط-سلا-القنيطرة",en:"Rabat-Salé-Kénitra"}, slug:"rabat-sale-kenitra", order:2 },
  { id:"REG-3", name:{fr:"Marrakech-Safi",ar:"مراكش-آسفي",en:"Marrakech-Safi"}, slug:"marrakech-safi", order:3 },
  { id:"REG-4", name:{fr:"Tanger-Tétouan-Al Hoceïma",ar:"طنجة-تطوان-الحسيمة",en:"Tangier-Tetouan-Al Hoceima"}, slug:"tanger-tetouan-al-hoceima", order:4 }
];

const CITIES = [
  { id:"CITY-1", name:{fr:"Casablanca",ar:"الدار البيضاء",en:"Casablanca"}, regionId:"REG-1" },
  { id:"CITY-2", name:{fr:"Rabat",ar:"الرباط",en:"Rabat"}, regionId:"REG-2" },
  { id:"CITY-3", name:{fr:"Marrakech",ar:"مراكش",en:"Marrakech"}, regionId:"REG-3" },
  { id:"CITY-4", name:{fr:"Tanger",ar:"طنجة",en:"Tangier"}, regionId:"REG-4" }
];

async function seedReferenceData() {
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { id: p.id },
      update: {
        code: p.code,
        name: p.name,
        price: p.price,
        currency: p.currency,
        active: p.active,
        limits: p.limits
      },
      create: p
    });
  }

  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: {
        code: c.code,
        icon: c.icon,
        order: c.order,
        active: c.active,
        label: c.label,
        services: c.services
      },
      create: c
    });
  }

  for (const r of REGIONS) {
    await prisma.region.upsert({
      where: { id: r.id },
      update: {
        name: r.name,
        slug: r.slug,
        order: r.order
      },
      create: r
    });
  }

  for (const c of CITIES) {
    await prisma.city.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        regionId: c.regionId
      },
      create: c
    });
  }

  console.log("Reference data seeded: 3 plans, 7 categories, 4 regions, 4 cities.");
}

async function seed() {
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { id: r.id },
      update: {},
      create: r
    });
  }

  await seedReferenceData();

const hash = await bcrypt.hash("Hs8#bY5@y3R8Dhcx%ABd", env.bcryptRounds);

  const admins = [
    { id:"admin-1", name:"Super Admin", email:"admin@sna3ti.ma", role:"super_admin", password:hash, status:"active" },
    { id:"admin-2", name:"Admin Test", email:"admin2@sna3ti.ma", role:"admin", password:hash, status:"active" },
    { id:"admin-3", name:"Modérateur", email:"mod@sna3ti.ma", role:"moderator", password:hash, status:"active" },
    { id:"admin-4", name:"Support", email:"support@sna3ti.ma", role:"support", password:hash, status:"active" },
    { id:"admin-5", name:"Finance", email:"finance@sna3ti.ma", role:"finance", password:hash, status:"active" }
  ];

  for (const a of admins) {
    await prisma.adminUser.upsert({
      where: { id: a.id },
      update: {},
      create: a
    });
  }

  for (const [prefix, value] of Object.entries({ USR:10001, PRO:10001 })) {
    await prisma.idSequence.upsert({
      where: { prefix },
      update: {},
      create: { prefix, value }
    });
  }

  if (!env.isProduction) {
    const demoLogo = "assets/img/sna3ti_logo.png";

    const demoProfessionals = [
      {
        id:"PRO-DEV-01",
        name:"Démo Karim (Électricité GOLD)",
        job:"Électricien",
        city:"Casablanca",
        area:"Maarif",
        phone:"+212600000001",
        description:"DÉMO — installation et dépannage électrique.",
        status:"active",
        available:true,
        media:[demoLogo],
        services:["electricite"],
        identityStatus:"approved",
        professionStatus:"approved",
        verificationStatus:"approved",
        verified:true,
        package:"gold",
        rating:4.8,
        reviewsCount:32
      },
      {
        id:"PRO-DEV-02",
        name:"Démo Salma (Plomberie Vérifiée)",
        job:"Plombier",
        city:"Rabat",
        area:"Agdal",
        phone:"+212600000002",
        description:"DÉMO — réparations de fuites et installations sanitaires.",
        status:"active",
        available:true,
        media:[demoLogo],
        services:["plomberie"],
        identityStatus:"approved",
        professionStatus:"approved",
        verificationStatus:"approved",
        verified:true,
        package:"free",
        rating:4.5,
        reviewsCount:18
      },
      {
        id:"PRO-DEV-03",
        name:"Démo Youssef (Peinture Gratuit)",
        job:"Peintre",
        city:"Marrakech",
        area:"Guéliz",
        phone:"+212600000003",
        description:"DÉMO — peinture intérieure/extérieure et rénovation.",
        status:"active",
        available:true,
        media:[demoLogo],
        services:["peinture"],
        identityStatus:"approved",
        professionStatus:"approved",
        verificationStatus:"pending",
        verified:false,
        package:"free",
        rating:null,
        reviewsCount:0
      },
      {
        id:"PRO-DEV-04",
        name:"Démo Mehdi (Menuiserie, sans éval.)",
        job:"Menuisier",
        city:"Casablanca",
        area:"Bourgogne",
        phone:"+212600000004",
        description:"DÉMO — menuiserie sur mesure.",
        status:"active",
        available:false,
        media:[demoLogo],
        services:["menuiserie"],
        identityStatus:"approved",
        professionStatus:"approved",
        verificationStatus:"pending",
        verified:false,
        package:"free",
        rating:4.2,
        reviewsCount:9
      },
      {
        id:"PRO-DEV-05",
        name:"Démo Nadia (Clim GOLD)",
        job:"Climaticien",
        city:"Tanger",
        area:"Malabata",
        phone:"+212600000005",
        description:"DÉMO — installation, entretien et réparation de climatiseurs.",
        status:"active",
        available:true,
        media:[demoLogo],
        services:["climatisation"],
        identityStatus:"approved",
        professionStatus:"approved",
        verificationStatus:"approved",
        verified:true,
        package:"gold",
        rating:4.9,
        reviewsCount:47
      },
      {
        id:"PRO-DEV-06",
        name:"Démo Rachid (Maçonnerie)",
        job:"Maçon",
        city:"Casablanca",
        area:"Californie",
        description:"DÉMO — maçonnerie et gros œuvre.",
        status:"active",
        available:true,
        media:[demoLogo],
        services:["maconnerie"],
        identityStatus:"approved",
        professionStatus:"approved",
        verificationStatus:"pending",
        verified:false,
        package:"free",
        rating:4.0,
        reviewsCount:12
      }
    ];

    for (const d of demoProfessionals) {
      await prisma.professional.upsert({
        where: { id:d.id },
        update:d,
        create:d
      });
    }

    console.log(`Seeded ${demoProfessionals.length} DEMO professionals (dev only).`);
  }

  console.log("Seed complete.");
  await disconnectDb();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
