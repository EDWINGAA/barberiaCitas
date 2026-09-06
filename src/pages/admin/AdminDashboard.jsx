import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  Scissors,
  TrendingUp,
  UserX,
  Users,
  Wallet,
} from 'lucide-react'

import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_STYLES } from '@/constants'
import { cn, formatMoneyShort, formatNumber, formatPercent } from '@/utils/format'
import { formatLongDate, formatTime12, todayISO } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import {
  Avatar,
  Card,
  CardHeader,
  CourseStatusBadge,
  EmptyState,
  ErrorState,
  ProgressBar,
  SkeletonList,
  SkeletonStats,
  StatCard,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * Tablero del administrador.
 * Reune las metricas del negocio: volumen de citas, ingresos estimados,
 * tasa de no-show, ranking de barberos y servicios, y salud de la escuela.
 */
export default function AdminDashboard() {
  const loader = useCallback(async () => {
    const [stats, serviceList, clients] = await Promise.all([
      services.stats.getAdminStats(),
      services.services.list(),
      services.users.listClients(),
    ])
    return { stats, serviceList, clients }
  }, [])

  const { data, loading, error, reload } = useAsync(loader, [])

  const serviceById = useMemo(
    () => Object.fromEntries((data?.serviceList || []).map((s) => [s.id, s])),
    [data]
  )
  const clientById = useMemo(
    () => Object.fromEntries((data?.clients || []).map((c) => [c.uid, c])),
    [data]
  )

  const stats = data?.stats

  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <>
      <PageHeader
        title="Tablero general"
        description={`Resumen del negocio al ${formatLongDate(todayISO())}.`}
      />

      {loading ? (
        <div className="space-y-6">
          <SkeletonStats />
          <SkeletonStats />
        </div>
      ) : (
        <div className="space-y-8">
          {/* ---------- Citas ---------- */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-ink-100">Actividad de citas</h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Citas hoy"
                value={stats.todayCount}
                icon={CalendarDays}
                hint={`${stats.pendingCount} sin confirmar`}
              />
              <StatCard
                label="Esta semana"
                value={stats.weekCount}
                icon={CalendarRange}
                accent="sky"
              />
              <StatCard
                label="Este mes"
                value={stats.monthCount}
                icon={TrendingUp}
                accent="violet"
              />
              <StatCard
                label="Tasa de no-show"
                value={formatPercent(stats.noShowRate)}
                icon={UserX}
                accent={stats.noShowRate > 0.15 ? 'rose' : 'emerald'}
                hint={`${stats.noShowCount} en 30 dias`}
              />
            </div>
          </section>

          {/* ---------- Ingresos ---------- */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-ink-100">Ingresos estimados del mes</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Servicios"
                value={formatMoneyShort(stats.serviceRevenueMonth)}
                icon={Scissors}
                hint="citas completadas"
              />
              <StatCard
                label="Cursos"
                value={formatMoneyShort(stats.courseRevenueMonth)}
                icon={GraduationCap}
                accent="violet"
                hint="inscripciones del mes"
              />
              <StatCard
                label="Total"
                value={formatMoneyShort(stats.totalRevenueMonth)}
                icon={Wallet}
                accent="emerald"
                hint="servicios + cursos"
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* ---------- Barberos mas productivos ---------- */}
            <Card>
              <CardHeader
                title="Barberos mas productivos"
                subtitle="Citas completadas este mes"
                icon={Users}
                action={
                  <Link to="/admin/barberos" className="text-sm text-gold-400 hover:text-gold-300">
                    Gestionar
                  </Link>
                }
              />

              <div className="mt-5 space-y-4">
                {stats.topBarbers.length === 0 ? (
                  <EmptyState icon={Users} title="Sin barberos registrados" compact />
                ) : (
                  stats.topBarbers.map((barber, index) => {
                    const max = Math.max(1, stats.topBarbers[0].completed)
                    return (
                      <div key={barber.uid} className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold',
                            index === 0
                              ? 'bg-gold-500/20 text-gold-400'
                              : 'bg-ink-800 text-ink-500'
                          )}
                        >
                          {index + 1}
                        </span>
                        <Avatar src={barber.photoURL} name={barber.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm text-ink-100">{barber.name}</p>
                            <p className="shrink-0 text-xs text-ink-400">
                              {barber.completed} citas · {formatMoneyShort(barber.revenue)}
                            </p>
                          </div>
                          <ProgressBar value={barber.completed} max={max} className="mt-1.5 h-1.5" />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>

            {/* ---------- Servicios mas vendidos ---------- */}
            <Card>
              <CardHeader
                title="Servicios mas vendidos"
                subtitle="Este mes"
                icon={Scissors}
                action={
                  <Link to="/admin/servicios" className="text-sm text-gold-400 hover:text-gold-300">
                    Gestionar
                  </Link>
                }
              />

              <div className="mt-5 space-y-4">
                {stats.topServices.length === 0 ? (
                  <EmptyState icon={Scissors} title="Sin ventas este mes" compact />
                ) : (
                  stats.topServices.slice(0, 6).map((service, index) => {
                    const max = Math.max(1, stats.topServices[0].count)
                    return (
                      <div key={service.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="text-xs text-ink-500">{index + 1}.</span>
                            <span className="truncate text-sm text-ink-200">{service.name}</span>
                          </span>
                          <span className="shrink-0 text-xs text-ink-400">
                            {service.count} · {formatMoneyShort(service.revenue)}
                          </span>
                        </div>
                        <ProgressBar value={service.count} max={max} className="h-1.5" />
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          </div>

          {/* ---------- Escuela ---------- */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-ink-100">Escuela</h2>

            <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Cursos activos"
                value={stats.activeCourseCount}
                icon={GraduationCap}
                hint={`${stats.draftCourseCount} en borrador`}
              />
              <StatCard
                label="Inscripciones"
                value={formatNumber(stats.totalEnrollments)}
                icon={Users}
                accent="sky"
              />
              <StatCard
                label="Ocupacion promedio"
                value={formatPercent(stats.avgOccupancy, 0)}
                icon={TrendingUp}
                accent="emerald"
                hint="de los cursos abiertos"
              />
              <StatCard
                label="Clientes registrados"
                value={formatNumber(stats.clientCount)}
                icon={Users}
                accent="violet"
              />
            </div>

            <Card>
              <CardHeader
                title="Cursos con mas inscritos"
                icon={GraduationCap}
                action={
                  <Link to="/admin/cursos" className="text-sm text-gold-400 hover:text-gold-300">
                    Ver todos
                  </Link>
                }
              />

              <div className="mt-5 space-y-4">
                {stats.topCourses.length === 0 ? (
                  <EmptyState icon={GraduationCap} title="Aun no hay cursos" compact />
                ) : (
                  stats.topCourses.slice(0, 5).map((course) => (
                    <div key={course.id}>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm text-ink-200">{course.title}</span>
                          <CourseStatusBadge status={course.status} size="xs" />
                        </span>
                        <span className="shrink-0 text-xs text-ink-400">
                          {course.enrolled} / {course.capacity} ·{' '}
                          {formatMoneyShort(course.revenue)}
                        </span>
                      </div>
                      <ProgressBar
                        value={course.enrolled}
                        max={Math.max(1, course.capacity)}
                        className="h-1.5"
                        color={course.occupancy >= 1 ? 'bg-rose-400' : 'bg-gold-500'}
                      />
                    </div>
                  ))
                )}
              </div>
            </Card>
          </section>

          {/* ---------- Citas de hoy ---------- */}
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="text-lg font-semibold text-ink-100">Citas de hoy</h2>
              <Link to="/admin/citas" className="text-sm text-gold-400 hover:text-gold-300">
                Ver todas
              </Link>
            </div>

            {loading ? (
              <SkeletonList rows={3} />
            ) : stats.todayAppointments.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Hoy no hay citas agendadas"
                description="Un dia tranquilo. Aprovecha para revisar la configuracion del negocio."
                compact
              />
            ) : (
              <div className="divide-y divide-ink-800 overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900">
                {stats.todayAppointments
                  .slice()
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((appointment) => (
                    <div key={appointment.id} className="flex items-center gap-4 p-4">
                      <span className="w-16 shrink-0 text-sm font-semibold text-ink-100">
                        {formatTime12(appointment.startTime)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink-100">
                          {clientById[appointment.clientId]?.name || 'Cliente'}
                        </p>
                        <p className="truncate text-xs text-ink-500">
                          {serviceById[appointment.serviceId]?.name}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
                          APPOINTMENT_STATUS_STYLES[appointment.status]?.badge
                        )}
                      >
                        {APPOINTMENT_STATUS_LABELS[appointment.status]}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* ---------- Avisos ---------- */}
          {(stats.pendingCount > 0 || stats.draftCourseCount > 0) && (
            <Card className="border-amber-500/25 bg-amber-500/[0.04]">
              <div className="flex gap-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-amber-200">Requiere tu atencion</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-300">
                    {stats.pendingCount > 0 && (
                      <li className="flex items-center justify-between gap-4">
                        <span>{stats.pendingCount} citas futuras sin confirmar</span>
                        <Link
                          to="/admin/citas"
                          className="inline-flex shrink-0 items-center gap-1 text-xs text-gold-400 hover:text-gold-300"
                        >
                          Revisar <ArrowRight className="h-3 w-3" />
                        </Link>
                      </li>
                    )}
                    {stats.draftCourseCount > 0 && (
                      <li className="flex items-center justify-between gap-4">
                        <span>{stats.draftCourseCount} cursos en borrador esperando publicacion</span>
                        <Link
                          to="/admin/cursos"
                          className="inline-flex shrink-0 items-center gap-1 text-xs text-gold-400 hover:text-gold-300"
                        >
                          Revisar <ArrowRight className="h-3 w-3" />
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
