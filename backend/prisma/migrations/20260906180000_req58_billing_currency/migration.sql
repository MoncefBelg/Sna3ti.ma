-- REQ 58 — manual bank-transfer billing hardening + immutable financial history.
--
-- Scope of THIS migration (intentionally minimal):
--   * Payment gains server-authoritative `currency` (REQ 58-A) and
--     proof-submission metadata `proofSubmittedAt` / `proofNote` (REQ 58-C).
--   * New append-only `BillingTransaction` table + enums (REQ 58-D).
--   * No unrelated drift is included: pre-existing schema-vs-DB drift for the
--     Review / ProfessionalContactInteraction models is intentionally left alone.

-- CreateEnum
CREATE TYPE "BillingTransactionType" AS ENUM ('activation', 'renewal');

-- CreateEnum
CREATE TYPE "BillingTransactionStatus" AS ENUM ('active', 'expired', 'cancelled');

-- AlterTable
ALTER TABLE "Payment"
  ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'MAD',
  ADD COLUMN     "proofNote" TEXT,
  ADD COLUMN     "proofSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BillingTransaction" (
    "id" TEXT NOT NULL,
    "type" "BillingTransactionType" NOT NULL,
    "professionalId" TEXT NOT NULL,
    "paymentId" TEXT,
    "subscriptionId" TEXT NOT NULL,
    "planId" TEXT,
    "planName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "periodStartAt" TIMESTAMP(3) NOT NULL,
    "periodEndAt" TIMESTAMP(3) NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "status" "BillingTransactionStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingTransaction_paymentId_key" ON "BillingTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "BillingTransaction_professionalId_idx" ON "BillingTransaction"("professionalId");

-- CreateIndex
CREATE INDEX "BillingTransaction_planId_idx" ON "BillingTransaction"("planId");

-- CreateIndex
CREATE INDEX "BillingTransaction_status_idx" ON "BillingTransaction"("status");

-- CreateIndex
CREATE INDEX "BillingTransaction_createdAt_idx" ON "BillingTransaction"("createdAt");