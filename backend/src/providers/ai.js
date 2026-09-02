// AIProvider abstraction (req 41) — INTERFACE ONLY, NOT IMPLEMENTED.
//
// Future integration point for an LLM provider (OpenAI, Claude / Anthropic,
// or a local model). Deliberately NOT wired into the running application.
// No AI feature exists today; this only documents the contract should we
// add e.g. summarised pro descriptions, smart search ranking or moderation.

/**
 * AIProvider interface (future integration point).
 * @typedef {Object} AIProvider
 * @property {string} name          - e.g. "openai" | "claude" | "local"
 * @property {function} complete    - generate text from a prompt
 * @property {function} embed       - produce vector embeddings
 * @property {function} moderate    - mild content-moderation helper
 */

const NOT_IMPLEMENTED = () => {
  throw new Error("AIProvider is an interface only — no provider configured yet (req 41).");
};

const AIProvider = {
  name: "unconfigured",
  /** @param {string} _prompt @param {{maxTokens?:number, temperature?:number}} [_options] */
  complete: NOT_IMPLEMENTED,
  /** @param {string|string[]} _text */
  embed: NOT_IMPLEMENTED,
  /** @param {string} _text */
  moderate: NOT_IMPLEMENTED
};

module.exports = { AIProvider, NOT_IMPLEMENTED };
