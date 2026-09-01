// In-memory Prisma-compatible adapter. Provides the same methods the
// repositories call (`findFirst`, `findMany`, `create`, `update`,
// `delete`, `count`) without PostgreSQL, so unit/integration tests run
// instantly and deterministically.

const MODELS = [
  "role", "adminUser", "auditLog", "category", "region", "city",
  "plan", "user", "professional", "subscription", "payment",
  "verificationRequest", "review", "report", "supportTicket",
  "notification", "legalDocument"
];

function match(obj, where) {
  if (!where || !Object.keys(where).length) return true;
  return Object.entries(where).every(([k, v]) => obj[k] === v);
}

function applyWhere(rows, where) {
  return rows.filter((r) => match(r, where));
}

function applyOrderBy(rows, orderBy) {
  if (!orderBy) return rows;
  const sorters = Array.isArray(orderBy) ? orderBy : [orderBy];
  const sorted = [...rows];
  for (const sort of sorters) {
    const key = Object.keys(sort)[0];
    const dir = sort[key];
    sorted.sort((a, b) => {
      const va = a[key] ?? "";
      const vb = b[key] ?? "";
      return dir === "desc" ? (va > vb ? -1 : va < vb ? 1 : 0) : (va < vb ? -1 : va > vb ? 1 : 0);
    });
  }
  return sorted;
}

class ModelStore {
  constructor() { this.rows = []; this._nextId = 1; }

 findFirst({ where, select } = {}) {
    const row = applyWhere(this.rows, where)[0];
    if (!row) return null;
    return select ? project(row, select) : { ...row };
  }

  findFirstOrThrow(args) {
    const row = this.findFirst(args);
    if (!row) throw new Error("Record not found");
    return row;
  }

  findUnique({ where, select } = {}) {
    return this.findFirst({ where, select });
  }

  findMany({ where, take, skip, orderBy, select } = {}) {
    let rows = applyWhere(this.rows, where);
    rows = applyOrderBy(rows, orderBy);
    if (skip) rows = rows.slice(skip);
    if (take) rows = rows.slice(0, take);
    return rows.map((r) => (select ? project(r, select) : { ...r }));
  }

  create({ data }) {
    const record = { ...data, _id: this._nextId++ };
    this.rows.push(record);
    return { ...record };
  }

  createMany({ data: items }) {
    for (const item of items) this.create({ data: item });
  }

  update({ where, data }) {
    const idx = this.rows.findIndex((r) => match(r, where));
    if (idx === -1) throw new Error(`Record not found for update`);
    const existing = this.rows[idx];
    const merged = { ...existing, ...data, _id: existing._id };
    this.rows[idx] = merged;
    return { ...merged };
  }

  updateMany({ where, data }) {
    let count = 0;
    for (let i = 0; i < this.rows.length; i++) {
      if (match(this.rows[i], where)) {
        this.rows[i] = { ...this.rows[i], ...data };
        count++;
      }
    }
    return { count };
  }

  delete({ where }) {
    const idx = this.rows.findIndex((r) => match(r, where));
    if (idx === -1) throw new Error(`Record not found for delete`);
    const [removed] = this.rows.splice(idx, 1);
    return removed;
  }

  deleteMany({ where }) {
    let count = 0;
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (match(this.rows[i], where)) { this.rows.splice(i, 1); count++; }
    }
    return { count };
  }

  count({ where } = {}) {
    return applyWhere(this.rows, where).length;
  }

  upsert({ where, create, update }) {
    const existing = this.findFirst({ where });
    if (existing) return this.update({ where, data: update });
    return this.create({ data: { ...where, ...create } });
  }

  // Seed helper
  seed(items) { for (const item of items) this.rows.push({ ...item }); }
  clear() { this.rows = []; }
}

function project(row, select) {
  if (typeof select === "object") {
    const out = {};
    for (const [k, v] of Object.entries(select)) { if (v) out[k] = row[k]; }
    return out;
  }
  return { ...row };
}

function createInMemoryDb(seed = {}) {
  const db = {};
  for (const model of MODELS) {
    const store = new ModelStore();
    if (Array.isArray(seed[model])) store.seed(seed[model]);
    db[model] = store;
  }
  return db;
}

module.exports = { createInMemoryDb, ModelStore };