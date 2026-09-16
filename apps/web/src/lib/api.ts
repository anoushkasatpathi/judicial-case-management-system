import type { CaseStatus, UserRole } from '@justiq/shared-types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
let accessToken: string | undefined
let refreshToken: string | undefined

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  courtId?: string
}

export function setTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken
  refreshToken = tokens.refreshToken
}

export function clearTokens() {
  accessToken = undefined
  refreshToken = undefined
}

export function getAccessToken() {
  return accessToken
}

export async function login(email: string, password: string) {
  const result = await request<{ accessToken: string; refreshToken: string }>('/api/auth/login', { method: 'POST', body: { email, password } }, false)
  setTokens(result)
  return decodeSession(result.accessToken)
}

export async function logout() {
  if (refreshToken) await request('/api/auth/logout', { method: 'POST', body: { refreshToken } }, false).catch(() => undefined)
  clearTokens()
}

function decodeSession(token: string): SessionUser {
  const payload = JSON.parse(atob(token.split('.')[1])) as { sub: string; email: string; role: UserRole; courtId?: string }
  return { id: payload.sub, email: payload.email, role: payload.role, courtId: payload.courtId }
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (response.status === 401 && retry && refreshToken) {
    const refreshed = await request<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', { method: 'POST', body: { refreshToken } }, false)
    setTokens(refreshed)
    return request<T>(path, options, false)
  }
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? `Request failed (${response.status})`)
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  cases: (params = '') => request<{ items: CaseRecord[]; total: number }>(`/api/cases${params}`),
  case: (id: string) => request<CaseRecord>(`/api/cases/${id}`),
  createCase: (body: unknown) => request<CaseRecord>('/api/cases', { method: 'POST', body }),
  status: (id: string, status: CaseStatus) => request<CaseRecord>(`/api/cases/${id}/status`, { method: 'PATCH', body: { status } }),
  notes: (id: string, bench_notes: string) => request<CaseRecord>(`/api/cases/${id}/notes`, { method: 'PATCH', body: { bench_notes } }),
  queue: (courtId: string) => request<CaseRecord[]>(`/api/courts/${courtId}/queue`),
  reorder: (courtId: string, caseIds: string[], reason: string) => request(`/api/courts/${courtId}/queue/reorder`, { method: 'POST', body: { caseIds, reason } }),
  hearings: (caseId: string) => request<CaseRecord>(`/api/cases/${caseId}`).then((item) => item.hearings ?? []),
  triage: (id: string) => request(`/api/cases/${id}/emergency/triage`, { method: 'POST' }),
  acceptEmergency: (id: string) => request(`/api/cases/${id}/emergency/accept`, { method: 'POST' }),
  emergencyCases: () => request<{ items: CaseRecord[] }>('/api/cases?status=Filed&limit=100'),
  causeList: (court: string, date: string) => request<CauseEntry[]>(`/api/public/cause-list?court=${encodeURIComponent(court)}&date=${encodeURIComponent(date)}`),
  caseStatus: (caseNumber: string) => request<CaseRecord>(`/api/public/case-status?caseNumber=${encodeURIComponent(caseNumber)}`),
}

export interface Party { name: string; role: string; contact_info?: string }
export interface HearingRecord { id: string; scheduled_at: string; status: string; courtroom_id?: string; courtroom?: { room_number: string }; next_hearing_date?: string }
export interface CaseRecord { id: string; case_number: string; case_type: string; status: string; emergency_status?: string; priority_score: number; is_emergency: boolean; filed_at: string; bench_notes?: string; parties?: Party[]; hearings?: HearingRecord[]; court?: { name: string; location?: string } }
export interface CauseEntry { hearingId: string; scheduledAt: string; hearingStatus: string; courtroom: string; judgeDesignation: string; case: { case_number: string; case_type: string; status: string; parties: Array<{ name: string; role: string }> } }