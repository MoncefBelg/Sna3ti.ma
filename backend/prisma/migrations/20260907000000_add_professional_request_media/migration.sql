-- Professional request media (REQ 53): profile photo + work-sample photos/videos.
-- Files bytes live in the storage backend; this column stores the media metadata
-- array [{ id, kind, type, label, fileUrl, key, mimeType, size, added }].

-- AlterTable
ALTER TABLE "ProfessionalRequest" ADD COLUMN "media" JSONB NOT NULL DEFAULT '[]';