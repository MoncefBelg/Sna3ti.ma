// Sequence-backed opaque-ID generation.
//
// Ids follow the Sna3ti frontend format (PRO-10001, USR-10001, PAY-7004, ...)
// and are STRICTLY opaque strings — consumers must never parseInt/Number/+id
// them. Values are generated server-side from a per-prefix counter that is
// monotonic and never reused, so generated ids survive record deletion and are
// never derived from the current row count or array length.
//
// The counter lives in the `IdSequence` table in production (backed by the
// injected db) and in the in-memory adapter during tests. `nextId` upserts the
// per-prefix sequence with an atomic increment.

const { ID_PREFIXES } = require("../constants/statuses");

function createIdSequenceRepo(db) {
  async function nextValue(prefix) {
    const base = ID_PREFIXES[prefix] || String(prefix).toUpperCase();
    const seq = await db.idSequence.upsert({
      where: { prefix: base },
      create: { prefix: base, value: 10001 },
      update: { value: { increment: 1 } }
    });
    // PostgreSQL returns the row already incremented; the in-memory adapter
    // does the same. `value` is the *next* number to hand out.
    return seq.value;
  }

  // Returns a fresh opaque id like "PRO-10003".
  async function nextId(prefix) {
    const base = ID_PREFIXES[prefix] || String(prefix).toUpperCase();
    const value = await nextValue(prefix);
    return `${base}-${value}`;
  }

  return { nextId, nextValue };
}

module.exports = { createIdSequenceRepo };
