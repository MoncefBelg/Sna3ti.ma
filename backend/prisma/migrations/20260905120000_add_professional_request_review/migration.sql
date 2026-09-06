-- Account-free artisan onboarding requests (REQ 54 — admin approval flow).
-- Adds the admin-review fields consumed by the approve/reject endpoints,
-- mirroring the VerificationRequest conventions:
--   reason        : rejection reason (required to reject)
--   reviewedAt    : last admin decision time
--   reviewerId    : admin user id
--   reviewerName  : admin display name
--   history       : append-only decision trail (JSON array)

-- AlterTable
ALTER TABLE "ProfessionalRequest" ADD COLUMN "reason" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewerId" TEXT,
ADD COLUMN "reviewerName" TEXT,
ADD COLUMN "history" JSONB NOT NULL DEFAULT '[]';