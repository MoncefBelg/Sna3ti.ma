const { asyncHandler } = require("../utils/asyncHandler");
const { ok, created } = require("../utils/respond");

// Contact interaction API (WhatsApp Interaction + Review Trust System).
// Recording a contact NEVER blocks or alters the WhatsApp handoff on the
// frontend — it is a best-effort, backend-authoritative metadata record.
function createInteractionController(services) {
  return {
    // POST /professionals/:id/contact — record an interaction for the actor.
    record: asyncHandler(async (req, res) => {
      const { interaction, created: isNew } = await services.interactions.record(req.params.id, {
        actor: req.admin,
        channel: req.body && req.body.channel,
        source: req.body && req.body.source
      });
      const payload = { data: interaction, repeated: !isNew };
      if (isNew) return created(res, payload);
      return ok(res, payload);
    }),

    // POST /professionals/:id/contact/confirm — customer confirmation.
    confirm: asyncHandler(async (req, res) => {
      const data = await services.interactions.confirm(req.params.id, {
        actor: req.admin,
        confirmed: (req.body || {}).confirmed,
        serviceStatus: (req.body || {}).serviceStatus
      });
      ok(res, { data });
    }),

    // GET /professionals/:id/contact/eligibility — is this customer allowed
    // to review this professional right now?
    myEligibility: asyncHandler(async (req, res) => {
      const data = await services.interactions.myEligibility(req.params.id, req.admin);
      ok(res, { data });
    }),

    // Admin — GET /admin/interactions — dashboard list.
    list: asyncHandler(async (req, res) => {
      const data = await services.interactions.list();
      ok(res, { data });
    }),

    // Admin — GET /admin/interactions/:id
    get: asyncHandler(async (req, res) => {
      const data = await services.interactions.get(req.params.id);
      ok(res, { data });
    })
  };
}

module.exports = { createInteractionController };