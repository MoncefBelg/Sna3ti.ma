-- REQ 56 -- link an approved registration to the Professional it created.
-- Approval now materialises exactly one PENDING Professional (never published
-- automatically) and persists the ARQ->PRO reference on the request for
-- traceability. Indexed (not unique): one request maps to one professional,
-- but a professional id always appears on a single request.

-- AlterTable
ALTER TABLE "ProfessionalRequest" ADD COLUMN "professionalId" TEXT;

-- CreateIndex
CREATE INDEX "ProfessionalRequest_professionalId_idx" ON "ProfessionalRequest"("professionalId");