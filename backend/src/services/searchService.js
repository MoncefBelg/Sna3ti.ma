// Search over professionals (used by GET /search and the public professional
// list). Supports the query params required by req 14: service, city, query,
// rating, plan, availability, page, limit, sort. Always returns a paginated
// envelope: { data, pagination: { page, limit, total, pages } }.

const DEFAULT_LIMIT = 20;

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function search(repos, query = {}) {
  const professionals = await repos.professionals.list({ status: "active" });

  const service = query.service ? String(query.service) : null;
  const city = query.city ? String(query.city) : null;
  const text = query.query ? String(query.query).toLowerCase() : null;
  const minRating = query.rating ? parseFloat(query.rating) : null;
  const plan = query.plan ? String(query.plan).toLowerCase() : null;
  const availability = query.availability !== undefined && query.availability !== ""
    ? (String(query.availability) === "true" || query.availability === "1")
    : null;

  let rows = professionals.filter((p) => {
    if (service) {
      const haystack = [p.job, p.name, p.categoryId, p.services && p.services.join(" ")].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(service.toLowerCase())) return false;
    }
    if (city) {
      const c = [p.city, p.cityId].filter(Boolean).join(" ").toLowerCase();
      if (!c.includes(city.toLowerCase())) return false;
    }
    if (text) {
      const haystack = [p.name, p.job, p.description, p.area, p.neighborhood].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    if (minRating !== null && Number.isFinite(minRating) && (p.rating == null || p.rating < minRating)) return false;
    if (plan) {
      const pkg = String((p.package || p.subscriptionStatus || "free")).toLowerCase();
      if (pkg !== plan && !pkg.includes(plan)) return false;
    }
    if (availability !== null && Boolean(p.available) !== availability) return false;
    return true;
  });

  // Sort.
  const field = String(query.sort || "createdAt");
  const dir = field.startsWith("-") ? -1 : 1;
  const key = field.replace(/^-/, "");
  rows = rows.sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return va < vb ? -dir : va > vb ? dir : 0;
  });

  const total = rows.length;
  const page = toInt(query.page, 1);
  const limit = Math.min(toInt(query.limit, DEFAULT_LIMIT), 100);
  const pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const data = rows.slice(start, start + limit);

  return { data, pagination: { page, limit, total, pages } };
}

module.exports = { search };
