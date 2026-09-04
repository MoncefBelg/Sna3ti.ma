// Concrete WhatsApp provider for Sna3ti Match (req NEW).
//
// IMPORTANT ARCHITECTURE: WhatsApp is a NOTIFICATION CHANNEL ONLY. The match
// request is always persisted to PostgreSQL FIRST (source of truth). A
// WhatsApp failure NEVER blocks or fails the request — it just flips the
// stored `notificationStatus.whatsapp` to "failed" / "pending" so an admin
// can retry from the dashboard.
//
// When a WhatsApp Business API endpoint + token are configured in env, this
// provider posts the lead through the real API. Otherwise it returns a
// "pending" status (no configured provider) and the admin dashboard can still
// copy/retry later. Nothing here throws in a way that affects request saving.

const env = require("../config/env");

const whatsapp = env.whatsapp || {};

// Compose a human-readable lead message sent to the business line.
function buildLeadMessage(req) {
  const lines = [
    "⭐ Sna3ti Match — Nouvelle demande de mise en relation",
    "----------------------------------------",
    `Nom: ${req.name}`,
    `Téléphone: ${req.phone}`,
    req.whatsapp ? `WhatsApp: ${req.whatsapp}` : "",
    `Ville: ${req.city}`,
    req.area ? `Quartier: ${req.area}` : "",
    `Service: ${req.service}`,
    req.otherService ? `Autre service: ${req.otherService}` : "",
    req.description ? `Description: ${req.description}` : "",
    req.preferredDate ? `Date souhaitée: ${new Date(req.preferredDate).toLocaleDateString("fr-FR")}` : "",
    `Contact préféré: ${req.preferredContact}`,
    `Demande: ${req.id}`,
    `Gérer dans l'admin: /#/admin/match-requests/${req.id}`
  ].filter(Boolean);
  return lines.join("\n");
}

// POST one message via the WhatsApp Business HTTP API (configurable). Resolves
// to { status: "sent" } on 2xx, { status: "failed" } otherwise.
async function httpSend(to, body) {
  const url = whatsapp.apiUrl;
  const token = whatsapp.apiToken;
  if (!url || !token) return { status: "pending" };

  const payload = {
    to: to || whatsapp.businessPhone || "",
    type: "text",
    text: { body }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  return res.ok ? { status: "sent" } : { status: "failed" };
}

// Send a "new match request" lead to the business WhatsApp line.
// Always resolves (never treats transport failure as a request failure).
async function sendMatchLead(request) {
  try {
    const body = buildLeadMessage(request);
    const to = whatsapp.businessPhone || whatsapp.defaultRecipient || "";
    const result = await httpSend(to, body);
    return { whatsapp: result.status };
  } catch (err) {
    // Transport/config error — never fail the request; mark for admin retry.
    return { whatsapp: "failed" };
  }
}

module.exports = { sendMatchLead, buildLeadMessage, httpSend };
