// Payment lifecycle — Scenario B.
// Confirming a payment: activates the subscription (VÉRIFIÉ/GOLD) and
// closes the linked plan request if present; never touches the verified badge.

const { AppError } = require("../utils/AppError");
const subscriptionSvc = require("./subscriptionService");

function paidPlanCode(planName) {
  if (!planName) return null;
  // Normalize accents so "VÉRIFIÉ" → "VERIFIE", then match substrings.
  const key = planName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (key.includes("GOLD")) return "gold";
  if (key.includes("VERIF")) return "verified";
  return "free";
}

async function findPlan(repos, planName) {
  const code = paidPlanCode(planName);
  if (!code) return null;
  return repos.plans.find({ code }) || null;
}

// ─── Confirm ────────────────────────────────────────────────────────────────
async function confirm(repos, paymentId, admin) {
  const pay = await repos.payments.get(paymentId);
  if (!pay) throw new AppError("Paiement introuvable.", 404);
  if (pay.status !== "pending") throw new AppError("Ce paiement ne peut plus être confirmé.", 409);

  const now = new Date();

  // Mark the payment confirmed.
  await repos.payments.update(paymentId, {
    status: "confirmed",
    reviewedAt: now,
    reviewedById: admin.id
  });

  // Activate the paid plan (VÉRIFIÉ / GOLD).
  const plan = await findPlan(repos, pay.planName);
  if (plan) await subscriptionSvc.activateForProfessional(repos, pay.professionalId, plan);

  // Close the linked plan request (verification centre) so both stay in sync.
  const vr = await repos.verification.findPlanRequestByPaymentId(paymentId);
  if (vr && vr.status !== "approved" && vr.status !== "rejected") {
    await repos.verification.update(vr.id, {
      status: "approved",
      reviewedAt: now,
      reviewerId: admin.id,
      reviewerName: admin.name,
      history: [...(vr.history || []), { date: now.toISOString(), text: `Paiement confirmé — plan ${(vr.requestedPlan || "")} activé` }]
    });
    if (plan) {
      await repos.professionals.update(vr.professionalId, { planEligible: true });
      await subscriptionSvc.activateForProfessional(repos, vr.professionalId, plan);
    }
  }

  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "CONFIRM_PAYMENT", entity: "Payment",
    entityId: paymentId, result: "Confirmed"
  });

  return repos.payments.get(paymentId);
}

// ─── Reject ─────────────────────────────────────────────────────────────────
async function reject(repos, paymentId, reason, admin) {
  if (!reason || !String(reason).trim()) throw new AppError("Le motif du rejet est requis.", 400);
  const pay = await repos.payments.get(paymentId);
  if (!pay) throw new AppError("Paiement introuvable.", 404);

  const now = new Date();
  await repos.payments.update(paymentId, {
    status: "rejected", rejectionReason: reason, reviewedAt: now, reviewedById: admin.id
  });

  // Reject linked plan request — badge is NEVER granted.
  const vr = await repos.verification.findPlanRequestByPaymentId(paymentId);
  if (vr && vr.status !== "approved" && vr.status !== "rejected") {
    await repos.verification.update(vr.id, {
      status: "rejected", reason, reviewedAt: now,
      history: [...(vr.history || []), { date: now.toISOString(), text: `Paiement rejeté — plan non activé${reason ? " — " + reason : ""}` }]
    });
    await repos.professionals.update(vr.professionalId, { planEligible: false });
  }

  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "REJECT_PAYMENT", entity: "Payment",
    entityId: paymentId, result: "Rejected", note: reason
  });
  return repos.payments.get(paymentId);
}

// ─── Request more information ───────────────────────────────────────────────
async function requestInfo(repos, paymentId, note, admin) {
  if (!note || !String(note).trim()) throw new AppError("La note est requise.", 400);
  const pay = await repos.payments.get(paymentId);
  if (!pay) throw new AppError("Paiement introuvable.", 404);
  await repos.payments.update(paymentId, {
    status: "needs_info", infoRequested: note, reviewedAt: new Date(), reviewedById: admin.id
  });
  await repos.auditLogs.log({
    adminId: admin.id, adminName: admin.name,
    action: "PAYMENT_INFO_REQUESTED", entity: "Payment",
    entityId: paymentId, result: "Needs info", note
  });
  return repos.payments.get(paymentId);
}

module.exports = { confirm, reject, requestInfo };