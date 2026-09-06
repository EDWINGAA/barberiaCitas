import { CalendarDays, Clock, MessageSquare, Scissors, User } from 'lucide-react'

import { APPOINTMENT_STATUS_STYLES } from '@/constants'
import { cn, formatMoney } from '@/utils/format'
import { formatRelativeDay, formatTimeRange, formatWeekdayDate } from '@/utils/date'
import { AppointmentStatusBadge, Avatar } from '@/components/ui'

/**
 * Tarjeta de cita reutilizable en los tres paneles.
 *
 * @param {object} appointment  documento de la cita
 * @param {object} service      servicio resuelto
 * @param {object} barber       barbero resuelto
 * @param {object} client       cliente resuelto
 * @param {string} perspective  'cliente' | 'barbero' | 'admin'
 * @param {node}   actions      botones al pie
 */
export function AppointmentCard({
  appointment,
  service,
  barber,
  client,
  perspective = 'cliente',
  actions,
  compact = false,
}) {
  const style = APPOINTMENT_STATUS_STYLES[appointment.status]
  // El cliente ve con quien se corta; barbero y admin ven a quien atienden
  const person = perspective === 'cliente' ? barber : client

  // Salvo hoy, manana y ayer, formatRelativeDay ya devuelve la fecha
  // completa: el pie de la tarjeta la repetia palabra por palabra.
  const fechaRelativa = formatRelativeDay(appointment.date)
  const fechaLarga = formatWeekdayDate(appointment.date)
  const fechaRepetida = fechaRelativa.toLowerCase() === fechaLarga.toLowerCase()

  return (
    <article
      className={cn(
        'rounded-2xl border border-ink-700/70 border-l-4 bg-ink-900 transition hover:border-ink-600',
        style?.border,
        compact ? 'p-4' : 'p-5'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 shrink-0 text-gold-500/80" />
            <h3 className="truncate text-sm font-semibold text-ink-100">
              {service?.name || 'Servicio no disponible'}
            </h3>
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {fechaRelativa}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatTimeRange(appointment.startTime, appointment.endTime)}
            </span>
          </p>
        </div>

        <AppointmentStatusBadge status={appointment.status} />
      </div>

      {/* Persona relacionada */}
      {person && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-ink-850 p-3">
          <Avatar src={person.photoURL} name={person.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink-100">{person.name}</p>
            <p className="truncate text-xs text-ink-500">
              {perspective === 'cliente' ? 'Tu barbero' : person.phone || person.email}
            </p>
          </div>
          {appointment.price > 0 && (
            <span className="shrink-0 text-sm font-semibold text-gold-400">
              {formatMoney(appointment.price)}
            </span>
          )}
        </div>
      )}

      {/* Perspectiva de admin: mostrar ambos lados */}
      {perspective === 'admin' && barber && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-400">
          <User className="h-3.5 w-3.5" />
          Atiende <span className="text-ink-200">{barber.name}</span>
        </p>
      )}

      {appointment.notes && (
        <p className="mt-3 flex gap-2 rounded-lg bg-ink-850/60 p-3 text-xs leading-relaxed text-ink-400">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
          {appointment.notes}
        </p>
      )}

      {!compact && !fechaRepetida && (
        <p className="mt-3 text-[11px] text-ink-600">{fechaLarga}</p>
      )}

      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </article>
  )
}

/**
 * Fila compacta de cita para las agendas por horas.
 * Muestra la hora a la izquierda a modo de linea de tiempo.
 */
export function AppointmentTimelineRow({ appointment, service, person, actions, onClick }) {
  const style = APPOINTMENT_STATUS_STYLES[appointment.status]

  return (
    <div
      className={cn(
        // "flex-wrap" es lo que permite que la fila quepa en un telefono:
        // sin el, la hora, el nombre y los botones se suman en una sola
        // linea que no puede encoger, y esa anchura minima arrastraba a
        // toda la columna del panel fuera de la pantalla.
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink-700/70 border-l-4 bg-ink-900 p-3 transition',
        style?.border,
        onClick && 'cursor-pointer hover:border-ink-600 hover:bg-ink-850'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="w-14 shrink-0 text-center sm:w-20">
        <p className="text-sm font-semibold text-ink-100">{appointment.startTime}</p>
        <p className="text-[11px] text-ink-500">{appointment.endTime}</p>
      </div>

      <div className="min-w-0 flex-1 basis-28">
        <p className="truncate text-sm font-medium text-ink-100">{person?.name || 'Cliente'}</p>
        <p className="truncate text-xs text-ink-400">{service?.name}</p>
      </div>

      {/* Si no caben en la misma linea, bajan y quedan a la derecha */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <AppointmentStatusBadge status={appointment.status} size="xs" withDot={false} />
        {actions}
      </div>
    </div>
  )
}

export default AppointmentCard
