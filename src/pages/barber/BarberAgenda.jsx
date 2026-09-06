import { useCallback, useMemo, useState } from 'react'
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Scissors,
} from 'lucide-react'

import {
  APPOINTMENT_STATUS_STYLES,
  BLOCKING_APPOINTMENT_STATUS,
  BLOCKING_COURSE_STATUS,
} from '@/constants'
import { cn } from '@/utils/format'
import {
  addDays,
  formatDayChip,
  formatLongDate,
  formatTime12,
  formatTimeRange,
  isToday,
  startOfWeek,
  todayISO,
  weekdayOf,
  weekDates,
} from '@/utils/date'
import { getOpeningForDate } from '@/utils/schedule'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useBusiness } from '@/context/BusinessContext'
import {
  AppointmentStatusBadge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * Agenda del barbero en vista semanal.
 *
 * Muestra en la misma rejilla las citas, los bloqueos manuales y las
 * sesiones de los cursos que imparte, que es exactamente lo que ocupa
 * su tiempo.
 */
export default function BarberAgenda() {
  const { user } = useAuth()
  const { business } = useBusiness()

  const [anchor, setAnchor] = useState(todayISO())
  const [selectedDate, setSelectedDate] = useState(todayISO())

  const week = useMemo(() => weekDates(anchor), [anchor])

  /* ---------------- Datos de la semana ---------------- */
  const loader = useCallback(async () => {
    const from = week[0]
    const to = week[6]

    const [appointments, blocks, courses, serviceList, clients] = await Promise.all([
      services.appointments.list({ barberId: user.uid, from, to }),
      services.blocks.list({ barberId: user.uid, from, to }),
      services.courses.list({ instructorId: user.uid }),
      services.services.list(),
      services.users.listClients(),
    ])

    return { appointments, blocks, courses, serviceList, clients }
  }, [user.uid, week])

  const { data, loading, error, reload } = useAsync(loader, [user.uid, week[0]])

  const serviceById = useMemo(
    () => Object.fromEntries((data?.serviceList || []).map((s) => [s.id, s])),
    [data]
  )
  const clientById = useMemo(
    () => Object.fromEntries((data?.clients || []).map((c) => [c.uid, c])),
    [data]
  )

  /* ---------------- Detalle del dia seleccionado ---------------- */
  const dayLoader = useCallback(async () => {
    if (!selectedDate) return null
    return services.appointments.getAgendaDay({ barberId: user.uid, date: selectedDate })
  }, [user.uid, selectedDate])

  const { data: day, loading: loadingDay } = useAsync(dayLoader, [user.uid, selectedDate])

  /** Elementos de un dia concreto, para pintar la columna de la semana */
  function itemsOf(date) {
    const appointments = (data?.appointments || []).filter(
      (a) => a.date === date && BLOCKING_APPOINTMENT_STATUS.includes(a.status)
    )
    const blocks = (data?.blocks || []).filter((b) => b.date === date)
    const sessions = (data?.courses || [])
      .filter((c) => BLOCKING_COURSE_STATUS.includes(c.status))
      .flatMap((course) => {
        const days = course.schedule?.days || []
        const inRange = course.startDate <= date && date <= course.endDate
        const matchesDay = days.includes(weekdayOf(date))
        if (!inRange || !matchesDay) return []
        return [
          {
            id: course.id,
            title: course.title,
            startTime: course.schedule.startTime,
            endTime: course.schedule.endTime,
          },
        ]
      })

    return { appointments, blocks, sessions }
  }

  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <>
      <PageHeader
        title="Mi agenda"
        description="Citas, bloqueos y clases en una sola vista semanal."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAnchor(todayISO())
                setSelectedDate(todayISO())
              }}
            >
              Hoy
            </Button>
            <div className="flex overflow-hidden rounded-lg border border-ink-600">
              <button
                type="button"
                onClick={() => setAnchor(addDays(startOfWeek(anchor), -7))}
                className="px-2.5 py-2 text-ink-300 transition hover:bg-ink-800"
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setAnchor(addDays(startOfWeek(anchor), 7))}
                className="border-l border-ink-600 px-2.5 py-2 text-ink-300 transition hover:bg-ink-800"
                aria-label="Semana siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      />

      {/* ---------- Rejilla semanal ---------- */}
      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-ink-800 px-5 py-3">
          <p className="text-sm font-medium text-ink-200">
            Semana del {formatLongDate(week[0])}
          </p>
        </div>

        <div className="grid grid-cols-2 divide-ink-800 sm:grid-cols-4 lg:grid-cols-7 lg:divide-x">
          {week.map((date) => {
            const { appointments, blocks, sessions } = itemsOf(date)
            const opening = getOpeningForDate(business.openingHours, date)
            const total = appointments.length + blocks.length + sessions.length

            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'min-h-[9rem] border-b border-ink-800 p-3 text-left align-top transition lg:border-b-0',
                  selectedDate === date ? 'bg-gold-500/[0.07]' : 'hover:bg-ink-850'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-xs font-medium uppercase tracking-wide',
                      isToday(date) ? 'text-gold-400' : 'text-ink-500'
                    )}
                  >
                    {formatDayChip(date)}
                  </span>
                  {total > 0 && (
                    <span className="rounded-full bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-400">
                      {total}
                    </span>
                  )}
                </div>

                {!opening ? (
                  <p className="mt-3 text-[11px] text-ink-700">Cerrado</p>
                ) : loading ? (
                  <div className="mt-3 space-y-1.5">
                    <Skeleton className="h-5" />
                    <Skeleton className="h-5" />
                  </div>
                ) : total === 0 ? (
                  <p className="mt-3 text-[11px] text-ink-600">Sin actividad</p>
                ) : (
                  <ul className="mt-3 space-y-1">
                    {sessions.map((session) => (
                      <li
                        key={`c-${session.id}`}
                        className="truncate rounded border-l-2 border-l-violet-400 bg-violet-500/10 px-1.5 py-1 text-[10px] text-violet-200"
                      >
                        {session.startTime} {session.title}
                      </li>
                    ))}
                    {appointments.slice(0, 3).map((appointment) => (
                      <li
                        key={`a-${appointment.id}`}
                        className={cn(
                          'truncate rounded border-l-2 bg-ink-800 px-1.5 py-1 text-[10px] text-ink-300',
                          APPOINTMENT_STATUS_STYLES[appointment.status]?.border
                        )}
                      >
                        {appointment.startTime}{' '}
                        {clientById[appointment.clientId]?.name?.split(' ')[0] || 'Cliente'}
                      </li>
                    ))}
                    {appointments.length > 3 && (
                      <li className="px-1.5 text-[10px] text-ink-500">
                        +{appointments.length - 3} mas
                      </li>
                    )}
                    {blocks.map((block) => (
                      <li
                        key={`b-${block.id}`}
                        className="truncate rounded border-l-2 border-l-ink-500 bg-ink-800/60 px-1.5 py-1 text-[10px] text-ink-400"
                      >
                        {block.startTime} {block.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* ---------- Detalle del dia ---------- */}
      <section className="mt-6">
        <h2 className="mb-4 text-lg font-semibold text-ink-100">
          {formatLongDate(selectedDate)}
          {isToday(selectedDate) && <span className="ml-2 text-sm text-gold-500">hoy</span>}
        </h2>

        {loadingDay ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !day?.opening ? (
          <EmptyState
            icon={CalendarDays}
            title="La barberia no abre este dia"
            description="Segun la configuracion del negocio, este dia esta cerrado."
            compact
          />
        ) : (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-ink-400">
              <Clock className="h-4 w-4 text-gold-500/70" />
              Horario del local: {formatTime12(day.opening.open)} a {formatTime12(day.opening.close)}
            </p>

            {/* Sesiones de curso */}
            {day.courseSessions.map((session) => (
              <div
                key={`session-${session.refId}`}
                className="flex items-center gap-4 rounded-xl border border-violet-500/30 border-l-4 border-l-violet-400 bg-violet-500/[0.06] p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-100">{session.label}</p>
                  <p className="text-xs text-violet-300/80">Clase del curso</p>
                </div>
                <span className="shrink-0 text-sm text-ink-300">
                  {formatTimeRange(session.start, session.end)}
                </span>
              </div>
            ))}

            {/* Bloqueos */}
            {day.blocks.map((block) => (
              <div
                key={`block-${block.id}`}
                className="flex items-center gap-4 rounded-xl border border-ink-700 border-l-4 border-l-ink-500 bg-ink-900 p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-ink-400">
                  <Ban className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-200">{block.reason}</p>
                  <p className="text-xs text-ink-500">Horario bloqueado</p>
                </div>
                <span className="shrink-0 text-sm text-ink-400">
                  {formatTimeRange(block.startTime, block.endTime)}
                </span>
              </div>
            ))}

            {/* Citas */}
            {day.appointments.length === 0 &&
            day.blocks.length === 0 &&
            day.courseSessions.length === 0 ? (
              <EmptyState
                icon={Scissors}
                title="Dia libre de citas"
                description="No hay nada agendado para este dia."
                compact
              />
            ) : (
              day.appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className={cn(
                    'flex flex-wrap items-center gap-4 rounded-xl border border-ink-700 border-l-4 bg-ink-900 p-4',
                    APPOINTMENT_STATUS_STYLES[appointment.status]?.border
                  )}
                >
                  <span className="w-20 shrink-0 text-center">
                    <span className="block text-sm font-semibold text-ink-100">
                      {appointment.startTime}
                    </span>
                    <span className="block text-[11px] text-ink-500">{appointment.endTime}</span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-100">
                      {clientById[appointment.clientId]?.name || 'Cliente'}
                    </p>
                    <p className="truncate text-xs text-ink-400">
                      {serviceById[appointment.serviceId]?.name}
                    </p>
                    {appointment.notes && (
                      <p className="mt-1 truncate text-xs italic text-ink-500">{appointment.notes}</p>
                    )}
                  </div>

                  <AppointmentStatusBadge status={appointment.status} />
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </>
  )
}
