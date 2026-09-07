import { useCallback, useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'

import { cn } from '@/utils/format'
import { formatRelativeDay } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { Avatar, EmptyState, ErrorState, SkeletonList } from '@/components/ui'
import { AppointmentChat } from '@/components/chat/AppointmentChat'

/**
 * "Mensajes": bandeja de conversaciones del cliente.
 *
 * Reune en una sola lista todos los hilos de sus citas, con el ultimo
 * mensaje y los que quedan sin leer, para no tener que entrar cita por
 * cita a buscarlos.
 */
export default function ClientMessages() {
  const { user } = useAuth()
  const [chatTarget, setChatTarget] = useState(null)

  const loader = useCallback(async () => {
    const [conversations, appointments, barbers] = await Promise.all([
      services.messages.listConversations({ userId: user.uid, role: user.role }),
      services.appointments.list({ clientId: user.uid }),
      services.users.listBarbers({ activeOnly: false }),
    ])
    return { conversations, appointments, barbers }
  }, [user.uid, user.role])

  const { data, loading, error, reload } = useAsync(loader, [user.uid])

  const apptById = useMemo(
    () => Object.fromEntries((data?.appointments || []).map((a) => [a.id, a])),
    [data]
  )
  const barberById = useMemo(
    () => Object.fromEntries((data?.barbers || []).map((b) => [b.uid, b])),
    [data]
  )

  const rows = useMemo(
    () =>
      (data?.conversations || [])
        .map((c) => {
          const appointment = apptById[c.appointmentId]
          if (!appointment) return null
          return { ...c, appointment, barber: barberById[appointment.barberId] }
        })
        .filter(Boolean),
    [data, apptById, barberById]
  )

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink-50">Mensajes</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          Tus conversaciones con el barbero de cada cita, todas en un sitio.
        </p>
      </header>

      {loading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Aun no tienes mensajes"
          description="Cuando un barbero confirme una cita, podras escribirle desde aqui."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900">
          {rows.map((row, i) => {
            const mio = row.lastSenderId === user.uid
            return (
              <button
                key={row.appointmentId}
                type="button"
                onClick={() => setChatTarget(row.appointment)}
                className={cn(
                  'flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-ink-850',
                  i > 0 && 'border-t border-ink-800'
                )}
              >
                <Avatar src={row.barber?.photoURL} name={row.barber?.name} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        'truncate text-sm font-semibold',
                        row.unread > 0 ? 'text-ink-50' : 'text-ink-100'
                      )}
                    >
                      {row.barber?.name || 'Barbero'}
                    </p>
                    <span className="shrink-0 text-[11px] text-ink-500">
                      {row.lastAt ? formatRelativeDay(String(row.lastAt).slice(0, 10)) : ''}
                    </span>
                  </div>

                  <p
                    className={cn(
                      'mt-0.5 truncate text-xs',
                      row.unread > 0 ? 'text-ink-200' : 'text-ink-400'
                    )}
                  >
                    {mio && <span className="text-ink-500">Tu: </span>}
                    {row.lastText}
                  </p>

                  <p className="mt-0.5 truncate text-[11px] text-ink-600">
                    {row.appointment.serviceName || 'Cita'} ·{' '}
                    {formatRelativeDay(row.appointment.date)} {row.appointment.startTime}
                  </p>
                </div>

                {row.unread > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-gold-500 px-1.5 text-[11px] font-bold text-ink-950">
                    {row.unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <AppointmentChat
        appointment={chatTarget}
        me={user}
        counterpart={chatTarget ? barberById[chatTarget.barberId] : null}
        onClose={() => setChatTarget(null)}
        onActivity={reload}
      />
    </>
  )
}
