CREATE TYPE "EmergencyWorkflowStatus" AS ENUM ('FiledEmergency', 'RegistrarTriage', 'JudgeAcceptance', 'SlotInjection', 'NotificationFanout');

ALTER TABLE "Case" ADD COLUMN "emergency_status" "EmergencyWorkflowStatus";