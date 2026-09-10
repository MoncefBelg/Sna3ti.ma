# Sna3ti.ma — Backend Foundation

Express + PostgreSQL (Prisma) REST API designed to replace the in-browser
`Sna3tiData` mock facade once integrated. It mirrors the exact business rules,
opaque-ID policy, RBAC matrix, and Scenario A–E invariants of the frontend —
without touching a single frontend file.

## Stack

- **Node.js / Express 4**
- **PostgreSQL via Prisma ORM**
- **JWT + bcrypt** for admin authentication (HTTP-only, role-encoded)
- **`createApp({ db })` dependency injection** — production uses the Prisma
  client; tests inject an in-memory adapter, so the suite runs with no database.

## Quick start (development)

```bash
npm install
npx prisma generate
cp .env.example .env        # set DATABASE_URL, JWT_SECRET
npm run db:migrate          # create schema
npm run db:seed             # roles, plans, categories, regions, admin users
npm run dev
```

## Running the test suite (no database required)

```bash
npm test
```

The suite covers:
- **Scenario A** — identity verification grants badge; plan approval activates
  the subscription; plan approval never grants the verified badge.
- **Scenario B** — payment confirmation activates the plan, badge unchanged.
- **Scenario C** — verification rejection with mandatory reason + audit trail.
- **Scenario D** — professional suspension + audit trail.
- **Scenario E** — RBAC enforcement per role.
- **REQ 58** — billing transaction ledger, server-authoritative payment
  creation, proof sanitization, atomic/idempotent confirmation, renewal append,
  expired/cancelled relabeling, read-only admin endpoints, summary aggregates.
- **WhatsApp trust chain** — contact tracking, 10-min dedup, confirmation
  ownership, 48h eligibility gate, one-review-per-interaction, risk-scored
  auto-moderation (LOW→CRITICAL), admin dashboard RBAC, opaque `INT-` ids.
- Auth (401), 404 handling, public catalog, audit-trace completeness.

## Architecture

```
src/
  config/        env validation, Prisma client singleton
  constants/     roles + permission matrix, plans, statuses, ID prefixes
  utils/         AppError, asyncHandler, id, pagination, logger
  validators/    dependency-free request validation
  repositories/  generic CRUD base + domain repos (Prisma or in-memory)
  services/      business logic (verification, payment, subscription, …)
  billingTransactionService.js  read-only ledger + summary
  billingAccess.js              listScope helper
  controllers/   thin HTTP adapters
  middleware/    JWT auth, role→permission guard, error handler
  routes/        auth, public, admin/*
  app.js         createApp({ db }) — DI composition root
  server.js      Prisma connect + listen + graceful shutdown
prisma/
  schema.prisma  models + enums
  seed.js        idempotent seed data
tests/
  app.test.js    end-to-end API + business-rule scenarios
  rbac.test.js   permission enforcement
  req58-billing.test.js  REQ 58 ledger / billing payment flow / summary
  inMemoryDb.js  Prisma-compatible offline adapter
```

## Key business rules (invariant)

- **Badge independence**: identity/professionnel verification grants the
  verified badge and never touches the subscription.
- **Payment ↔ plan**: confirming a payment activates the requested plan and
  closes the linked verification request; it never grants the verified badge.
- **Plan activation**: approving a *plan-level* verification request activates
  the subscription (Scenario A) and pushes a "Plan activé" history entry.
- **ID policy**: all IDs are opaque strings (`PRO-10295`, `PAY-7004`,
  `INT-10001`). Never `parseInt` them; the backend issues the same style via
  `makeId(prefix)`.
- **Audit trail**: every state change is logged with actor, action, entity and
  result.

## Registration → Approval → Publication → Verification → Formula

Four distinct concepts are deliberately NOT collapsed into one status:

| Concept | Lives on | Values | Set by |
|---|---|---|---|
| **Application approved** | `ProfessionalRequest.status` | `pending` / `approved` / `rejected` | Admin approve/reject (`POST /admin/professional-requests/:id/approve`) |
| **Marketplace active** | `Professional.status` | `pending` / `active` / `suspended` | Admin activate/suspend (`POST /admin/professionals/:id/activate`) |
| **Verified identity / profession** | `Professional.verificationStatus` + `verified` (+ `identityStatus` / `professionStatus`) | `pending` / `approved` / `verified` / `rejected`; `verified` boolean | Independent verification workflow (`VerificationRequest`), NEVER by approval or payment |
| **Commercial formula (package)** | `Professional.package` + `subscriptionStatus` | `free` / `verified` / `gold` | Only an ACTIVE, confirmed subscription (`subscriptionService`) |

The marketplace's visibility rule is a single one, backend-enforced: **only
`Professional.status = "active"` rows are listed/searched publicly** (see
`searchService`). Verification and formula never gate visibility — a freshly
approved-and-activated FREE account is publicly visible immediately.

**Approval (REQ 56 + REQ 57-A)** does three things and three things only:
1. Marks the request `approved` and links it (`professionalId`, ARQ→PRO).
2. Materialises exactly ONE Professional with `status: "pending"` — never
   published automatically.
3. Always starts the account on **FREE** (`package: "free"`,
   `subscriptionStatus: "none"`, no subscription row). The applicant's chosen
   formula stays traceable on the REQUEST (`planCode` / `planName` /
   `planPrice`) and is never applied to the professional at registration.

**Consequence for an application carrying `Formule: Vérifié` (e.g. ARQ-10003):
until the professional (a) completes the separate identity/profession
verification AND (b) pays for and receives the confirmed VÉRIFIÉ subscription,
the professional record intentionally remains `verificationStatus: "pending"`,
`verified: false`, `package: "free"` — while already being `status: "active"`
and publicly listed.** Approving the application and activating the marketplace
listing NEVER grants the badge or the paid package. This is enforced by the
`/professionals` public contract and locked by tests
(`tests/registration-lifecycle.test.js`, `tests/admin-verifications.test.js`,
`tests/admin-subscriptions.test.js`, `tests/admin-payments.test.js`).

## WhatsApp Interaction + Review Trust System

Authenticated contact tracking feeds a server-authoritative review trust chain.
Nothing from the review/eligibility pipeline is ever trusted from the client.

```
Platform User → POST /professionals/:id/contact (WHATSAPP)
            → POST /professionals/:id/contact/confirm { confirmed: true }
            → GET  /professionals/:id/contact/eligibility
            → POST /professionals/:id/reviews        (one, after 48h)
            → review published | flagged  → visible on GET /professionals/:id/reviews
```

Endpoints:

- `POST /professionals/:id/contact` — requires a JWT (`user` role). Dedups per
  customer+professional (10 min window), evaluates a server-side risk score,
  stores metadata only (channel/source/outcome) — never WhatsApp content.
- `POST /professionals/:id/contact/confirm` — customer confirms the contact
  happened and (optionally) reports the service outcome
  (`customerReportedService`: `yes` | `no` | `in_progress`).
- `GET /professionals/:id/contact/eligibility` — server-derived: interaction
  exists, WHATSAPP channel, confirmed, review window open (48h cooldown after
  the last genuine contact), no review yet.
- `POST /professionals/:id/reviews` — now requires a platform `User` (admin
  tokens → 403). One review max per customer+professional; `flagged` when the
  computed risk is HIGH/CRITICAL (excluded from the rating recompute).
- `GET /admin/interactions` · `GET /admin/interactions/:id` — moderation
  dashboard (permission `interactions.view`: `super_admin`, `admin`,
  `moderator`; NOT `finance`/`support`).

Invariants:

- **Eligibility is derived, never client-provided** (`customerId`,
  `professionalId`, `riskScore`, `reviewStatus`, `verifiedContact`).
- `reviewEligibleAt` = last confirmed contact + 48h. Anonymous contacts can't
  lead to reviews.
- Rate limiters: `contactLimiter` (60/15 min) and `reviewLimiter` (20/15 min)
  in production; throttling is relaxed under `NODE_ENV=test`.
- Public reviews expose `verifiedContact` (normal WhatsApp contact → badge
  "Contact via Sna3ti"; a completed Sna3ti Match adds "Service vérifié").

## Billing Transaction Ledger (REQ 58)

Billing transactions form an **immutable, append-only** record of every paid
period a professional has owned. It is the server-side source of truth for
confirmations and renewals; nothing in it can be edited or deleted.

```
Payment confirmed (REQ 58-D)   → append BillingTransaction (activation/free skip)
Subscription renewed           → append BillingTransaction (renewal)
Period/cancellation relabel    → BillingTransaction.updateStatus (status only)
```

Endpoints (read-only):

- `GET /admin/billing-transactions` — paginated ledger with filter
  (`professionalId`, `plan`, `type`, `status`, `from`, `to`, `search`) and
  server-side paging (`page`, `limit ≤ 100`). Gated `payments.view`
  (`super_admin`, `admin`, `finance`).
- `GET /admin/billing-transactions/summary` — REQ 58-K lightweight reporting:
  confirmed revenue + counts from the immutable ledger (status `active`), plus
  pending/rejected figures from the payment workflow. Deliberately NOT
  accounting/tax software.

Invariants pursued:

- **Server-authoritative creation**: plan name, amount and currency are derived
  from the plan catalog on the server, never accepted from the client; plan is
  validated (400 unknown / mismatch).
- **One BillingTransaction per confirmed payment** (`paymentId` is `@unique`): a
  double/subsequent confirm of the same payment is rejected with 409 and never
  creates a second ledger row.
- **Atomicity**: activation + verification close + ledger append run inside a
  single `$transaction` (repos-level `$transaction` + Prisma
  `$transaction`); any failure rolls back all three — the in-memory adapter
  mirrors the snapshot/rollback semantics under test.
- **Dedupe is idempotent**: a duplicate pending payment for the same
  professional+plan returns the existing pending payment (no orphan rows).
- **Immutable ledger**: only `updateStatus` (relabeling) exists; no
  update/delete route, repository method, or UI action.

## Environment variables

See `.env.example`. `DATABASE_URL` and `JWT_SECRET` are mandatory. In
`NODE_ENV=test` sensible defaults are used so the test suite needs no real
PostgreSQL.
