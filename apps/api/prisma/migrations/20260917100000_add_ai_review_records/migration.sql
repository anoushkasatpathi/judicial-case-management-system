CREATE TABLE "AiPrioritySuggestion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "case_id" UUID NOT NULL, "urgency_class" TEXT NOT NULL,
  "rationale" TEXT NOT NULL, "flagged_factors" JSONB NOT NULL, "suggested_weight_delta" INTEGER NOT NULL,
  "prompt_version" TEXT NOT NULL, "model" TEXT NOT NULL, "human_final_score" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AiPrioritySuggestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiDraftOrder" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "hearing_id" UUID NOT NULL, "draft" JSONB NOT NULL,
  "label" TEXT NOT NULL, "prompt_version" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at" TIMESTAMP(3), CONSTRAINT "AiDraftOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiPrioritySuggestion_case_id_created_at_idx" ON "AiPrioritySuggestion"("case_id", "created_at");
CREATE INDEX "AiDraftOrder_hearing_id_created_at_idx" ON "AiDraftOrder"("hearing_id", "created_at");
ALTER TABLE "AiPrioritySuggestion" ADD CONSTRAINT "AiPrioritySuggestion_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiDraftOrder" ADD CONSTRAINT "AiDraftOrder_hearing_id_fkey" FOREIGN KEY ("hearing_id") REFERENCES "Hearing"("id") ON DELETE CASCADE ON UPDATE CASCADE;