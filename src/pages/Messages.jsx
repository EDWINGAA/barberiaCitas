import { useCallback, useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'

import { ROLES } from '@/constants'
import { cn } from '@/utils/format'
import { formatRelativeDay } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { Avatar, EmptyState, ErrorState, SkeletonList } from '@/components/ui'
import { AppointmentChat } from '@/components/chat/AppointmentChat'

/**
 * "Mensajes": bandeja de conversaciones, compartida por cliente y barbero.
 *
 * Reune en una sola lista los hilos de todas sus citas, con el ultimo
 * mensaje y los que quedan sin leer, para no tener que entrar cita por
 * cita a buscarlos.
 *
 * La pantalla es la misma para los dos roles porque el contenido es
 * simetrico; solo cambia de que lado se mira:
 *
 *   - el cliente ve al barbero que le atiende,
 *   - el barbero ve al cliente que viene.
 *
 * Se resuelve con dos variables al principio en lugar de duplicar la
 * pantalla, igual que se hace con "Mi perfil".
 */
export default function Messages() {
  const { user } = useAuth()
  const [chatTarget, setChatTarget] = useState(null)

  const esBarbero = user.role === ROLES.BARBERO

  const loader = useCallback(async () => {
    const [conversations, appointments, personas] = await Promise.all([
      services.messages.listConversations({ userId: user.uid, role: user.role }),
      // Sus citas, vistas desde su lado
      services.appointments.list(esBarbero ? { barberId: user.uid } : { clientId: user.uid }),
      // Y con quien habla en cada una
      esBarbero ? services.users.listClients() : services.users.listBarbers({ activeOnly: false }),
    ])
    return { conversations, appointments, personas }
  }, [user.uid, user.role, esBarbero])

  const { data, loading, error, reload } = useAsync(loader, [user.uid])

  const apptById = useMemo(
    () => Object.fromEntries((data?.appointments || []).map((a) => [a.id, a])),
    [data]
  )
  const personaById = useMemo(
    () => Object.fromEntries((data?.personas || []).map((p) => [p.uid, p])),
    [data]
  )

  /** Id de la otra parte dentro de una cita */
  const otraParte = useCallback(
    (appointment) => (esBarbero ? appointment.clientId : appointment.barberId),
    [esBarbero]
  )

  const rows = useMemo(
    () =>
      (data?.conversations || [])
        .map((c) => {
          const appointment = apptById[c.appointmentId]
          if (!appointment) return null
          return { ...c, appointment, persona: personaById[otraParte(appointment)] }
        })
        .filter(Boolean),
    [data, apptById, personaById, otraParte]
  )

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink-50">Mensajes</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          {esBarbero
            ? 'Tus conversaciones con el cliente de cada cita, todas en un sitio.'
            : 'Tus conversaciones con el barbero de cada cita, todas en un sitio.'}
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
          description={
            esBarbero
              ? 'En cuanto confirmes una cita, tu cliente podra escribirte y la conversacion aparecera aqui.'
              : 'Cuando un barbero confirme una cita, podras escribirle desde aqui.'
          }
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
                <Avatar src={row.persona?.photoURL} name={row.persona?.name} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        'truncate text-sm font-semibold',
                        row.unread > 0 ? 'text-ink-50' : 'text-ink-100'
                      )}
                    >
                      {row.persona?.name || (esBarbero ? 'Cliente' : 'Barbero')}
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
        counterpart={chatTarget ? personaById[otraParte(chatTarget)] : null}
        onClose={() => setChatTarget(null)}
        onActivity={reload}
      />
    </>
  )
}
