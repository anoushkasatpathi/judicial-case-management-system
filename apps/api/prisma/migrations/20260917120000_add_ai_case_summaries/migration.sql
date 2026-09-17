CREATE TABLE "AiCaseSummary" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "case_id" UUID NOT NULL,
  "summary" JSONB NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiCaseSummary_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiCaseSummary_case_id_created_at_idx" ON "AiCaseSummary"("case_id", "created_at");
ALTER TABLE "AiCaseSummary" ADD CONSTRAINT "AiCaseSummary_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;