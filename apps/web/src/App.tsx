import { useState } from 'react'
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, FilePlus2, Gavel, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { useCourtSocket } from './hooks/useCourtSocket'
import { api, getAccessToken, type CaseRecord } from './lib/api'
import { queryClient } from './lib/query'
import { useAuth } from './state/auth'
import { EmergencyTriage, QueueReorder } from './components/PortalControls'
import './App.css'

const nav = [
  { path: '/judge', label: 'Judge dashboard', roles: ['Judge'], icon: Gavel },
  { path: '/registrar', label: 'Registrar console', roles: ['Registrar', 'Admin'], icon: ShieldCheck },
  { path: '/advocate', label: 'Advocate workspace', roles: ['Advocate'], icon: FilePlus2 },
]

function App() {
  return <BrowserRouter><QueryClientProvider client={queryClient}><Routes><Route path="/public" element={<PublicPortal />} /><Route path="/login" element={<Login />} /><Route path="*" element={<ProtectedApp />} /></Routes></QueryClientProvider></BrowserRouter>
}

function ProtectedApp() {
  const user = useAuth((state) => state.user)
  if (!user) return <Navigate to="/login" replace />
  return <Shell><Routes><Route path="/judge" element={<RoleRoute roles={['Judge']}><JudgePortal /></RoleRoute>} /><Route path="/registrar" element={<RoleRoute roles={['Registrar', 'Admin']}><RegistrarPortal /></RoleRoute>} /><Route path="/advocate" element={<RoleRoute roles={['Advocate']}><AdvocatePortal /></RoleRoute>} /><Route path="*" element={<Navigate to={user.role === 'Judge' ? '/judge' : user.role === 'Advocate' ? '/advocate' : '/registrar'} replace />} /></Routes></Shell>
}

function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const user = useAuth((state) => state.user)
  return user && roles.includes(user.role) ? children : <Navigate to="/" replace />
}

function Shell({ children }: { children: React.ReactNode }) {
  const user = useAuth((state) => state.user)
  const signOut = useAuth((state) => state.signOut)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  return <div className="app-shell"><aside className={open ? 'sidebar sidebar-open' : 'sidebar'}><div className="brand-lockup"><span className="brand-mark">JQ</span><div><strong>JustiQ</strong><small>Judicial operations</small></div></div><button className="close-nav" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18} /></button><nav>{nav.filter((item) => item.roles.includes(user?.role ?? '')).map((item) => { const Icon = item.icon; return <Link className={location.pathname.startsWith(item.path) ? 'nav-item active' : 'nav-item'} to={item.path} key={item.path} onClick={() => setOpen(false)}><Icon size={17} />{item.label}</Link> })}<Link className="nav-item" to="/public"><Search size={17} />Public portal</Link></nav><div className="sidebar-foot"><span className="role-dot" />{user?.role}<button className="icon-button" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={16} /></button></div></aside><div className="main-column"><header className="topbar"><button className="menu-button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div><span className="kicker">Judicial case management</span><strong>Operations desk</strong></div><div className="connection"><span />Live operations</div></header><main>{children}</main></div></div>
}

function Login() {
  const signIn = useAuth((state) => state.signIn)
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@justiq.local')
  const [password, setPassword] = useState('JustiQ-Dev-Password-2026')
  const [error, setError] = useState('')
  return <div className="auth-page"><div className="auth-art"><span className="brand-mark">JQ</span><p className="kicker">Secure court operations</p><h1>Decisions need a clear record.</h1><p>One calm workspace for dockets, filings, hearings, and the people who move them forward.</p></div><form className="auth-card" onSubmit={async (event) => { event.preventDefault(); setError(''); try { await signIn(email, password); navigate('/'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed') } }}><span className="kicker">Authorized access</span><h2>Sign in to JustiQ</h2><label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label><label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>{error && <div className="error-banner">{error}</div>}<button className="primary-button" type="submit">Enter workspace <ArrowRight size={16} /></button><Link className="public-link" to="/public">Continue to public case lookup <ArrowRight size={14} /></Link></form></div>
}

function JudgePortal() {
  const user = useAuth((state) => state.user)
  const cases = useQuery({ queryKey: ['queue', user?.courtId], queryFn: () => api.queue(user?.courtId ?? ''), enabled: Boolean(user?.courtId) })
  const socket = useCourtSocket({ courtId: user?.courtId, accessToken: getAccessToken() })
  return <><PortalHeader eyebrow="Bench view" title="Judge dashboard" description="Your live docket, hearing pressure, and notes in one place." live={socket.connected} /><section className="portal-grid"><Panel title="Live docket" icon={<LayoutDashboard size={18} />} state={cases}>{cases.data?.length ? <div className="case-list">{cases.data.map((item) => <CaseRow key={item.id} item={item} action={<BenchNotes item={item} />} />)}</div> : <Empty text="No cases are currently in this court queue." />}</Panel><Panel title="Courtroom management" icon={<CalendarDays size={18} />} state={cases}><div className="metric-row"><Metric value={cases.data?.length ?? 0} label="queued cases" /><Metric value={cases.data?.filter((item) => item.is_emergency).length ?? 0} label="emergency matters" /></div><p className="muted">Review hearing activity from each case record.</p></Panel></section></>
}

function RegistrarPortal() {
  const user = useAuth((state) => state.user)
  const cases = useQuery({ queryKey: ['registrar-cases'], queryFn: () => api.emergencyCases() })
  const triage = useMutation({ mutationFn: (id: string) => api.triage(id), onSuccess: () => void cases.refetch() })
  const accept = useMutation({ mutationFn: (id: string) => api.acceptEmergency(id), onSuccess: () => void cases.refetch() })
  const queue = useQuery({ queryKey: ['queue', user?.courtId], queryFn: () => api.queue(user?.courtId ?? ''), enabled: Boolean(user?.courtId) })
  const reorder = useMutation({ mutationFn: (ids: string[]) => api.reorder(user?.courtId ?? '', ids, 'Registrar manual reorder'), onSuccess: () => void queue.refetch() })
  return <>
    <PortalHeader eyebrow="Registrar desk" title="Control the docket" description="Verify filings, triage emergency matters, and keep the queue moving." />
    <section className="portal-grid">
      <Panel title="Emergency triage" icon={<AlertTriangle size={18} />} state={cases}>
        <EmergencyTriage cases={cases.data?.items ?? []} onTriage={(id) => triage.mutate(id)} onAccept={(id) => accept.mutate(id)} />
      </Panel>
      <Panel title="Manual queue order" icon={<SlidersHorizontal size={18} />} state={queue}>
        {queue.data?.length ? <QueueReorder items={queue.data} onReorder={(items) => reorder.mutate(items.map((item) => item.id))} /> : <Empty text="The court queue is empty." />}
      </Panel>
    </section>
  </>
}

function AdvocatePortal() {
  const cases = useQuery({ queryKey: ['advocate-cases'], queryFn: () => api.cases('?limit=100') })
  const create = useMutation({ mutationFn: (body: unknown) => api.createCase(body), onSuccess: () => void cases.refetch() })
  const [number, setNumber] = useState('')
  const [type, setType] = useState('Civil Writ Petition')
  const [court, setCourt] = useState('')
  return <><PortalHeader eyebrow="Advocate workspace" title="File and follow matters" description="Create a filing, track its status, and keep the next hearing visible." /><section className="portal-grid"><Panel title="E-filing" icon={<FilePlus2 size={18} />} state={cases}><form className="compact-form" onSubmit={(event) => { event.preventDefault(); create.mutate({ case_number: number, case_type: type, court_id: court }) }}><label>Case number<input required value={number} onChange={(event) => setNumber(event.target.value)} placeholder="JCMS-2026-0002" /></label><label>Case type<select value={type} onChange={(event) => setType(event.target.value)}><option>Civil Writ Petition</option><option>Criminal Appeal</option><option>Family Matter</option></select></label><label>Court ID<input required value={court} onChange={(event) => setCourt(event.target.value)} placeholder="Court UUID" /></label><button className="primary-button" type="submit">Submit filing <ArrowRight size={16} /></button>{create.isError && <div className="error-banner">{create.error.message}</div>}{create.isSuccess && <div className="success-banner">Filing created and queued for verification.</div>}</form></Panel><Panel title="Case tracking" icon={<Search size={18} />} state={cases}>{cases.data?.items.length ? <div className="case-list">{cases.data.items.map((item) => <CaseRow key={item.id} item={item} />)}</div> : <Empty text="No filings found for this advocate." />}</Panel></section></>
}

function PublicPortal() {
  const [court, setCourt] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [number, setNumber] = useState('')
  const cause = useQuery({ queryKey: ['cause-list', court, date], queryFn: () => api.causeList(court, date), enabled: Boolean(court) })
  const status = useQuery({ queryKey: ['public-status', number], queryFn: () => api.caseStatus(number), enabled: false })
  return <div className="public-page"><header className="public-top"><Link to="/public" className="brand-lockup"><span className="brand-mark">JQ</span><strong>JustiQ Public Access</strong></Link><Link to="/login" className="secondary-button">Staff sign in</Link></header><section className="public-hero"><span className="kicker">Open court information</span><h1>Find the next step.</h1><p>Search today’s cause list or check a case status using its published case number.</p></section><section className="public-grid"><Panel title="Daily cause list" icon={<CalendarDays size={18} />} state={cause}><div className="filter-row"><input value={court} onChange={(event) => setCourt(event.target.value)} placeholder="Court UUID" /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>{court ? cause.data?.length ? cause.data.map((entry) => <div className="cause-row" key={entry.hearingId}><time>{new Date(entry.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><strong>{entry.case.case_number}</strong><span>{entry.case.case_type} · {entry.courtroom}</span></div>) : <Empty text="No hearings published for this date." /> : <Empty text="Enter a court ID to view its published list." />}</Panel><Panel title="Case status lookup" icon={<Search size={18} />} state={status}><form className="search-form" onSubmit={(event) => { event.preventDefault(); void status.refetch() }}><input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="JCMS-2026-0001" /><button className="primary-button" type="submit">Search <Search size={15} /></button></form>{status.isFetching && <Loading />}{status.data && <div className="status-result"><strong>{status.data.case_number}</strong><span>{status.data.case_type}</span><Workflow status={status.data.status} /></div>}{status.isError && <div className="error-banner">No public case matched that number.</div>}</Panel></section></div>
}

function PortalHeader({ eyebrow, title, description, live }: { eyebrow: string; title: string; description: string; live?: boolean }) { return <header className="portal-header"><div><span className="kicker">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{live !== undefined && <span className="live-pill"><span />{live ? 'Live' : 'Offline'}</span>}</header> }
function Panel({ title, icon, state, children }: { title: string; icon: React.ReactNode; state: { isLoading: boolean; isError: boolean; error?: Error | null }; children: React.ReactNode }) { return <article className="panel"><div className="panel-heading"><h2>{icon}{title}</h2>{state.isLoading && <span className="small-status">Loading</span>}</div>{state.isError ? <div className="error-state"><AlertTriangle size={20} /><strong>Could not load this view</strong><span>{state.error?.message ?? 'Try again in a moment.'}</span></div> : state.isLoading ? <Loading /> : children}</article> }
function Loading() { return <div className="loading-state"><span className="spinner" />Loading live data...</div> }
function Empty({ text }: { text: string }) { return <div className="empty-state"><span>—</span>{text}</div> }
function Metric({ value, label }: { value: number; label: string }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div> }
function CaseRow({ item, action }: { item: CaseRecord; action?: React.ReactNode }) { return <div className="case-row"><div><strong>{item.case_number}</strong><span>{item.case_type}</span></div><div className="case-meta"><b>{item.priority_score}</b><Workflow status={item.status} /></div>{action}</div> }
function Workflow({ status }: { status?: string }) { return <span className={`workflow workflow-${status?.toLowerCase().replaceAll('_', '-')}`}><span />{status?.replaceAll('_', ' ') ?? 'Unknown'}</span> }
function BenchNotes({ item }: { item: CaseRecord }) { const [notes, setNotes] = useState(item.bench_notes ?? ''); const mutation = useMutation({ mutationFn: () => api.notes(item.id, notes) }); return <form className="notes-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Bench note" /><button className="icon-button" aria-label="Save bench note" type="submit"><CheckCircle2 size={15} /></button></form> }
export default App
