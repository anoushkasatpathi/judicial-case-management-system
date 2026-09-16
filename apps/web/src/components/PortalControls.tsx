import { useState } from 'react'
import type { CaseRecord } from '../lib/api'

export function EmergencyTriage({ cases, onTriage, onAccept }: { cases: CaseRecord[]; onTriage: (id: string) => void; onAccept: (id: string) => void }) {
  const emergencyCases = cases.filter((item) => item.is_emergency)
  if (!emergencyCases.length) return <div className="empty-state"><span>—</span>No emergency petitions are awaiting triage.</div>
  return <div className="emergency-list">{emergencyCases.map((item) => <div className="emergency-card" key={item.id}>
    <div><strong>{item.case_number}</strong><span>{item.case_type}</span></div>
    <span className={`workflow workflow-${item.emergency_status?.toLowerCase()}`}><span />{item.emergency_status?.replaceAll('_', ' ')}</span>
    <div className="action-row">
      {item.emergency_status === 'FiledEmergency' && <button className="secondary-button" onClick={() => onTriage(item.id)}>Triage</button>}
      {item.emergency_status === 'RegistrarTriage' && <button className="secondary-button" onClick={() => onAccept(item.id)}>Accept for judge</button>}
    </div>
  </div>)}</div>
}

export function QueueReorder({ items, onReorder }: { items: CaseRecord[]; onReorder: (items: CaseRecord[]) => void }) {
  const [list, setList] = useState(items)
  const move = (index: number, direction: number) => {
    const next = [...list]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setList(next)
    onReorder(next)
  }
  return <div className="reorder-list">{list.map((item, index) => <div className="reorder-row" key={item.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.case_number}</strong><button className="icon-button" onClick={() => move(index, -1)} aria-label={`Move ${item.case_number} up`}>↑</button><button className="icon-button" onClick={() => move(index, 1)} aria-label={`Move ${item.case_number} down`}>↓</button></div>)}</div>
}
