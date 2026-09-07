import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CalendarClock, GraduationCap, MessageSquare, UserCheck } from 'lucide-react'

import { APPOINTMENT_STATUS, COURSE_STATUS, ROLES } from '@/constants'
import { cn } from '@/utils/format'
import { formatRelativeDay, formatTime12, todayISO, addDays } from '@/utils/date'
import { useAuth } from '@/context/AuthContext'
import services from '@/services'

/**
 * Campana de notificaciones.
 *
 * No hay servicio de notificaciones como tal: se derivan de los datos
 * que ya existen (citas por confirmar, citas de hoy, cursos por aprobar),
 * que es justo lo que el usuario necesita ver de un vistazo.
 */
export function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    let cancelled = false
    if (!user) return undefined

    async function load() {
      const today = todayISO()
      const collected = []

      try {
        if (user.role === ROLES.BARBERO) {
          const [pending, todays] = await Promise.all([
            services.appointments.list({
              barberId: user.uid,
              status: APPOINTMENT_STATUS.PENDIENTE,
              from: today,
            }),
            services.appointments.list({ barberId: user.uid, from: today, to: today }),
          ])

          pending.slice(0, 5).forEach((apt) => {
            collected.push({
              id: `pend-${apt.id}`,
              icon: UserCheck,
              tone: 'text-amber-400',
              title: 'Cita por confirmar',
              detail: `${formatRelativeDay(apt.date)} a las ${formatTime12(apt.startTime)}`,
              to: '/barbero/citas',
            })
          })

          const active = todays.filter((a) =>
            [APPOINTMENT_STATUS.PENDIENTE, APPOINTMENT_STATUS.CONFIRMADA].includes(a.status)
          )
          if (active.length) {
            collected.unshift({
              id: 'today-count',
              icon: CalendarClock,
              tone: 'text-sky-400',
              title: `Tienes ${active.length} cita${active.length > 1 ? 's' : ''} hoy`,
              detail: 'Revisa tu agenda del dia',
              to: '/barbero/agenda',
            })
          }
        }

        if (user.role === ROLES.ADMIN) {
          const [drafts, pending] = await Promise.all([
            services.courses.list({ status: COURSE_STATUS.BORRADOR }),
            services.appointments.list({ status: APPOINTMENT_STATUS.PENDIENTE, from: today }),
          ])

          drafts.slice(0, 5).forEach((course) => {
            collected.push({
              id: `draft-${course.id}`,
              icon: GraduationCap,
              tone: 'text-gold-400',
              title: 'Curso pendiente de publicar',
              detail: course.title,
              to: '/admin/cursos',
            })
          })

          if (pending.length) {
            collected.unshift({
              id: 'pending-appointments',
              icon: CalendarClock,
              tone: 'text-amber-400',
              title: `${pending.length} citas sin confirmar`,
              detail: 'Revisa la lista de citas',
              to: '/admin/citas',
            })
          }
        }

        if (user.role === ROLES.CLIENTE) {
          const upcoming = await services.appointments.list({
            clientId: user.uid,
            status: [APPOINTMENT_STATUS.PENDIENTE, APPOINTMENT_STATUS.CONFIRMADA],
            from: today,
            to: addDays(today, 7),
          })

          upcoming.slice(0, 5).forEach((apt) => {
            collected.push({
              id: `next-${apt.id}`,
              icon: CalendarClock,
              tone: 'text-sky-400',
              title: 'Cita proxima',
              detail: `${formatRelativeDay(apt.date)} a las ${formatTime12(apt.startTime)}`,
              to: '/cliente/citas',
            })
          })
        }

        // Mensajes sin leer del chat de citas (barbero y cliente)
        if (user.role === ROLES.BARBERO || user.role === ROLES.CLIENTE) {
          const unread = await services.messages.unreadCounts({
            userId: user.uid,
            role: user.role,
          })
          const total = Object.values(unread).reduce((sum, n) => sum + n, 0)
          if (total) {
            collected.unshift({
              id: 'unread-messages',
              icon: MessageSquare,
              tone: 'text-gold-400',
              title: `${total} mensaje${total > 1 ? 's' : ''} sin leer`,
              detail: 'Abre la conversacion desde tus citas',
              to: user.role === ROLES.BARBERO ? '/barbero/citas' : '/cliente/citas',
            })
          }
        }
      } catch {
        // Las notificaciones son accesorias: si fallan, no molestamos
      }

      if (!cancelled) setItems(collected)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
        aria-label={`Notificaciones${items.length ? ` (${items.length})` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {items.length > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
          </span>
        )}
      </button>

      {open && (
        <>
          {/* En movil, capa para atenuar el fondo y cerrar al tocar fuera */}
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />

          <div
            className={cn(
              'z-50 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-panel animate-slide-up',
              // Movil: anclado al viewport, ancho casi completo, nunca se sale
              'fixed inset-x-3 top-[4.25rem]',
              // sm+: menu desplegable bajo la campana
              'sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:origin-top-right'
            )}
          >
            <div className="border-b border-ink-700/70 px-4 py-3">
              <p className="text-sm font-semibold text-ink-100">Notificaciones</p>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-ink-600" />
                <p className="mt-2 text-sm text-ink-400">Todo en orden, nada pendiente.</p>
              </div>
            ) : (
              <ul className="max-h-[65vh] divide-y divide-ink-800 overflow-y-auto sm:max-h-80">
                {items.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className="flex gap-3 px-4 py-3 transition hover:bg-ink-850"
                      >
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.tone}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink-100">{item.title}</span>
                          <span className="block truncate text-xs text-ink-400">{item.detail}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationBell
