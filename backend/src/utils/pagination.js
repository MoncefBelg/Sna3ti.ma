// Shared pagination helper. Returns { skip, take, page, pageSize } plus a
// serializer that produces a stable list envelope for every paginated route.

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 500;

function parsePagination(query = {}) {
  let page = parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE;

  let pageSize = parseInt(query.pageSize, 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function paginatedEnvelope(items, total, pagination) {
  const { page, pageSize } = pagination;
  return {
    data: items,
    meta: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
    }
  };
}

module.exports = { parsePagination, paginatedEnvelope, DEFAULT_PAGE_SIZE };