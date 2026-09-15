ALTER TABLE "Document" ADD COLUMN "filename" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Document" ALTER COLUMN "filename" DROP DEFAULT;

CREATE INDEX "Document_case_id_filename_version_idx" ON "Document"("case_id", "filename", "version");