// Payment lifecycle — Scenario B.
// Confirming a payment: activates the subscription (VÉRIFIÉ/GOLD) and
// closes the linked plan request if present; never touches the verified badge.

const { AppError } = require("../utils/AppError");
const { canReadRecord } = require("./billingAccess");
const subscriptionSvc = require("./subscriptionService");
const notificationSvc = require("./notificationService");

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

// REQ 58-C — proof/reference inputs are UNTRUSTED. Sanitize length + control
// chars; reject dangerous URL schemes (`javascript:`, `data:`, `vbscript:`).
// `receipt` may carry a URL but only on a safe protocol (http/https); plain
// references are preserved verbatim (after trimming) so legitimate bank refs
// are never broken.
const MAX_PROOF_LEN = 500;
const DANGEROUS_SCHEME_RE = /^\s*(javascript|data|vbscript):/i;
const SCHEMED_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const SAFE_URL_RE = /^(https?):\/\/[^\s"'<>]+$/i;

function sanitizeProofText(value) {
  if (value == null) return null;
  const str = String(value).trim().slice(0, MAX_PROOF_LEN);
  if (!str) return null;
  if (DANGEROUS_SCHEME_RE.test(str)) return null; // refuse dangerous schemes
  return str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

function sanitizeReceipt(value) {
  if (value == null) return null;
  const str = String(value).trim().slice(0, MAX_PROOF_LEN);
  if (!str) return null;
  if (DANGEROUS_SCHEME_RE.test(str)) return null;
  // If it carries a URL scheme, only allow http/https.
  if (SCHEMED_URL_RE.test(str) && !SAFE_URL_RE.test(str)) return null;
  return str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

// ─── Confirm ────────────────────────────────────────────────────────────────
// REQ 58-F — atomic. The payment confirmation, subscription activation,
// professional-package update, BillingTransaction creation and audit log all
// run inside a single DB transaction. If ANY step fails (e.g. the immutable
// BillingTransaction cannot be written), the WHOLE operation rolls back: no
// partially-confirmed payment, no partially-activated subscription, no orphan
// BillingTransaction. Idempotency is preserved: a second confirm hits the
// 409 gate, and `paymentId @unique` on BillingTransaction prevents duplicates
// at the DB level.
async function confirm(repos, paymentId, admin) {
  return repos.$transaction(async (tx) => {
    const pay = await tx.payments.get(paymentId);
    if (!pay) throw new AppError("Paiement introuvable.", 404);
    if (pay.status !== "pending") throw new AppError("Ce paiement ne peut plus être confirmé.", 409);

    const now = new Date();

    // Mark the payment confirmed.
    await tx.payments.update(paymentId, {
      status: "confirmed",
      reviewedAt: now,
      reviewedById: admin.id
    });

    // Activate the paid plan (VÉRIFIÉ / GOLD) EXACTLY ONCE. The one-month period
    // and the commercial badge are managed inside activateForProfessional; it
    // never auto-approves verification. The resulting paid period is preserved
    // as an immutable BillingTransaction inside the same DB transaction.
    const plan = await findPlan(tx, pay.planName);
    let billingTransactionId = null;
    if (plan) {
      const result = await subscriptionSvc.activateForProfessional(tx, pay.professionalId, plan, {
        audit: true, admin, paymentId
      });
      billingTransactionId = (result && result.billingTransactionId) || null;
    }

    // Close the linked plan request (verification centre) so both stay in sync.
    const vr = await tx.verification.findPlanRequestByPaymentId(paymentId);
    if (vr && vr.status !== "approved" && vr.status !== "rejected") {
      await tx.verification.update(vr.id, {
        status: "approved",
        reviewedAt: now,
        reviewerId: admin.id,
        reviewerName: admin.name,
        history: [...(vr.history || []), { date: now.toISOString(), text: `Paiement confirmé — plan ${(vr.requestedPlan || "")} activé` }]
      });
      if (plan) {
        await tx.professionals.update(vr.professionalId, { planEligible: true });
      }
    }

    await tx.auditLogs.log({
      adminId: admin.id, adminName: admin.name,
      action: "PAYMENT_CONFIRMED", entity: "Payment",
      entityId: paymentId, result: "Confirmed",
      metadata: {
        professionalId: pay.professionalId,
        paymentId,
        billingTransactionId,
        subscriptionId: pay.subscriptionId || null,
        planId: plan ? plan.id : null,
        planName: pay.planName,
        amount: pay.amount,
        currency: pay.currency || "MAD"
      }
    });

    await notificationSvc.notifyAdmin(tx, {
      type: "payment",
      title: "Paiement confirmé",
      message: `${pay.reference || paymentId} confirmé — plan ${pay.planName} (${pay.amount} ${pay.currency || "MAD"}).`,
      entityType: "Payment",
      entityId: paymentId
    });

    return tx.payments.get(paymentId);
  });
}

// ─── Create payment (req 19 / REQ 58-A/B/C) ─────────────────────────────────
// Server-authoritative creation:
//   * Method is MOROCCAN_BANK_TRANSFER.
//   * For ANY payment a valid `planId` MUST be supplied; the server looks up the
//     plan and derives planName / amount / currency from the DB plan — the
//     client can NEVER choose the amount, plan name or currency.
//   * Paid plans require an existing, active plan (REQ 58-B).
//   * Free plan payments are only created when an explicit planId is provided
//     (preserves existing semantics) and always carry the DB amount (0).
//   * Duplicate PENDING payment for the same professional+plan is prevented:
//     the existing pending payment is returned idempotently so a double-submit
//     never creates an orphan row (REQ 58-B).
//   * Proof/reference fields are sanitized (REQ 58-C); proof metadata
//     (submitted timestamp / note) is tracked.
async function create(repos, data, actor) {
  if (!data.professionalId) throw new AppError("professionalId requis.", 400);

  // REQ 58-B — the plan must be supplied and resolve server-side.
  if (!data.planId) throw new AppError("Le plan est requis pour créer un paiement.", 400);
  const plan = await repos.plans.get(data.planId);
  if (!plan) throw new AppError("Plan introuvable.", 404);
  if (plan.active === false) throw new AppError("Ce plan n'est pas disponible.", 400);

  // Always derive server-side values — never from the client.
  const planName = plan.name;
  const amount = plan.price;
  const currency = plan.currency || "MAD";

  // REQ 58-B — prevent accidental duplicate PENDING payments for the same
  // professional + plan. Least-invasive safe rule: return the existing pending
  // payment (idempotent) so a double-submit can never create an orphan row —
  // the client keeps the same workflow record instead of a surprise 4xx.
  const existing = (await repos.payments.list({ professionalId: data.professionalId, status: "pending" }))
    .find((p) => paidPlanCode(p.planName) === paidPlanCode(planName));
  if (existing) return existing;

  const id = await repos.ids.nextId("payment");
  const reference = sanitizeProofText(data.reference) || `REF-${id}`;
  const bankRef = sanitizeProofText(data.bankReference != null ? data.bankReference : data.bankRef);
  const receipt = sanitizeReceipt(data.receiptUrl != null ? data.receiptUrl : data.receipt);
  const proofNote = sanitizeProofText(data.proofNote);
  const now = new Date();

  const payment = await repos.payments.create({
    id,
    reference,
    professionalId: data.professionalId,
    subscriptionId: data.subscriptionId || null,
    planName,
    amount,
    currency,
    method: "bank_transfer", // MOROCCAN_BANK_TRANSFER
    status: "pending",
    bankRef,
    receipt,
    proofSubmittedAt: (receipt != null || bankRef != null || proofNote != null) ? now : null,
    proofNote,
    date: now,
    createdAt: now
  });

  if (actor) {
    await repos.auditLogs.log({
      adminId: actor.id, adminName: actor.name,
      action: "CREATE_PAYMENT", entity: "Payment",
      entityId: id, result: "Created",
      metadata: { professionalId: data.professionalId, planId: plan.id, planName, amount, currency }
    });
  }
  await notificationSvc.notifyAdmin(repos, {
    type: "payment",
    title: "Nouveau paiement en attente",
    message: `${reference} — plan ${planName} (${amount} ${currency}).`,
    entityType: "Payment",
    entityId: id
  });
  return payment;
}

// Public single-payment lookup (only for the payment owner or admin handling).
// REQ 57-D: staff with payments.view, or the owning professional.
async function get(repos, id, actor) {
  const pay = await repos.payments.get(id);
  if (!pay) throw new AppError("Paiement introuvable.", 404);
  const allowed = await canReadRecord(repos, actor, "payments.view", pay.professionalId);
  if (!allowed) throw new AppError("Accès non autorisé.", 403);
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
  await notificationSvc.notifyAdmin(repos, {
    type: "payment",
    title: "Paiement rejeté",
    message: `${pay.reference || paymentId} rejeté — plan ${pay.planName}. ${reason}`,
    entityType: "Payment",
    entityId: paymentId
  });
  return repos.payments.get(paymentId);
}

// ─── Request more information ───────────────────────────────────────────────
// REQ 57-B: only a currently PENDING payment may be moved back to the
// professional for clarification (409 otherwise), mirroring the confirm gate.
async function requestInfo(repos, paymentId, note, admin) {
  if (!note || !String(note).trim()) throw new AppError("La note est requise.", 400);
  const pay = await repos.payments.get(paymentId);
  if (!pay) throw new AppError("Paiement introuvable.", 404);
  if (pay.status !== "pending") throw new AppError("Seul un paiement en attente peut être modifié.", 409);
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