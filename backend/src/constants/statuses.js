// Accepted/known values for select fields, kept in sync with the frontend.

const PAYMENT_STATUSES = ["pending", "confirmed", "rejected", "needs_info"];
const VERIFICATION_STATUSES = ["pending", "approved", "rejected", "needs_info"];
const VERIFICATION_LEVELS = ["join", "identity", "professionnel", "plan"];
const REPORT_STATUSES = ["new", "under_review", "resolved", "ignored"];
const REVIEW_STATUSES = ["pending", "published", "hidden", "flagged"];
const SUPPORT_STATUSES = ["open", "pending", "resolved", "closed"];
const PROFESSIONAL_STATUSES = ["pending", "active", "suspended", "rejected"];
const USER_STATUSES = ["active", "inactive", "suspended"];
const MATCH_STATUSES = ["new", "reviewing", "artisan_contacted", "price_received", "price_sent", "customer_accepted", "customer_rejected", "matched", "completed", "cancelled"];

// Contact interactions (WhatsApp / phone) — closed sets (req contact-trust).
const INTERACTION_CHANNELS = ["WHATSAPP", "PHONE"];
const INTERACTION_SOURCES = ["PROFILE", "SEARCH", "MATCH"];
const INTERACTION_STATUSES = ["TRACKED", "CONFIRMED_CONTACT", "FLAGGED", "REJECTED"];

// Risk bands for the server-computed anti-abuse score (0-100). Boundaries are
// the START of each band: 0-29 LOW, 30-59 MEDIUM, 60-79 HIGH, 80+ CRITICAL.
const RISK_BANDS = { LOW: 0, MEDIUM: 30, HIGH: 60, CRITICAL: 80 };

function riskLevel(score) {
  if (score >= RISK_BANDS.CRITICAL) return "CRITICAL";
  if (score >= RISK_BANDS.HIGH) return "HIGH";
  if (score >= RISK_BANDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

// Entity-id prefixes used for opaque string ids (PRO-, PAY-, VR-, ...).
const ID_PREFIXES = {
  user: "USR",
  professional: "PRO",
  payment: "PAY",
  verification: "VR",
  review: "RV",
  report: "RP",
  subscription: "SUB",
  supportTicket: "SP",
  notification: "NT",
  adminUser: "AU",
  audit: "AL",
  category: "CAT",
  region: "REG",
  city: "CITY",
  plan: "PLAN",
  verificationDocument: "VD",
  match: "REQ",
  matchPhoto: "PH",
  interaction: "INT"
};

module.exports = {
  PAYMENT_STATUSES,
  VERIFICATION_STATUSES,
  VERIFICATION_LEVELS,
  REPORT_STATUSES,
  REVIEW_STATUSES,
  SUPPORT_STATUSES,
  PROFESSIONAL_STATUSES,
  USER_STATUSES,
  MATCH_STATUSES,
  INTERACTION_CHANNELS,
  INTERACTION_SOURCES,
  INTERACTION_STATUSES,
  riskLevel,
  ID_PREFIXES
};