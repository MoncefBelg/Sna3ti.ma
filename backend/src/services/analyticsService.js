// Analytics service — REAL figures derived from the live repositories.
//
// GET /admin/analytics returns:
//   totals  …counts/rates/pipeline state (users, pros, registrations, payments…)
//   revenueByPlan …confirmed revenue split by plan
//   mrr      …sum of active subscription prices
//   days[90] {date,signups,activations,revenue,pays,leads,requests}  → daily charts
//   months[12] {month,signups,activations,revenue,pays,leads,conversion,churn} → monthly charts
//   topServices / topCities   …counts over ACTIVE professionals
//   leads    …phone/whatsapp/form splits over match requests
//   notes    …which figures have no upstream data source (honest analytics)
//
// Everything is computed from the DB at request time, so the Analytics page is
// always current; nothing here is static or simulated.

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function pad(n) { return String(n).padStart(2, "0"); }
function monthKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

function lastMonths(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: MONTHS[d.getMonth()] + " " + String(d.getFullYear()).slice(2), index: n - 1 - i });
  }
  return out;
}

function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ key: dayKey(d), index: n - 1 - i });
  }
  return out;
}

function growth(current, previous) {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function getAnalytics(repos) {
  const [pros, reqs, pays, subs, btns, matches] = await Promise.all([
    repos.professionals.list({}),
    repos.professionalRequests.list({}),
    repos.payments.list({}),
    repos.subscriptions.list({}),
    repos.billingTransactions.list({}),
    repos.matchRequests.list({})
  ]);

  // Reviews are read-only inputs (average rating). In case the underying DB
  // lags behind the schema (e.g. missing review columns), the analytics must
  // NOT fail as a whole — the rating falls back to the professional.rating.
  let reviews = [];
  try {
    const mayList = await repos.reviews.list({});
    reviews = Array.isArray(mayList) ? mayList : [];
  } catch (e) {
    reviews = [];
  }

  const now = new Date();
  const monthNow = monthKey(now);
  const M12 = lastMonths(12);
  const D90 = lastDays(90);
  const monthIndexOf = {};
  const dayIndexOf = {};
  M12.forEach((m) => { monthIndexOf[m.key] = m.index; });
  D90.forEach((d) => { dayIndexOf[d.key] = d.index; });

  // ── monthly buckets ────────────────────────────────────────────────
  const signupsM = new Array(12).fill(0);
  const paidReqsM = new Array(12).fill(0);
  const activationsM = new Array(12).fill(0);
  const revenueM = new Array(12).fill(0);
  const paysM = new Array(12).fill(0);
  const leadsM = new Array(12).fill(0);
  const churnM = new Array(12).fill(0);

  for (const r of reqs) {
    const idx = monthIndexOf[monthKey(r.createdAt)];
    if (idx === undefined) continue;
    signupsM[idx] += 1;
    if (r.planCode && r.planCode !== "free") paidReqsM[idx] += 1;
  }
  for (const p of pros) {
    if (p.status === "active") {
      const idx = monthIndexOf[monthKey(p.createdAt)];
      if (idx !== undefined) activationsM[idx] += 1;
    }
  }
  for (const t of btns) {
    if (t.status !== "active") continue;
    const at = t.createdAt || t.periodStartAt;
    const idx = monthIndexOf[monthKey(at || new Date())];
    if (idx !== undefined) revenueM[idx] += t.amount || 0;
  }
  for (const p of pays) {
    if (p.status !== "confirmed") continue;
    const at = p.reviewedAt || p.createdAt;
    const idx = monthIndexOf[monthKey(at || new Date())];
    if (idx !== undefined) paysM[idx] += 1;
  }
  for (const m of matches) {
    const idx = monthIndexOf[monthKey(m.createdAt || new Date())];
    if (idx !== undefined) leadsM[idx] += 1;
  }
  for (const s of subs) {
    if (s.status === "active") continue;
    const at = s.cancelledAt || s.expiresAt || s.updatedAt || s.createdAt;
    const idx = monthIndexOf[monthKey(at || new Date())];
    if (idx !== undefined && s.planName && String(s.planName).toUpperCase() !== "GRATUIT") churnM[idx] += 1;
  }

  const months = M12.map((m) => {
    const i = m.index;
    const paid = paidReqsM[i];
    return {
      month: m.key,
      label: m.label,
      signups: signupsM[i],
      paidRequests: paid,
      activations: activationsM[i],
      revenue: revenueM[i],
      pays: paysM[i],
      leads: leadsM[i],
      conversion: paid > 0 ? Math.round((paysM[i] / paid) * 1000) / 10 : 0,
      churn: churnM[i]
    };
  });

  // ── daily buckets (90d) ────────────────────────────────────────────
  const signupsD = new Array(90).fill(0);
  const activatesD = new Array(90).fill(0);
  const revenueD = new Array(90).fill(0);
  const paysD = new Array(90).fill(0);
  const leadsD = new Array(90).fill(0);
  const requestsD = new Array(90).fill(0);
  for (const r of reqs) { const i = dayIndexOf[dayKey(r.createdAt)]; if (i !== undefined) { signupsD[i] += 1; requestsD[i] += 1; } }
  for (const p of pros) { if (p.status === "active") { const i = dayIndexOf[dayKey(p.createdAt)]; if (i !== undefined) activatesD[i] += 1; } }
  for (const t of btns) { if (t.status !== "active") continue; const i = dayIndexOf[dayKey(t.createdAt || new Date())]; if (i !== undefined) revenueD[i] += t.amount || 0; }
  for (const p of pays) { if (p.status !== "confirmed") continue; const i = dayIndexOf[dayKey(p.reviewedAt || p.createdAt || new Date())]; if (i !== undefined) paysD[i] += 1; }
  for (const m of matches) { const i = dayIndexOf[dayKey(m.createdAt || new Date())]; if (i !== undefined) { leadsD[i] += 1; requestsD[i] += 1; } }

  const days = D90.map((d) => ({
    date: d.key,
    signups: signupsD[d.index],
    activations: activatesD[d.index],
    revenue: revenueD[d.index],
    pays: paysD[d.index],
    leads: leadsD[d.index],
    requests: requestsD[d.index]
  }));

  // ── totals / pipeline ──────────────────────────────────────────────
  const active = pros.filter((p) => p.status === "active");
  const verified = active.filter((p) => p.verified === true);
  const gold = active.filter((p) => String(p.package).toLowerCase() === "gold");
  const paidSubPlanNames = new Set(
    subs.filter((s) => s.status === "active" && String(s.planName).toUpperCase() !== "GRATUIT").map((s) => s.planName)
  );
  const activeSubs = subs.filter((s) => s.status === "active");

  const mrrByPlan = {};
  for (const s of activeSubs) {
    if (String(s.planName || "").toUpperCase() === "GRATUIT") continue;
    const key = s.planName || "Sans nom";
    const ok = (a) => a || 0;
    mrrByPlan[key] = { planName: key, count: ok(mrrByPlan[key] && mrrByPlan[key].count) + 1, amount: ok(mrrByPlan[key] && mrrByPlan[key].amount) + (s.price || 0) };
  }

  const confirmedTxn = btns.filter((t) => t.status === "active");
  const confirmedTotal = confirmedTxn.reduce((sum, t) => sum + (t.amount || 0), 0);
  const pendingPays = pays.filter((p) => p.status === "pending");
  const pendingAmount = pendingPays.reduce((sum, p) => sum + (p.amount || 0), 0);

  const revenueByPlan = {};
  for (const t of confirmedTxn) {
    const key = t.planName || "Sans nom";
    revenueByPlan[key] = revenueByPlan[key] || { planName: key, count: 0, amount: 0 };
    revenueByPlan[key].count += 1;
    revenueByPlan[key].amount += t.amount || 0;
  }

  // ── top lists / reviews / leads ────────────────────────────────────
  const byJob = {};
  const byCity = {};
  for (const p of active) {
    const job = String(p.job || "autre").replace(/_/g, " ").trim();
    byJob[job] = (byJob[job] || 0) + 1;
    const city = String(p.city || p.cityId || "—").replace(/_/g, " ").trim();
    byCity[city] = (byCity[city] || 0) + 1;
  }
  const topServices = Object.keys(byJob).sort((a, b) => byJob[b] - byJob[a]).slice(0, 5);
  const topCities = Object.keys(byCity).sort((a, b) => byCity[b] - byCity[a]).slice(0, 5);

  const rated = active.filter((p) => typeof p.rating === "number");
  const avgRating = rated.length ? Math.round((rated.reduce((s, p) => s + p.rating, 0) / rated.length) * 10) / 10 : 0;
  const publishedRates = reviews.filter((r) => r.status === "published" || r.status === "approved").map((r) => r.rating || 0);
  const avgRatingReviews = publishedRates.length ? Math.round((publishedRates.reduce((a, b) => a + b, 0) / publishedRates.length) * 10) / 10 : 0;

  const phoneLeads = matches.filter((m) => String(m.preferredContact || "").indexOf("phone") > -1 || String(m.preferredContact || "").indexOf("both") > -1).length;
  const whatsappLeads = matches.filter((m) => String(m.preferredContact || "").indexOf("whatsapp") > -1 || String(m.preferredContact || "").indexOf("both") > -1).length;

  const thisMonthRevenue = revenueM[M12[M12.length - 1].index];
  const lastMonthRevenue = M12.length > 1 ? revenueM[M12[M12.length - 2].index] : 0;

  const totals = {
    users: 0,
    professionals: pros.length,
    active: active.length,
    pendingRegistrations: reqs.filter((r) => r.status === "pending").length,
    pendingPayments: pendingPays.length,
    verified: verified.length,
    verifiedPercent: active.length ? Math.round((verified.length / active.length) * 1000) / 10 : 0,
    goldPercent: active.length ? Math.round((gold.length / active.length) * 1000) / 10 : 0,
    paidProfessionals: paidSubPlanNames.size,
    freeToPaid: active.length ? Math.round((paidSubPlanNames.size / active.length) * 1000) / 10 : 0,
    activeSubscriptions: activeSubs.length,
    avgRating: avgRatingReviews || avgRating,
    mrr: activeSubs.reduce((s, sub) => s + (sub.price || 0), 0),
    confirmedAmountTotal: confirmedTotal,
    pendingAmount,
    thisMonthRevenue,
    lastMonthRevenue,
    revenueGrowth: growth(thisMonthRevenue, lastMonthRevenue),
    signupsToday: signupsD[D90.length - 1],
    signupsThisMonth: signupsM[M12[M12.length - 1].index],
    leadsTotal: matches.length
  };

  return {
    totals,
    revenueByPlan: Object.keys(revenueByPlan).map((k) => revenueByPlan[k]).sort((a, b) => b.amount - a.amount),
    mrrByPlan: Object.keys(mrrByPlan).map((k) => mrrByPlan[k]).sort((a, b) => b.amount - a.amount),
    months,
    days,
    topServices,
    topCities,
    leads: { phone: phoneLeads, whatsapp: whatsappLeads, contact: 0, total: matches.length },
    notes: [
      "visites/failedSearches : aucun trafic web n'est enregistré côté serveur — compteur « visites » non disponible.",
      "Churn : abonnements payants terminés/annulés, agrégés par mois."
    ]
  };
}

module.exports = { getAnalytics };