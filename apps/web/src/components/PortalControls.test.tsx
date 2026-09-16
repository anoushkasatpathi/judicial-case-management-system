// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmergencyTriage, QueueReorder } from './PortalControls'

const emergencyCase = { id: 'case-1', case_number: 'JCMS-1', case_type: 'Writ', status: 'Filed', emergency_status: 'FiledEmergency', priority_score: 1, is_emergency: true, filed_at: '' }
const queueCases = [
  { ...emergencyCase, id: 'case-a', case_number: 'JCMS-A', is_emergency: false },
  { ...emergencyCase, id: 'case-b', case_number: 'JCMS-B', is_emergency: false },
]

describe('portal controls', () => {
  it('shows triage state and calls the correct transition callback', async () => {
    const user = userEvent.setup()
    const onTriage = vi.fn()
    render(<EmergencyTriage cases={[emergencyCase]} onTriage={onTriage} onAccept={vi.fn()} />)
    expect(screen.getByText('FiledEmergency')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Triage' }))
    expect(onTriage).toHaveBeenCalledWith('case-1')
  })

  it('calls reorder with the new ordered case IDs', async () => {
    const user = userEvent.setup()
    const onReorder = vi.fn()
    render(<QueueReorder items={queueCases} onReorder={onReorder} />)
    await user.click(screen.getByRole('button', { name: 'Move JCMS-B up' }))
    expect(onReorder).toHaveBeenCalledWith([queueCases[1], queueCases[0]])
  })
})
