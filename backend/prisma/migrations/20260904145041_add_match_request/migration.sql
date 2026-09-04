-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('new', 'reviewing', 'artisan_contacted', 'price_received', 'price_sent', 'customer_accepted', 'customer_rejected', 'matched', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "subscriptionExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MatchRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "service" TEXT NOT NULL,
    "otherService" TEXT,
    "description" TEXT,
    "preferredContact" TEXT NOT NULL DEFAULT 'both',
    "preferredDate" TIMESTAMP(3),
    "status" "MatchStatus" NOT NULL DEFAULT 'new',
    "artisanName" TEXT,
    "artisanPhone" TEXT,
    "notificationStatus" JSONB NOT NULL DEFAULT '{}',
    "artisanPrice" INTEGER,
    "customerPrice" INTEGER,
    "commission" INTEGER,
    "adminNote" TEXT,
    "whatsappRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPhoto" (
    "id" TEXT NOT NULL,
    "matchRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchRequest_status_idx" ON "MatchRequest"("status");

-- CreateIndex
CREATE INDEX "MatchRequest_createdAt_idx" ON "MatchRequest"("createdAt");

-- CreateIndex
CREATE INDEX "MatchPhoto_matchRequestId_idx" ON "MatchPhoto"("matchRequestId");

-- AddForeignKey
ALTER TABLE "MatchPhoto" ADD CONSTRAINT "MatchPhoto_matchRequestId_fkey" FOREIGN KEY ("matchRequestId") REFERENCES "MatchRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
