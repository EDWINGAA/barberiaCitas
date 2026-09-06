import { useCallback } from 'react'
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  TrendingUp,
  UserX,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'

import { COURSE_STATUS } from '@/constants'
import { formatMoneyShort, formatPercent, occupancyRatio } from '@/utils/format'
import { formatShortDate } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import {
  Card,
  CardHeader,
  CourseStatusBadge,
  EmptyState,
  ErrorState,
  ProgressBar,
  SkeletonStats,
  StatCard,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * Estadisticas personales del barbero: rendimiento en citas y
 * resultados de los cursos que imparte.
 */
export default function BarberStats() {
  const { user } = useAuth()

  const loader = useCallback(() => services.stats.getBarberStats(user.uid), [user.uid])
  const { data: stats, loading, error, reload } = useAsync(loader, [user.uid])

  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <>
      <PageHeader
        title="Mis estadisticas"
        description="Tu rendimiento en la silla y en el aula, con datos reales de tu actividad."
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
            <h2 className="mb-4 text-lg font-semibold text-ink-100">Citas</h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Completadas"
                value={stats.completedCount}
                icon={CheckCircle2}
                accent="emerald"
                hint="historico total"
              />
              <StatCard
                label="Canceladas"
                value={stats.cancelledCount}
                icon={XCircle}
                hint="por cliente o por ti"
              />
              <StatCard
                label="Inasistencias"
                value={stats.noShowCount}
                icon={UserX}
                accent="rose"
                hint={`tasa del ${formatPercent(stats.noShowRate)}`}
              />
              <StatCard
                label="Proximas"
                value={stats.upcomingCount}
                icon={CalendarCheck}
                accent="sky"
                hint="pendientes o confirmadas"
              />
            </div>

            {/* Reparto visual entre completadas y no-shows */}
            <Card className="mt-4">
              <CardHeader
                title="Fiabilidad de tus clientes"
                subtitle="Proporcion de citas cerradas correctamente"
                icon={TrendingUp}
              />

              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-ink-300">Completadas</span>
                    <span className="text-emerald-400">{stats.completedCount}</span>
                  </div>
                  <ProgressBar
                    value={stats.completedCount}
                    max={Math.max(1, stats.completedCount + stats.noShowCount)}
                    color="bg-emerald-400"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-ink-300">No asistieron</span>
                    <span className="text-rose-400">{stats.noShowCount}</span>
                  </div>
                  <ProgressBar
                    value={stats.noShowCount}
                    max={Math.max(1, stats.completedCount + stats.noShowCount)}
                    color="bg-rose-400"
                  />
                </div>
              </div>
            </Card>
          </section>

          {/* ---------- Ingresos ---------- */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-ink-100">Ingresos generados</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Servicios (historico)"
                value={formatMoneyShort(stats.serviceRevenue)}
                icon={Wallet}
                hint="citas completadas"
              />
              <StatCard
                label="Servicios (este mes)"
                value={formatMoneyShort(stats.serviceRevenueMonth)}
                icon={CalendarDays}
                accent="sky"
              />
              <StatCard
                label="Cursos"
                value={formatMoneyShort(stats.courseRevenue)}
                icon={GraduationCap}
                accent="violet"
                hint={`${stats.studentCount} alumnos`}
              />
            </div>
          </section>

          {/* ---------- Cursos ---------- */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-ink-100">Escuela</h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Cursos creados" value={stats.courseCount} icon={GraduationCap} />
              <StatCard
                label="Activos"
                value={stats.publishedCourseCount}
                icon={CalendarCheck}
                accent="emerald"
              />
              <StatCard
                label="Finalizados"
                value={stats.finishedCourseCount}
                icon={CheckCircle2}
                accent="sky"
              />
              <StatCard
                label="Alumnos totales"
                value={stats.studentCount}
                icon={Users}
                accent="violet"
                hint="alumnos unicos"
              />
            </div>

            {/* Ocupacion por curso */}
            <Card className="mt-4">
              <CardHeader title="Ocupacion de tus cursos" icon={Users} />

              <div className="mt-5 space-y-4">
                {stats.courses.length === 0 ? (
                  <EmptyState
                    icon={GraduationCap}
                    title="Aun no has creado cursos"
                    description="Crea tu primer curso para ver aqui su ocupacion."
                    actionLabel="Crear curso"
                    to="/barbero/cursos/nuevo"
                    compact
                  />
                ) : (
                  stats.courses.map((course) => {
                    const ratio = occupancyRatio(course.enrolledCount, course.capacity)
                    return (
                      <div key={course.id}>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm text-ink-200">{course.title}</span>
                            <CourseStatusBadge status={course.status} size="xs" />
                          </div>
                          <span className="shrink-0 text-xs text-ink-400">
                            {course.enrolledCount} / {course.capacity} ({formatPercent(ratio, 0)})
                          </span>
                        </div>

                        <ProgressBar
                          value={course.enrolledCount}
                          max={Math.max(1, course.capacity)}
                          color={
                            ratio >= 1
                              ? 'bg-rose-400'
                              : ratio >= 0.7
                                ? 'bg-emerald-400'
                                : 'bg-gold-500'
                          }
                        />

                        <p className="mt-1 text-[11px] text-ink-500">
                          {formatShortDate(course.startDate)} - {formatShortDate(course.endDate)}
                          {course.status === COURSE_STATUS.FINALIZADO && ' · finalizado'}
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          </section>
        </div>
      )}
    </>
  )
}
