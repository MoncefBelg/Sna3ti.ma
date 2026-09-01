// Subscription plans — mirrored from the Sna3tiData PLAN-* seeds.
// prices in Moroccan Dirham (MAD).

const PLANS = [
  {
    id: "PLAN-FREE",
    code: "free",
    name: "GRATUIT",
    price: 0,
    currency: "MAD",
    active: true,
    limits: { profile: 1, echantillonPhotos: 3, echantillonVideos: 0, echantillonTotal: 3 }
  },
  {
    id: "PLAN-VERIFIED",
    code: "verified",
    name: "VÉRIFIÉ",
    price: 99,
    currency: "MAD",
    active: true,
    limits: { profile: 1, echantillonPhotos: 10, echantillonVideos: 3, echantillonTotal: 10 }
  },
  {
    id: "PLAN-GOLD",
    code: "gold",
    name: "GOLD",
    price: 199,
    currency: "MAD",
    active: true,
    limits: { profile: 1, echantillonPhotos: 20, echantillonVideos: 3, echantillonTotal: 20 }
  }
];

module.exports = { PLANS };