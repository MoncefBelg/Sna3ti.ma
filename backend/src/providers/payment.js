// PaymentProvider abstraction (req 41) — INTERFACE ONLY, NOT IMPLEMENTED.
//
// This file defines the contract a payment provider (Stripe, PayPal, card
// processors, etc.) must implement if/when we wire one in. It is deliberately
// NOT wired into the running application and does NOT require any provider
// today.
//
// The current Sna3ti.ma payment flow REMAINS: Moroccan bank transfer
// (method: "bank_transfer") where the professional sends the transfer receipt
// via WhatsApp. None of that changes.

/**
 * PaymentProvider interface (future integration point).
 * @typedef {Object} PaymentProvider
 * @property {string} name          - e.g. "stripe" | "paypal" | "bank_transfer"
 * @property {function} createIntent   - create a payment intent / payment link
 * @property {function} confirm        - confirm a charge
 * @property {function} refund         - issue a refund
 * @property {function} getStatus      - fetch a payment status
 * @property {function} webhookHandler - verify + route a provider webhook
 */

/**
 * Concrete providers (Stripe, PayPal, ...) are intentionally NOT IMPLEMENTED.
 * Adding one later only requires implementing this interface; the service layer
 * never depends on a concrete provider.
 */
const NOT_IMPLEMENTED = () => {
  throw new Error("PaymentProvider is an interface only — no provider configured yet (req 41).");
};

const PaymentProvider = {
  name: "unconfigured",
  /**
   * Create a payment intent (card/PayPal/Stripe checkout session).
   * @param {{amount:number, currency:string, planName?:string, professionalId?:string, metadata?:Object}} _params
   */
  createIntent: NOT_IMPLEMENTED,
  /** Confirm a previously created intent. @param {string} _paymentIntentId */
  confirm: NOT_IMPLEMENTED,
  /** Refund a payment. @param {string} _chargeId @param {number} [_amount] */
  refund: NOT_IMPLEMENTED,
  /** Fetch current payment status. @param {string} _paymentId */
  getStatus: NOT_IMPLEMENTED,
  /** Verify a signature and route a provider webhook event. @param {Object} _payload @param {Object} _headers */
  webhookHandler: NOT_IMPLEMENTED
};

module.exports = { PaymentProvider, NOT_IMPLEMENTED };
