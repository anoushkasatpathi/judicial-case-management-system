CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Judge', 'Advocate', 'Registrar', 'Admin', 'Public');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('Filed', 'Verification', 'Returned', 'Listed', 'Heard', 'Disposed');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('Petitioner', 'Respondent');

-- CreateEnum
CREATE TYPE "HearingStatus" AS ENUM ('Scheduled', 'Completed', 'Adjourned', 'Cancelled');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('Petition', 'Evidence', 'Order', 'Affidavit');

-- CreateEnum
CREATE TYPE "VirusScanStatus" AS ENUM ('Pending', 'Clean', 'Infected');

-- CreateEnum
CREATE TYPE "PriorityFactorType" AS ENUM ('Age', 'StatutoryUrgency', 'EmergencyFlag', 'VulnerabilityFlag');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('Email', 'SMS', 'Push');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "bar_council_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "jurisdiction_type" TEXT NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courtroom" (
    "id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "room_number" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "Courtroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Judge" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "designation" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Judge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" UUID NOT NULL,
    "case_number" TEXT NOT NULL,
    "case_type" TEXT NOT NULL,
    "filing_advocate_id" UUID NOT NULL,
    "status" "CaseStatus" NOT NULL,
    "priority_score" INTEGER NOT NULL DEFAULT 0,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "filed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "court_id" UUID NOT NULL,
    "assigned_judge_id" UUID,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PartyRole" NOT NULL,
    "contact_info" TEXT NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hearing" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "courtroom_id" UUID NOT NULL,
    "judge_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "HearingStatus" NOT NULL,
    "order_summary" TEXT,
    "next_hearing_date" TIMESTAMP(3),

    CONSTRAINT "Hearing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "doc_type" "DocumentType" NOT NULL,
    "storage_url" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "virus_scan_status" "VirusScanStatus" NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorityFactor" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "factor_type" "PriorityFactorType" NOT NULL,
    "weight" INTEGER NOT NULL,
    "computed_score" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriorityFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "before_state" JSONB NOT NULL,
    "after_state" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "prev_hash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunk" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "page_number" INTEGER,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Courtroom_court_id_idx" ON "Courtroom"("court_id");

-- CreateIndex
CREATE UNIQUE INDEX "Judge_user_id_key" ON "Judge"("user_id");

-- CreateIndex
CREATE INDEX "Judge_court_id_idx" ON "Judge"("court_id");

-- CreateIndex
CREATE UNIQUE INDEX "Case_case_number_key" ON "Case"("case_number");

-- CreateIndex
CREATE INDEX "Case_case_number_idx" ON "Case"("case_number");

-- CreateIndex
CREATE INDEX "Case_priority_score_idx" ON "Case"("priority_score");

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "Case"("status");

-- CreateIndex
CREATE INDEX "Case_court_id_status_idx" ON "Case"("court_id", "status");

-- CreateIndex
CREATE INDEX "Party_case_id_idx" ON "Party"("case_id");

-- CreateIndex
CREATE INDEX "Hearing_case_id_idx" ON "Hearing"("case_id");

-- CreateIndex
CREATE INDEX "Hearing_courtroom_id_scheduled_at_idx" ON "Hearing"("courtroom_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "Hearing_judge_id_scheduled_at_idx" ON "Hearing"("judge_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "Document_case_id_idx" ON "Document"("case_id");

-- CreateIndex
CREATE INDEX "PriorityFactor_case_id_idx" ON "PriorityFactor"("case_id");

-- CreateIndex
CREATE INDEX "AuditLog_entity_type_entity_id_idx" ON "AuditLog"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "AuditLog_actor_id_idx" ON "AuditLog"("actor_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "Notification_user_id_read_at_idx" ON "Notification"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "Notification_case_id_idx" ON "Notification"("case_id");

-- CreateIndex
CREATE INDEX "document_chunk_document_id_idx" ON "document_chunk"("document_id");

-- CreateIndex
CREATE INDEX "document_chunk_case_id_idx" ON "document_chunk"("case_id");

-- CreateIndex
CREATE INDEX "document_chunk_embedding_ivfflat_idx" ON "document_chunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- AddForeignKey
ALTER TABLE "Courtroom" ADD CONSTRAINT "Courtroom_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Judge" ADD CONSTRAINT "Judge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Judge" ADD CONSTRAINT "Judge_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_filing_advocate_id_fkey" FOREIGN KEY ("filing_advocate_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_assigned_judge_id_fkey" FOREIGN KEY ("assigned_judge_id") REFERENCES "Judge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hearing" ADD CONSTRAINT "Hearing_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hearing" ADD CONSTRAINT "Hearing_courtroom_id_fkey" FOREIGN KEY ("courtroom_id") REFERENCES "Courtroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hearing" ADD CONSTRAINT "Hearing_judge_id_fkey" FOREIGN KEY ("judge_id") REFERENCES "Judge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorityFactor" ADD CONSTRAINT "PriorityFactor_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunk" ADD CONSTRAINT "document_chunk_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunk" ADD CONSTRAINT "document_chunk_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
