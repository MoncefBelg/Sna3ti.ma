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

## Environment variables

See `.env.example`. `DATABASE_URL` and `JWT_SECRET` are mandatory. In
`NODE_ENV=test` sensible defaults are used so the test suite needs no real
PostgreSQL.
