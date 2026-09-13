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
