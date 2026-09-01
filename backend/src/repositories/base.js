// Generic repository factory. Every entity-specific repository can be
// assembled from these primitives plus a handful of custom queries
// that live in its own file.

function createGenericRepository(model, db) {
  if (typeof model !== "string") throw new TypeError("model must be a string");
  if (!db || !db[model]) throw new TypeError("db must expose db[model]");

  async function list(where = {}, { take, skip, orderBy, select } = {}) {
    const args = {};
    if (where && Object.keys(where).length) args.where = where;
    if (take) args.take = take;
    if (skip) args.skip = skip;
    if (orderBy) args.orderBy = orderBy;
    if (select) args.select = select;
    return db[model].findMany(args);
  }

  async function get(id) {
    return db[model].findFirst({ where: { id } });
  }

  async function find(where) {
    return db[model].findFirst({ where });
  }

  async function findMany(where = {}, opts = {}) {
    return list(where, opts);
  }

  async function create(data) {
    return db[model].create({ data });
  }

  async function update(id, data) {
    return db[model].update({ where: { id }, data });
  }

  async function remove(id) {
    return db[model].delete({ where: { id } });
  }

  async function count(where = {}) {
    return db[model].count(Object.keys(where).length ? { where } : undefined);
  }

  return { model, list, get, find, findMany, create, update, remove, count };
}

module.exports = { createGenericRepository };