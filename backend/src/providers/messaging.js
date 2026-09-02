// MessagingProvider abstraction (req 41) — INTERFACE ONLY, NOT IMPLEMENTED.
//
// Future integration point for SMS and WhatsApp Business API messages.
// Deliberately NOT wired into the running application and NOT required today.
//
// IMPORTANT — current WhatsApp usage does NOT change: today WhatsApp is used
// ONLY as a manual outbound link on the public site / payment pages
// (e.g. "send your transfer receipt via WhatsApp"). There is no WhatsApp API.
// This interface would only apply if we later automate messages through the
// WhatsApp Business API or an SMS gateway.

/**
 * MessagingProvider interface (future integration point).
 * @typedef {Object} MessagingProvider
 * @property {string} name          - e.g. "whatsapp_business" | "sms_twilio" | "sms_clickatell"
 * @property {function} send         - send a text message to a phone number
 * @property {function} sendTemplate - send a pre-approved WhatsApp template
 * @property {function} webhookHandler - verify + route inbound message events
 */

const NOT_IMPLEMENTED = () => {
  throw new Error("MessagingProvider is an interface only — no provider configured yet (req 41).");
};

const MessagingProvider = {
  name: "unconfigured",
  /** @param {{to:string, body:string}} _message */
  send: NOT_IMPLEMENTED,
  /** @param {{to:string, templateName:string, vars?:Object}} _template */
  sendTemplate: NOT_IMPLEMENTED,
  /** @param {Object} _payload @param {Object} _headers */
  webhookHandler: NOT_IMPLEMENTED
};

module.exports = { MessagingProvider, NOT_IMPLEMENTED };
