// EmailProvider abstraction (req 41) — INTERFACE ONLY, NOT IMPLEMENTED.
//
// Future integration point for a production transactional email provider
// (e.g. Postmark, Amazon SES, SendGrid, Resend). Deliberately NOT wired into
// the running application and NOT required today. The backend does not send
// any email yet.

/**
 * EmailProvider interface (future integration point).
 * @typedef {Object} EmailProvider
 * @property {string} name                - e.g. "postmark" | "ses" | "resend"
 * @property {function} sendTemplated     - send a templated transactional email
 * @property {function} sendRaw           - send a raw email
 * @property {function} verifyFromDomain   - add a from-domain / verify sender
 */

const NOT_IMPLEMENTED = () => {
  throw new Error("EmailProvider is an interface only — no provider configured yet (req 41).");
};

const EmailProvider = {
  name: "unconfigured",
  /** @param {{to:string|string[], templateName:string, vars?:Object, from?:string}} _mail */
  sendTemplated: NOT_IMPLEMENTED,
  /** @param {{to:string|string[], subject:string, html?:string, text?:string}} _mail */
  sendRaw: NOT_IMPLEMENTED,
  /** @param {string} _domain */
  verifyFromDomain: NOT_IMPLEMENTED
};

module.exports = { EmailProvider, NOT_IMPLEMENTED };
