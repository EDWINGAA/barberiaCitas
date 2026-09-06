import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  MapPin,
  Monitor,
  Search,
  XCircle,
} from 'lucide-react'

import { COURSE_MODALITIES, ENROLLMENT_STATUS } from '@/constants'
import { formatMoney } from '@/utils/format'
import { formatLongDate, formatShortDate, formatTime12, todayISO } from '@/utils/date'
import { getCourseSessions } from '@/utils/schedule'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  CourseCover,
  CourseLevelBadge,
  CourseStatusBadge,
  EmptyState,
  EnrollmentStatusBadge,
  ErrorState,
  PaymentStatusBadge,
  ProgressBar,
  SkeletonList,
  Tabs,
} from '@/components/ui'

/**
 * "Mis cursos": inscripciones activas con sus proximas sesiones,
 * y el historial de cursos completados o cancelados.
 */
export default function MyCourses() {
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('activos')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [working, setWorking] = useState(false)

  const loader = useCallback(async () => {
    const enrollments = await services.enrollments.list({ clientId: user.uid })
    const courseIds = [...new Set(enrollments.map((e) => e.courseId))]

    const [courses, barbers] = await Promise.all([
      Promise.all(courseIds.map((id) => services.courses.get(id))),
      services.users.listBarbers({ activeOnly: false }),
    ])

    return {
      enrollments,
      courseById: Object.fromEntries(courses.filter(Boolean).map((c) => [c.id, c])),
      barberById: Object.fromEntries(barbers.map((b) => [b.uid, b])),
    }
  }, [user.uid])

  const { data, loading, error, reload } = useAsync(loader, [user.uid])

  const { active, history } = useMemo(() => {
    const rows = data?.enrollments || []
    return {
      active: rows.filter((e) => e.status === ENROLLMENT_STATUS.INSCRITO),
      history: rows.filter((e) => e.status !== ENROLLMENT_STATUS.INSCRITO),
    }
  }, [data])

  const visible = tab === 'activos' ? active : history

  async function handleCancel() {
    setWorking(true)
    try {
      await services.enrollments.cancel(cancelTarget.enrollment.id)
      toast.success('Inscripcion cancelada.')
      setCancelTarget(null)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos cancelar la inscripcion.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-50">Mis cursos</h1>
          <p className="mt-1.5 text-sm text-ink-400">
            Tus inscripciones, las proximas sesiones y tu asistencia.
          </p>
        </div>
        <Button to="/cursos" variant="outline" icon={Search}>
          Explorar catalogo
        </Button>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'activos', label: 'Activos', count: active.length },
          { value: 'historial', label: 'Historial', count: history.length },
        ]}
        className="mb-6"
      />

      {loading ? (
        <SkeletonList rows={2} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={tab === 'activos' ? 'No estas inscrito en ningun curso' : 'Sin cursos en el historial'}
          description={
            tab === 'activos'
              ? 'Explora el catalogo y aprende el oficio con nuestros barberos.'
              : 'Aqui apareceran los cursos que completes o canceles.'
          }
          actionLabel={tab === 'activos' ? 'Ver cursos disponibles' : undefined}
          to={tab === 'activos' ? '/cursos' : undefined}
        />
      ) : (
        <div className="space-y-5">
          {visible.map((enrollment) => {
            const course = data.courseById[enrollment.courseId]
            if (!course) return null
            return (
              <EnrollmentCard
                key={enrollment.id}
                enrollment={enrollment}
                course={course}
                instructor={data.barberById[course.instructorId]}
                onCancel={() => setCancelTarget({ enrollment, course })}
              />
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={working}
        title="Cancelar inscripcion"
        message={
          cancelTarget
            ? `Vas a cancelar tu inscripcion en "${cancelTarget.course.title}". Tu lugar quedara libre para otra persona.`
            : ''
        }
        confirmLabel="Si, cancelar"
      />
    </>
  )
}

/* ================================================================== */
/*  Tarjeta de inscripcion                                             */
/* ================================================================== */

function EnrollmentCard({ enrollment, course, instructor, onCancel }) {
  const today = todayISO()
  const sessions = getCourseSessions(course)
  const pastSessions = sessions.filter((s) => s.date < today)
  const upcomingSessions = sessions.filter((s) => s.date >= today)

  const attended = (enrollment.attendance || []).filter((a) => a.present).length
  const progress = sessions.length ? (pastSessions.length / sessions.length) * 100 : 0

  const isActive = enrollment.status === ENROLLMENT_STATUS.INSCRITO
  const canCancel = isActive && course.startDate > today
  const isOnline = course.modality === COURSE_MODALITIES.ONLINE

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        {/* Portada */}
        <CourseCover
          src={course.coverURL}
          title={course.title}
          className="h-40 w-full shrink-0 lg:h-auto lg:w-56"
        />

        {/* Contenido */}
        <div className="min-w-0 flex-1 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <EnrollmentStatusBadge status={enrollment.status} size="xs" />
                <CourseStatusBadge status={course.status} size="xs" />
                <CourseLevelBadge level={course.level} size="xs" />
                <PaymentStatusBadge status={enrollment.paymentStatus} />
              </div>

              <h2 className="mt-2.5 text-base font-semibold text-ink-50">
                <Link to={`/cursos/${course.id}`} className="transition hover:text-gold-400">
                  {course.title}
                </Link>
              </h2>

              {instructor && (
                <div className="mt-2 flex items-center gap-2">
                  <Avatar src={instructor.photoURL} name={instructor.name} size="xs" />
                  <span className="text-xs text-ink-400">Imparte {instructor.name}</span>
                </div>
              )}
            </div>

            <span className="shrink-0 font-display text-2xl text-gold-400">
              {formatMoney(course.price)}
            </span>
          </div>

          {/* Datos del curso */}
          <ul className="mt-4 grid gap-2 text-xs text-ink-400 sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
              {formatLongDate(course.startDate)} al {formatShortDate(course.endDate)}
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
              {formatTime12(course.schedule?.startTime)} a {formatTime12(course.schedule?.endTime)}
            </li>
            <li className="flex items-center gap-2">
              {isOnline ? (
                <Monitor className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
              ) : (
                <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
              )}
              <span className="truncate">{course.location}</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
              {attended} de {pastSessions.length} sesiones asistidas
            </li>
          </ul>

          {/* Progreso del curso */}
          {sessions.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-ink-400">Avance del curso</span>
                <span className="text-ink-300">
                  {pastSessions.length} / {sessions.length} sesiones
                </span>
              </div>
              <ProgressBar value={progress} max={100} />
            </div>
          )}

          {/* Proximas sesiones */}
          {isActive && upcomingSessions.length > 0 && (
            <div className="mt-4 rounded-xl bg-ink-850 p-3">
              <p className="text-xs font-medium text-ink-200">Proximas sesiones</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {upcomingSessions.slice(0, 4).map((session) => (
                  <li
                    key={session.date}
                    className="rounded-lg bg-ink-800 px-2.5 py-1.5 text-[11px] text-ink-300"
                  >
                    {formatShortDate(session.date)} · {formatTime12(session.startTime)}
                  </li>
                ))}
                {upcomingSessions.length > 4 && (
                  <li className="px-2.5 py-1.5 text-[11px] text-ink-500">
                    +{upcomingSessions.length - 4} mas
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Acciones */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button to={`/cursos/${course.id}`} size="sm" variant="secondary">
              Ver detalle
            </Button>

            {canCancel && (
              <Button size="sm" variant="dangerGhost" icon={XCircle} onClick={onCancel}>
                Cancelar inscripcion
              </Button>
            )}

            {isActive && !canCancel && (
              <span className="self-center text-xs text-ink-500">
                El curso ya comenzo: la inscripcion no se puede cancelar.
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
