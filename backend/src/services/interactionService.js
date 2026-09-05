// Contact interaction service (WhatsApp Interaction + Review Trust System).
//
// A ProfessionalContactInteraction is the only server-side proof that a
// customer actually reached an artisan. It drives review eligibility:
//   - authenticated platform User (never an admin account, never a fabricated id)
//   - channel WHATSAPP
//   - positive customer confirmation (CONFIRMED_CONTACT)
//   - 48h cooling-off period (reviewEligibleAt = last genuine contact + 48h)
//   - one review max per customer + professional
//
// Privacy rule: only metadata is persisted (who, when, channel, outcome).
// The content of the WhatsApp conversation is NEVER read or stored.

const { AppError } = require("../utils/AppError");
const {
  INTERACTION_CHANNELS,
  INTERACTION_SOURCES,
  riskLevel
} = require("../constants/statuses");

// A genuine contact is the source of a NEW eligibility window. Two clicks in
// the same dedup window count as ONE contact session.
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const REVIEW_COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48 hours
const VERIFIED_CHANNEL = "WHATSAPP";

// Resolves whether the authenticated actor maps to a platform User. Only
// platform Users (customer accounts) can ever become review-eligible.
async function resolveCustomer(repos, actor) {
  if (!actor || !actor.id) return null;
  const user = await repos.users.get(actor.id);
  return user || null;
}

function normalizeComment(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Anti-abuse score 0-100, computed server-side at contact-record and at review
// submission. None of the signals come from the client.
async function evaluateRisk(repos, user, { professionalId, comment }) {
  let score = 0;
  const flags = [];
  const now = Date.now();

  // A: 30+ distinct artisans contacted within a short window.
  const recentContacts = await repos.interactions.countContactsInWindow(user.id, new Date(now - DEDUP_WINDOW_MS));
  if (recentContacts >= 30) { score += 10; flags.push("high_contact_velocity"); }

  // C: several reviews submitted within 24h.
  const recentReviews = (await repos.interactions.listReviewsByCustomer(user.id))
    .filter((r) => r.createdAt && new Date(r.createdAt).getTime() >= now - 24 * 3600 * 1000);
  if (recentReviews.length >= 3) { score += 20; flags.push("high_review_velocity"); }

  // D: very new accounts submitting reviews deserve additional scrutiny.
  if (user.createdAt && new Date(user.createdAt).getTime() >= now - 48 * 3600 * 1000) {
    score += 20; flags.push("new_account");
  }

  // E: identical (normalized) comment already posted by the same customer.
  if (comment && comment.trim()) {
    const norm = normalizeComment(comment);
    const duplicated = recentReviews.some((r) => r.comment && normalizeComment(r.comment) === norm);
    if (duplicated) { score += 30; flags.push("duplicate_content"); }
  }

  return { score: Math.min(score, 100), level: riskLevel(Math.min(score, 100)), flags };
}

// True review eligibility, derived from the stored facts (never from client
// claims). Returns { eligible, reasons, reviewEligibleAt, verifiedContact }.
function deriveEligibility(user, interaction, otherReviews) {
  const reasons = [];
  let reviewEligibleAt = null;
  if (!user) reasons.push("account_required");
  if (!interaction) reasons.push("no_contact");

  if (interaction) {
    reviewEligibleAt = interaction.reviewEligibleAt || null;
    if (interaction.channel !== VERIFIED_CHANNEL) reasons.push("channel_not_whatsapp");
    if (interaction.status === "FLAGGED" || interaction.status === "REJECTED") reasons.push("interaction_rejected");
    if (!interaction.customerConfirmed) reasons.push("contact_not_confirmed");
    if (interaction.customerConfirmed && reviewEligibleAt && Date.now() < new Date(reviewEligibleAt).getTime()) {
      reasons.push("cooldown_48h");
    }
    if (interaction.reviewId) reasons.push("already_reviewed");
  }

  if (otherReviews && otherReviews.length > 0) reasons.push("already_reviewed");

  const eligible = reasons.length === 0;
  return { eligible, reasons, reviewEligibleAt };
}

// ── Record a contact (POST /professionals/:id/contact) ──────────────────────
// Records that a customer reached an artisan (channel sensor is server-derived
// from the requested endpoint; the client may supply channel/source but they
// are validated against closed sets). Never blocks the WhatsApp handoff — the
// caller opens WhatsApp regardless of this call's outcome.
async function record(repos, professionalId, { actor, channel, source }) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);

  const ch = channel || "WHATSAPP";
  const src = source || "PROFILE";
  if (!INTERACTION_CHANNELS.includes(ch)) throw new AppError("Canal de contact invalide.", 400, [{ field: "channel", message: "Canal de contact invalide." }]);
  if (!INTERACTION_SOURCES.includes(src)) throw new AppError("Source de contact invalide.", 400, [{ field: "source", message: "Source de contact invalide." }]);

  const user = await resolveCustomer(repos, actor);
  const customerId = user ? user.id : null;
  const now = new Date();
  const reviewEligibleAt = new Date(now.getTime() + REVIEW_COOLDOWN_MS);

  const existing = await repos.interactions.findByCustomerAndProfessional(customerId, professionalId);

  if (existing) {
    const last = new Date(existing.lastContactAt).getTime();
    const withinDedup = now.getTime() - last < DEDUP_WINDOW_MS && !existing.customerConfirmed;
    const updated = await repos.interactions.update(existing.id, {
      lastContactAt: now,
      reviewEligibleAt: withinDedup ? existing.reviewEligibleAt : reviewEligibleAt,
      updatedAt: now
    });
    await repos.auditLogs.log({
      adminId: actor && actor.id, action: "CONTACT_RECORDED", entity: "ContactInteraction",
      entityId: existing.id, result: withinDedup ? "Deduped" : "Refreshed",
      metadata: { professionalId, channel: ch, source: src, customerId }
    });
    return { interaction: updated, repeated: true, created: false };
  }

  let riskScore = 0;
  let riskFlags = [];
  if (user) {
    const risk = await evaluateRisk(repos, user, { professionalId, comment: null });
    riskScore = risk.score;
    riskFlags = risk.flags;
  }

  const id = await repos.ids.nextId("interaction");
  const interaction = await repos.interactions.create({
    id,
    customerId,
    professionalId,
    channel: ch,
    source: src,
    status: "TRACKED",
    lastContactAt: now,
    reviewEligibleAt,
    customerConfirmed: false,
    riskScore,
    riskFlags,
    createdAt: now,
    updatedAt: now
  });
  await repos.auditLogs.log({
    adminId: actor && actor.id, action: "CONTACT_RECORDED", entity: "ContactInteraction",
    entityId: id, result: "Tracked",
    metadata: { professionalId, channel: ch, source: src, customerId, riskScore }
  });
  return { interaction, repeated: false, created: true };
}

// ── Confirm a contact (POST /professionals/:id/contact/confirm) ─────────────
// The customer explicitly states whether real contact happened. Only a
// "confirmed: true" unlocks review eligibility (after the 48h rule).
async function confirm(repos, professionalId, { actor, confirmed, serviceStatus }) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);

  const user = await resolveCustomer(repos, actor);
  if (!user) throw new AppError("Un compte client est requis pour confirmer un contact.", 403);

  if (typeof confirmed !== "boolean") {
    throw new AppError("Le champ confirmed doit être un booléen.", 400, [{ field: "confirmed", message: "confirmed doit être un booléen." }]);
  }
  if (serviceStatus !== undefined && serviceStatus !== null && !["yes", "no", "in_progress"].includes(serviceStatus)) {
    throw new AppError("Valeur de serviceStatus invalide (yes | no | in_progress).", 400, [{ field: "serviceStatus", message: "Valeur invalide." }]);
  }

  const interaction = await repos.interactions.findByCustomerAndProfessional(user.id, professionalId);
  if (!interaction) throw new AppError("Aucun contact enregistré avec cet artisan.", 404);

  const now = new Date();
  const updated = await repos.interactions.update(interaction.id, {
    customerConfirmed: confirmed,
    customerConfirmedAt: confirmed ? now : null,
    customerReportedService: serviceStatus !== undefined && serviceStatus !== null ? serviceStatus : interaction.customerReportedService,
    status: confirmed ? "CONFIRMED_CONTACT" : "TRACKED",
    updatedAt: now
  });

  await repos.auditLogs.log({
    adminId: actor.id, action: "CONTACT_CONFIRMED", entity: "ContactInteraction",
    entityId: interaction.id, result: confirmed ? "Confirmed" : "NotConfirmed",
    metadata: { professionalId, customerId: user.id, customerReportedService: serviceStatus }
  });

  return { interaction: updated, eligibility: deriveEligibility(user, updated, null) };
}

// ── My eligibility (GET /professionals/:id/contact/eligibility) ─────────────
async function myEligibility(repos, professionalId, actor) {
  const pro = await repos.professionals.get(professionalId);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  const user = await resolveCustomer(repos, actor);
  if (!user) return { eligible: false, reasons: ["account_required"], reviewEligibleAt: null, verifiedContact: false };

  const interaction = await repos.interactions.findByCustomerAndProfessional(user.id, professionalId);
  if (!interaction) return { eligible: false, reasons: ["no_contact"], reviewEligibleAt: null, verifiedContact: false };

  const otherReviews = (await repos.interactions.listReviewsByCustomer(user.id))
    .filter((r) => r.professionalId === professionalId);
  const result = deriveEligibility(user, interaction, otherReviews);
  return { ...result, verifiedContact: result.eligible };
}

// ── Admin views (dashboard: customer, pro, channel, 48h, confirmation, risk) ─
async function list(repos, query) {
  const rows = await repos.interactions.list({}, { orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    professionalId: r.professionalId,
    channel: r.channel,
    source: r.source,
    status: r.status,
    confirmed: r.customerConfirmed,
    customerReportedService: r.customerReportedService || null,
    riskScore: r.riskScore,
    riskFlags: r.riskFlags || [],
    lastContactAt: r.lastContactAt,
    reviewEligibleAt: r.reviewEligibleAt,
    reviewId: r.reviewId,
    createdAt: r.createdAt
  }));
}

async function get(repos, interactionId) {
  const row = await repos.interactions.get(interactionId);
  if (!row) throw new AppError("Interaction introuvable.", 404);
  return row;
}

module.exports = {
  record, confirm, myEligibility, list, get,
  resolveCustomer, deriveEligibility, evaluateRisk, normalizeComment,
  DEDUP_WINDOW_MS, REVIEW_COOLDOWN_MS
};