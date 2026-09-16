import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  EmergencyAlertEvent,
  HearingScheduledEvent,
  QueueUpdatedEvent,
} from '@justiq/shared-types'

export interface CourtSocketOptions {
  courtId?: string
  accessToken?: string
  onQueueUpdated?: (event: QueueUpdatedEvent) => void
  onHearingScheduled?: (event: HearingScheduledEvent) => void
  onEmergencyAlert?: (event: EmergencyAlertEvent) => void
}

export interface CourtSocketState {
  connected: boolean
  queueUpdated?: QueueUpdatedEvent
  hearingScheduled?: HearingScheduledEvent
  emergencyAlert?: EmergencyAlertEvent
}

export function useCourtSocket(options: CourtSocketOptions): CourtSocketState {
  const [state, setState] = useState<CourtSocketState>({ connected: false })

  useEffect(() => {
    if (!options.courtId || !options.accessToken) {
      setState((current) => ({ ...current, connected: false }))
      return undefined
    }

    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
    const socket: Socket = io(`${apiUrl}/ws`, {
      auth: { token: options.accessToken },
      transports: ['websocket'],
    })

    const handleConnect = () => {
      setState((current) => ({ ...current, connected: true }))
      socket.emit('court:join', { courtId: options.courtId })
    }
    const handleDisconnect = () => setState((current) => ({ ...current, connected: false }))
    const handleQueueUpdated = (event: QueueUpdatedEvent) => {
      setState((current) => ({ ...current, queueUpdated: event }))
      options.onQueueUpdated?.(event)
    }
    const handleHearingScheduled = (event: HearingScheduledEvent) => {
      setState((current) => ({ ...current, hearingScheduled: event }))
      options.onHearingScheduled?.(event)
    }
    const handleEmergencyAlert = (event: EmergencyAlertEvent) => {
      setState((current) => ({ ...current, emergencyAlert: event }))
      options.onEmergencyAlert?.(event)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('queue:updated', handleQueueUpdated)
    socket.on('hearing:scheduled', handleHearingScheduled)
    socket.on('emergency:alert', handleEmergencyAlert)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('queue:updated', handleQueueUpdated)
      socket.off('hearing:scheduled', handleHearingScheduled)
      socket.off('emergency:alert', handleEmergencyAlert)
      socket.disconnect()
    }
  }, [options.accessToken, options.courtId, options.onEmergencyAlert, options.onHearingScheduled, options.onQueueUpdated])

  return state
}