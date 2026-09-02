// Consistent success envelope (req 28): each success response carries
// `success: true` and the *same* payload fields the client already expects
// (e.g. `data`, or `data` + `pagination` for lists). Adding `success:true`
// keeps errors and successes visually uniform while preserving field access.

function ok(res, payload, status = 200) {
  return res.status(status).json({ success: true, ...(payload || {}) });
}

function created(res, payload) {
  return ok(res, payload, 201);
}

module.exports = { ok, created };
