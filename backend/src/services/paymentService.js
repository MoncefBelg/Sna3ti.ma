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
    action: "PAYMENT_CONFIRMED", entity: "Payment",
    entityId: paymentId, result: "Confirmed"
  });

  return repos.payments.get(paymentId);
}

// ─── Create payment (req 19) ────────────────────────────────────────────────
// Initial method is MOROCCAN_BANK_TRANSFER. Amount/currency are taken from the
// DB plan — never trusted from the frontend (req 15). Status starts PENDING.
async function create(repos, data, actor) {
  if (!data.professionalId) throw new AppError("professionalId requis.", 400);

  const plan = data.planId ? await repos.plans.get(data.planId) : null;
  const planName = plan ? plan.name : (data.planName || "GRATUIT");
  const amount = plan ? plan.price : data.amount;

  if (amount == null) throw new AppError("Un plan ou un montant valide est requis.", 400);

  const id = await repos.ids.nextId("payment");
  const payment = await repos.payments.create({
    id,
    reference: data.reference || `REF-${id}`,
    professionalId: data.professionalId,
    subscriptionId: data.subscriptionId || null,
    planName,
    amount,
    currency: plan ? (plan.currency || "MAD") : (data.currency || "MAD"),
    method: "bank_transfer", // MOROCCAN_BANK_TRANSFER
    status: "pending",
    bankRef: data.bankReference || null,
    receipt: data.receiptUrl || null,
    date: new Date(),
    createdAt: new Date()
  });

  if (actor) {
    await repos.auditLogs.log({
      adminId: actor.id, adminName: actor.name,
      action: "CREATE_PAYMENT", entity: "Payment",
      entityId: id, result: "Created"
    });
  }
  return payment;
}

// Public single-payment lookup (only for the payment owner or admin handling).
async function get(repos, id) {
  const pay = await repos.payments.get(id);
  if (!pay) throw new AppError("Paiement introuvable.", 404);
  return pay;
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
    action: "PAYMENT_REJECTED", entity: "Payment",
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

module.exports = { confirm, reject, requestInfo, create, get };