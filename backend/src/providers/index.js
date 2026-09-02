// Provider interface barrel (req 41) — INTERFACES ONLY, NOT IMPLEMENTED.
//
// These are clean abstraction points for future 3rd-party integrations.
// Per the requirements they are NOT implemented and NOT required now:
//   - Stripe / PayPal / card payments
//   - OpenAI / Claude AI
//   - SMS / WhatsApp Business API (message automation)
//   - production transactional email
//
// Nothing here is wired into the running application. The current payment
// flow (Moroccan bank transfer + manual WhatsApp receipt link) is unchanged.
//
// To integrate a provider later, implement its interface and register it in
// the services layer — no controller or route needs to change.

const { PaymentProvider } = require("./payment");
const { AIProvider } = require("./ai");
const { MessagingProvider } = require("./messaging");
const { EmailProvider } = require("./email");

// All interfaces in one place for discoverability. All methods throw
// "interface only" errors until a concrete provider is implemented.
const providers = {
  payment: PaymentProvider,
  ai: AIProvider,
  messaging: MessagingProvider,
  email: EmailProvider
};

module.exports = { providers, PaymentProvider, AIProvider, MessagingProvider, EmailProvider };
