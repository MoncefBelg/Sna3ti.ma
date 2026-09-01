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
- **ID policy**: all IDs are opaque strings (`PRO-10295`, `PAY-7004`). Never
  `parseInt` them; the backend issues the same style via `makeId(prefix)`.
- **Audit trail**: every state change is logged with actor, action, entity and
  result.

## Environment variables

See `.env.example`. `DATABASE_URL` and `JWT_SECRET` are mandatory. In
`NODE_ENV=test` sensible defaults are used so the test suite needs no real
PostgreSQL.
