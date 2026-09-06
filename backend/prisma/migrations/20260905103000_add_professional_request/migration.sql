-- Account-free artisan onboarding requests (REQ 53 — intake).

-- CreateEnum
CREATE TYPE "ProfessionalRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "ProfessionalRequest" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "otherService" TEXT,
    "city" TEXT NOT NULL,
    "cityLabel" TEXT,
    "description" TEXT,
    "price" INTEGER,
    "priceUnit" TEXT,
    "planId" TEXT,
    "planCode" TEXT,
    "planName" TEXT,
    "planPrice" INTEGER,
    "status" "ProfessionalRequestStatus" NOT NULL DEFAULT 'pending',
    "notificationStatus" JSONB NOT NULL DEFAULT '{}',
    "whatsappRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfessionalRequest_status_idx" ON "ProfessionalRequest"("status");

-- CreateIndex
CREATE INDEX "ProfessionalRequest_phone_idx" ON "ProfessionalRequest"("phone");

-- CreateIndex
CREATE INDEX "ProfessionalRequest_createdAt_idx" ON "ProfessionalRequest"("createdAt");