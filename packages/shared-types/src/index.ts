export type UserRole = 'Judge' | 'Advocate' | 'Registrar' | 'Admin' | 'Public'

export type CaseStatus =
  | 'Filed'
  | 'Verification'
  | 'Returned'
  | 'Listed'
  | 'Heard'
  | 'Disposed'

export interface AIPrioritySuggestion {
  urgency_class: 'high' | 'medium' | 'low'
  rationale: string
  flagged_factors: string[]
  suggested_weight_delta: number
}

export interface QueueUpdatedEvent {
  courtId: string
  caseIds: string[]
  updatedAt: string
}

export interface HearingScheduledEvent {
  hearingId: string
  caseId: string
  courtroomId: string
  judgeId: string
  scheduledAt: string
}

export interface EmergencyAlertEvent {
  caseId: string
  caseNumber: string
  courtId: string
  reason: string
  alertedAt: string
}

export interface DocumentSummary {
  documentId: string
  caseId: string
  docType: 'Petition' | 'Evidence' | 'Order' | 'Affidavit'
  title: string
  version: number
  storageUrl: string
  uploadedAt: string
}
