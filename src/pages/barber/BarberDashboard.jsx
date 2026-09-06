import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  UserX,
  Users,
  Wallet,
} from 'lucide-react'

import { APPOINTMENT_STATUS } from '@/constants'
import { firstName, formatMoneyShort, formatPercent } from '@/utils/format'
import { formatRelativeDay, formatShortDate, formatTimeRange, todayISO } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  SkeletonList,
  SkeletonStats,
  StatCard,
} from '@/components/ui'
import { AppointmentTimelineRow } from '@/components/appointments/AppointmentCard'

/**
 * Resumen del barbero: citas de hoy, carga de la semana, proximas
 * sesiones de curso y accesos rapidos.
 */
export default function BarberDashboard() {
  const { user } = useAuth()
  const toast = useToast()

  const loader = useCallback(async () => {
    const [stats, serviceList, clients] = await Promise.all([
      services.stats.getBarberStats(user.uid),
      services.services.list(),
      services.users.listClients(),
    ])
    return { stats, serviceList, clients }
  }, [user.uid])

  const { data, loading, error, reload } = useAsync(loader, [user.uid])

  const serviceById = useMemo(
    () => Object.fromEntries((data?.serviceList || []).map((s) => [s.id, s])),
    [data]
  )
  const clientById = useMemo(
    () => Object.fromEntries((data?.clients || []).map((c) => [c.uid, c])),
    [data]
  )

  const stats = data?.stats

  /** Confirma una cita pendiente directamente desde el resumen */
  async function confirmAppointment(id) {
    try {
      await services.appointments.setStatus(id, APPOINTMENT_STATUS.CONFIRMADA)
      toast.success('Cita confirmada.')
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos actualizar la cita.')
    }
  }

  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <div className="space-y-8">
      {/* ---------- Saludo ---------- */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-gold-500">{formatRelativeDay(todayISO())}</p>
          <h1 className="mt-1 font-display text-4xl tracking-wide text-ink-50">
            Buen dia, {firstName(user.name)}
          </h1>
        </div>
        <Button to="/barbero/agenda" variant="outline" icon={CalendarRange}>
          Ver mi agenda
        </Button>
      </header>

      {/* ---------- Metricas ---------- */}
      {loading ? (
        <SkeletonStats />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Citas hoy"
            value={stats.todayCount}
            icon={CalendarDays}
            hint={`${stats.weekCount} esta semana`}
          />
          <StatCard
            label="Completadas"
            value={stats.completedCount}
            icon={CheckCircle2}
            accent="emerald"
            hint="historico total"
          />
          <StatCard
            label="Tasa de no-show"
            value={formatPercent(stats.noShowRate)}
            icon={UserX}
            accent={stats.noShowRate > 0.15 ? 'rose' : 'sky'}
            hint={`${stats.noShowCount} inasistencias`}
          />
          <StatCard
            label="Ingresos del mes"
            value={formatMoneyShort(stats.serviceRevenueMonth)}
            icon={Wallet}
            accent="violet"
            hint="solo servicios completados"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- Agenda de hoy ---------- */}
        <section className="min-w-0 lg:col-span-2">
          <Card>
            <CardHeader
              title="Tu dia de hoy"
              subtitle={loading ? '' : `${stats.todayCount} citas programadas`}
              icon={CalendarCheck}
              action={
                <Link
                  to="/barbero/citas"
                  className="text-sm text-gold-400 transition hover:text-gold-300"
                >
                  Ver todas
                </Link>
              }
            />

            <div className="mt-5 space-y-2">
              {loading ? (
                <SkeletonList rows={3} />
              ) : stats.todayAppointments.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Hoy no tienes citas"
                  description="Aprovecha para afilar herramientas o preparar tu proximo curso."
                  compact
                />
              ) : (
                stats.todayAppointments.map((appointment) => (
                  <AppointmentTimelineRow
                    key={appointment.id}
                    appointment={appointment}
                    service={serviceById[appointment.serviceId]}
                    person={clientById[appointment.clientId]}
                    actions={
                      appointment.status === APPOINTMENT_STATUS.PENDIENTE ? (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => confirmAppointment(appointment.id)}
                        >
                          Confirmar
                        </Button>
                      ) : null
                    }
                  />
                ))
              )}
            </div>
          </Card>
        </section>

        {/* ---------- Cursos ---------- */}
        <section className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Proximas clases"
              subtitle="Sesiones de tus cursos"
              icon={GraduationCap}
            />

            <div className="mt-5 space-y-2">
              {loading ? (
                <SkeletonList rows={2} />
              ) : stats.upcomingSessions.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="Sin clases programadas"
                  description="Crea un curso para empezar a formar barberos."
                  actionLabel="Crear curso"
                  to="/barbero/cursos/nuevo"
                  compact
                />
              ) : (
                stats.upcomingSessions.slice(0, 5).map((session) => (
                  <Link
                    key={`${session.courseId}-${session.date}`}
                    to={`/barbero/cursos/${session.courseId}/inscritos`}
                    className="flex items-center gap-3 rounded-xl border border-ink-700/70 bg-ink-850 p-3 transition hover:border-gold-500/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-gold-500/10 text-gold-400">
                      <span className="text-[10px] uppercase leading-none">
                        {formatShortDate(session.date).split(' ')[1]}
                      </span>
                      <span className="text-sm font-bold leading-none">
                        {formatShortDate(session.date).split(' ')[0]}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-100">{session.courseTitle}</span>
                      <span className="block text-xs text-ink-500">
                        {formatTimeRange(session.startTime, session.endTime)}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Card>

          {/* Resumen de la escuela */}
          {!loading && (
            <Card>
              <CardHeader title="Tu escuela" icon={Users} />
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-400">Cursos publicados</dt>
                  <dd className="font-semibold text-ink-100">{stats.publishedCourseCount}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-400">Cursos finalizados</dt>
                  <dd className="font-semibold text-ink-100">{stats.finishedCourseCount}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-400">Alumnos totales</dt>
                  <dd className="font-semibold text-ink-100">{stats.studentCount}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-ink-800 pt-3">
                  <dt className="text-ink-400">Ingresos por cursos</dt>
                  <dd className="font-semibold text-gold-400">
                    {formatMoneyShort(stats.courseRevenue)}
                  </dd>
                </div>
              </dl>

              <Button to="/barbero/cursos" variant="ghost" size="sm" className="mt-4" iconRight={ArrowRight}>
                Gestionar cursos
              </Button>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
