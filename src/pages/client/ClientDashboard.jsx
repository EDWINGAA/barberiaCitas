import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  Clock,
  GraduationCap,
  Scissors,
  Sparkles,
  Wallet,
} from 'lucide-react'

import { PUBLIC_COURSE_STATUS } from '@/constants'
import { firstName, formatMoneyShort } from '@/utils/format'
import { formatRelativeDay, formatShortDate, formatTime12, formatTimeRange } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SkeletonList,
  SkeletonStats,
  StatCard,
} from '@/components/ui'
import { CourseCard } from '@/components/courses/CourseCard'

/**
 * Panel de inicio del cliente: proxima cita, resumen de actividad,
 * proxima sesion de curso y sugerencias del catalogo.
 */
export default function ClientDashboard() {
  const { user } = useAuth()

  const loader = useCallback(async () => {
    const [stats, serviceList, barbers, courses] = await Promise.all([
      services.stats.getClientStats(user.uid),
      services.services.list(),
      services.users.listBarbers({ activeOnly: false }),
      services.courses.list({ publicOnly: true }),
    ])
    return { stats, serviceList, barbers, courses }
  }, [user.uid])

  const { data, loading, error, reload } = useAsync(loader, [user.uid])

  const serviceById = useMemo(
    () => Object.fromEntries((data?.serviceList || []).map((s) => [s.id, s])),
    [data]
  )
  const barberById = useMemo(
    () => Object.fromEntries((data?.barbers || []).map((b) => [b.uid, b])),
    [data]
  )

  const stats = data?.stats
  const next = stats?.nextAppointment
  const nextService = next ? serviceById[next.serviceId] : null
  const nextBarber = next ? barberById[next.barberId] : null

  const suggestions = (data?.courses || [])
    .filter((c) => PUBLIC_COURSE_STATUS.includes(c.status))
    .slice(0, 3)

  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <div className="space-y-8">
      {/* ---------- Saludo ---------- */}
      <header>
        <p className="text-sm text-gold-500">Hola de nuevo,</p>
        <h1 className="mt-1 font-display text-4xl tracking-wide text-ink-50">
          {firstName(user.name)}
        </h1>
      </header>

      {/* ---------- Proxima cita ---------- */}
      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-ink-850" />
      ) : next ? (
        <Card className="relative overflow-hidden border-gold-500/30 bg-gradient-to-br from-ink-900 to-ink-850 p-6">
          <div
            className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-500/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-400">
                <Sparkles className="h-3.5 w-3.5" />
                Tu proxima cita
              </p>

              <p className="mt-3 font-display text-3xl tracking-wide text-ink-50">
                {formatRelativeDay(next.date)} a las {formatTime12(next.startTime)}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-400">
                <span className="inline-flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-gold-500/70" />
                  {nextService?.name}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gold-500/70" />
                  {formatTimeRange(next.startTime, next.endTime)}
                </span>
              </div>

              {nextBarber && (
                <div className="mt-4 flex items-center gap-2.5">
                  <Avatar src={nextBarber.photoURL} name={nextBarber.name} size="sm" />
                  <span className="text-sm text-ink-300">
                    Te atiende <span className="text-ink-100">{nextBarber.name}</span>
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button to="/cliente/citas" variant="outline" size="sm" iconRight={ArrowRight}>
                Gestionar
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={CalendarPlus}
          title="No tienes ninguna cita agendada"
          description="Reserva tu proximo corte y elige el barbero que prefieras."
          actionLabel="Agendar ahora"
          to="/cliente/agendar"
        />
      )}

      {/* ---------- Metricas ---------- */}
      {loading ? (
        <SkeletonStats />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Cortes completados"
            value={stats.completedCount}
            icon={Scissors}
            hint="en total con nosotros"
          />
          <StatCard
            label="Invertido en tu imagen"
            value={formatMoneyShort(stats.totalSpent)}
            icon={Wallet}
            accent="emerald"
            hint="servicios completados"
          />
          <StatCard
            label="Cursos activos"
            value={stats.activeCourseCount}
            icon={GraduationCap}
            accent="sky"
            hint={`${stats.completedCourseCount} completados`}
          />
          <StatCard
            label="Citas proximas"
            value={stats.upcoming.length}
            icon={CalendarCheck}
            accent="violet"
            hint="pendientes o confirmadas"
          />
        </div>
      )}

      {/* ---------- Proxima sesion de curso ---------- */}
      {!loading && stats.nextSession && (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-sky-500/25 bg-sky-500/[0.04]">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-sky-400/80">Proxima clase</p>
              <p className="mt-0.5 text-sm font-medium text-ink-100">{stats.nextSession.courseTitle}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                {formatShortDate(stats.nextSession.date)} ·{' '}
                {formatTimeRange(stats.nextSession.startTime, stats.nextSession.endTime)}
              </p>
            </div>
          </div>
          <Button to="/cliente/cursos" variant="ghost" size="sm" iconRight={ArrowRight}>
            Mis cursos
          </Button>
        </Card>
      )}

      {/* ---------- Historial reciente ---------- */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink-100">Tu historial reciente</h2>
          <Link to="/cliente/citas" className="text-sm text-gold-400 transition hover:text-gold-300">
            Ver todo
          </Link>
        </div>

        {loading ? (
          <SkeletonList rows={3} />
        ) : stats.history.length === 0 ? (
          <Card className="py-8 text-center text-sm text-ink-400">
            Todavia no tienes visitas registradas.
          </Card>
        ) : (
          <div className="divide-y divide-ink-800 overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900">
            {stats.history.slice(0, 5).map((appointment) => (
              <div key={appointment.id} className="flex items-center gap-4 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-ink-400">
                  <Scissors className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-100">
                    {serviceById[appointment.serviceId]?.name || 'Servicio'}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {formatShortDate(appointment.date)} ·{' '}
                    {barberById[appointment.barberId]?.name || 'Barbero'}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-ink-400">
                  {formatMoneyShort(appointment.price)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Cursos sugeridos ---------- */}
      {suggestions.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink-100">Da el salto al otro lado</h2>
              <p className="mt-1 text-sm text-ink-400">Cursos abiertos en nuestra escuela.</p>
            </div>
            <Link to="/cursos" className="text-sm text-gold-400 transition hover:text-gold-300">
              Ver catalogo
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                instructor={barberById[course.instructorId]}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
