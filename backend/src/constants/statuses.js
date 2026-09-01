// Accepted/known values for select fields, kept in sync with the frontend.

const PAYMENT_STATUSES = ["pending", "confirmed", "rejected", "needs_info"];
const VERIFICATION_STATUSES = ["pending", "approved", "rejected", "needs_info"];
const VERIFICATION_LEVELS = ["join", "identity", "professionnel", "plan"];
const REPORT_STATUSES = ["new", "under_review", "resolved", "ignored"];
const REVIEW_STATUSES = ["published", "hidden", "flagged"];
const SUPPORT_STATUSES = ["open", "pending", "resolved", "closed"];
const PROFESSIONAL_STATUSES = ["pending", "active", "suspended", "rejected"];
const USER_STATUSES = ["active", "inactive", "suspended"];

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
  plan: "PLAN"
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
  ID_PREFIXES
};