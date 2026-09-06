// Account-free artisan onboarding request repositories (ARQ-xxxxx).
//
// A professional request is the SINGLE source of truth for a "S'inscrire"
// artisan application. The plan is resolved server-side from the plan
// catalogue; the request itself is created with status "pending" and never
// activates a subscription or publishes to the marketplace automatically.
// WhatsApp is only a notification channel layered on top.

const { createGenericRepository } = require("./base");

function createProfessionalRequestRepo(db) {
  const base = createGenericRepository("professionalRequest", db);
  return {
    ...base,
    // Admin list with search + filters (REQ 54). status/planCode are exact
    // server-side filters; city and q (ARQ reference / name / phone) are
    // case-insensitive substring matches resolved at the data layer.
    async listFiltered(filters = {}) {
      const where = {};
      if (filters.status) where.status = filters.status;
      if (filters.planCode) where.planCode = filters.planCode;
      let rows = await base.list(where, { orderBy: { createdAt: "desc" } });

      if (filters.city) {
        const c = String(filters.city).toLowerCase();
        rows = rows.filter((r) => {
          const city = String(r.city || "").toLowerCase();
          const label = String(r.cityLabel || "").toLowerCase();
          return city.includes(c) || label.includes(c);
        });
      }

      if (filters.q) {
        const q = String(filters.q).toLowerCase();
        rows = rows.filter((r) => {
          const haystack = [
            r.id,
            r.firstName,
            r.lastName,
            r.firstName + " " + r.lastName,
            r.lastName + " " + r.firstName,
            r.phone
          ].join(" ").toLowerCase();
          return haystack.includes(q);
        });
      }
      return rows;
    },
    async listByStatus(status) {
      return base.list(status === "all" || !status ? {} : { status }, { orderBy: { createdAt: "desc" } });
    },
    async findPendingByPhone(phone) {
      return base.find({ phone, status: "pending" });
    }
  };
}

function createProfessionalRequestsRepo(db) {
  return {
    professionalRequests: createProfessionalRequestRepo(db)
  };
}

module.exports = { createProfessionalRequestsRepo, createProfessionalRequestRepo };