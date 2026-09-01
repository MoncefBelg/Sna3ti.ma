// Subscription lifecycle. Used by both verification approval (Scenario A)
// and payment confirmation (Scenario B).

const { AppError } = require("../utils/AppError");

// Activate the requested plan for a professional. Called from
// VerificationService.approve (plan-level) and PaymentService.confirm.
async function activateForProfessional(repos, professionalId, plan) {
  const now = new Date();

  // Upsert the subscription record.
  let sub = await repos.subscriptions.findActiveByProfessional(professionalId);
  const subData = {
    professionalId,
    planId: plan.id,
    planName: plan.name,
    status: "active",
    paymentStatus: "confirmed",
    price: plan.price,
    since: sub?.since || now,
    renewal: sub?.renewal || null,
    activeAt: now
  };
  if (sub) {
    await repos.subscriptions.update(sub.id, subData);
  } else {
    await repos.subscriptions.create(subData);
  }

  // Update the professional record so it carries the active plan
  // info alongside the subscription model (mirrors Sna3tiData layout).
  await repos.professionals.update(professionalId, {
    subscriptionPlanId: plan.id,
    package: plan.code,
    subscriptionStatus: "active"
  });

  return plan;
}

module.exports = { activateForProfessional };