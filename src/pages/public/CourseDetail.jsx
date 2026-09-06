import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  ListChecks,
  Lock,
  MapPin,
  Monitor,
  Users,
} from 'lucide-react'

import { COURSE_MODALITIES, COURSE_STATUS, ENROLLMENT_STATUS, ROLES, WEEKDAYS } from '@/constants'
import { capitalize, formatMoney } from '@/utils/format'
import { formatLongDate, formatShortDate, formatTime12, todayISO } from '@/utils/date'
import { getCourseSessions } from '@/utils/schedule'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  Avatar,
  Button,
  CapacityBar,
  Card,
  ConfirmDialog,
  CourseCover,
  CourseLevelBadge,
  CourseModalityBadge,
  CourseStatusBadge,
  EmptyState,
  FullPageLoader,
} from '@/components/ui'

/**
 * Ficha completa de un curso: temario, requisitos, perfil del instructor
 * y el bloque de inscripcion con todas sus reglas.
 */
export default function CourseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, isAuthenticated } = useAuth()

  const [confirming, setConfirming] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  const loader = useCallback(async () => {
    const course = await services.courses.get(id)
    if (!course) return { course: null }

    const [instructor, myEnrollments] = await Promise.all([
      services.users.get(course.instructorId),
      user?.uid ? services.enrollments.list({ courseId: id, clientId: user.uid }) : Promise.resolve([]),
    ])

    return {
      course,
      instructor,
      myEnrollment: myEnrollments.find((e) => e.status !== ENROLLMENT_STATUS.CANCELADO) || null,
    }
  }, [id, user?.uid])

  const { data, loading, reload } = useAsync(loader, [id, user?.uid])

  if (loading) return <FullPageLoader message="Cargando curso..." />

  if (!data?.course) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          icon={GraduationCap}
          title="Curso no encontrado"
          description="Puede que se haya cancelado o que el enlace no sea correcto."
          actionLabel="Ver todos los cursos"
          to="/cursos"
        />
      </div>
    )
  }

  const { course, instructor, myEnrollment } = data
  const sessions = getCourseSessions(course)
  const upcomingSessions = sessions.filter((s) => s.date >= todayISO())
  const isOnline = course.modality === COURSE_MODALITIES.ONLINE
  const isFull = course.enrolledCount >= course.capacity
  const hasStarted = course.startDate <= todayISO()
  const isOpen = [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(course.status)

  async function handleEnroll() {
    setEnrolling(true)
    try {
      await services.enrollments.enroll({ courseId: course.id, clientId: user.uid })
      toast.success('Inscripcion confirmada. Nos vemos en clase.')
      setConfirming(false)
      await reload()
    } catch (error) {
      toast.error(error?.message || 'No pudimos completar tu inscripcion.')
      setConfirming(false)
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <>
      {/* ---------- Portada ---------- */}
      <div className="relative">
        <CourseCover src={course.coverURL} title={course.title} className="h-64 w-full sm:h-80 lg:h-96" />

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <Link
              to="/cursos"
              className="mb-4 inline-flex items-center gap-2 text-sm text-ink-300 transition hover:text-gold-400"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al catalogo
            </Link>

            <div className="flex flex-wrap gap-2">
              <CourseLevelBadge level={course.level} />
              <CourseModalityBadge modality={course.modality} />
              {course.status === COURSE_STATUS.EN_CURSO && <CourseStatusBadge status={course.status} />}
            </div>

            <h1 className="mt-3 max-w-4xl font-display text-4xl leading-tight tracking-wide text-ink-50 sm:text-5xl">
              {course.title}
            </h1>
          </div>
        </div>
      </div>

      {/* ---------- Cuerpo ---------- */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* ===== Columna principal ===== */}
          <div className="space-y-8 lg:col-span-2">
            <Card>
              <h2 className="text-lg font-semibold text-ink-50">Sobre el curso</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-300">{course.description}</p>
            </Card>

            {/* Temario */}
            {course.syllabus?.length > 0 && (
              <Card>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-50">
                  <ListChecks className="h-5 w-5 text-gold-500/80" />
                  Temario
                </h2>
                <ol className="mt-4 space-y-3">
                  {course.syllabus.map((topic, index) => (
                    <li key={`${topic}-${index}`} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gold-500/10 text-xs font-semibold text-gold-400">
                        {index + 1}
                      </span>
                      <span className="pt-0.5 text-sm leading-relaxed text-ink-300">{topic}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}

            {/* Requisitos */}
            {course.requirements?.length > 0 && (
              <Card>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-50">
                  <BadgeCheck className="h-5 w-5 text-gold-500/80" />
                  Requisitos
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {course.requirements.map((requirement, index) => (
                    <li key={`${requirement}-${index}`} className="flex gap-3 text-sm text-ink-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/80" />
                      {requirement}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Instructor */}
            {instructor && (
              <Card>
                <h2 className="text-lg font-semibold text-ink-50">Tu instructor</h2>
                <div className="mt-4 flex flex-col gap-5 sm:flex-row">
                  <Avatar src={instructor.photoURL} name={instructor.name} size="2xl" ring />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-ink-100">{instructor.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-400">{instructor.bio}</p>
                    {instructor.specialties?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {instructor.specialties.map((specialty) => (
                          <span
                            key={specialty}
                            className="rounded-full bg-gold-500/10 px-2.5 py-1 text-[11px] font-medium text-gold-300 ring-1 ring-inset ring-gold-500/20"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Calendario de sesiones */}
            {sessions.length > 0 && (
              <Card>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-50">
                  <CalendarDays className="h-5 w-5 text-gold-500/80" />
                  Calendario de sesiones
                  <span className="ml-auto text-sm font-normal text-ink-400">
                    {sessions.length} sesiones
                  </span>
                </h2>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {sessions.map((session) => {
                    const isPast = session.date < todayISO()
                    return (
                      <div
                        key={session.date}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
                          isPast
                            ? 'border-ink-800 bg-ink-900/40 text-ink-600'
                            : 'border-ink-700 bg-ink-850 text-ink-200'
                        }`}
                      >
                        <span>{formatShortDate(session.date)}</span>
                        <span className="text-xs">
                          {formatTime12(session.startTime)} - {formatTime12(session.endTime)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* ===== Columna lateral: inscripcion ===== */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <Card className="p-6">
                <p className="font-display text-4xl text-gold-400">{formatMoney(course.price)}</p>
                <p className="mt-1 text-xs text-ink-500">Pago unico por el curso completo</p>

                <div className="mt-5">
                  <CapacityBar enrolled={course.enrolledCount} capacity={course.capacity} />
                </div>

                <dl className="mt-6 space-y-4 border-t border-ink-800 pt-6 text-sm">
                  <div className="flex gap-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gold-500/70" />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-ink-500">Fechas</dt>
                      <dd className="mt-0.5 text-ink-200">
                        {formatLongDate(course.startDate)}
                        <span className="block text-xs text-ink-400">
                          hasta {formatLongDate(course.endDate)}
                        </span>
                      </dd>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-500/70" />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-ink-500">Horario</dt>
                      <dd className="mt-0.5 text-ink-200">
                        {(course.schedule?.days || [])
                          .map((day) => capitalize(WEEKDAYS[day]))
                          .join(', ')}
                        <span className="block text-xs text-ink-400">
                          {formatTime12(course.schedule?.startTime)} a{' '}
                          {formatTime12(course.schedule?.endTime)}
                        </span>
                      </dd>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {isOnline ? (
                      <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-gold-500/70" />
                    ) : (
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500/70" />
                    )}
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-ink-500">
                        {isOnline ? 'Plataforma' : 'Lugar'}
                      </dt>
                      <dd className="mt-0.5 text-ink-200">{course.location || 'Por confirmar'}</dd>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-gold-500/70" />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-ink-500">Cupo</dt>
                      <dd className="mt-0.5 text-ink-200">{course.capacity} personas maximo</dd>
                    </div>
                  </div>
                </dl>

                {/* ---- Bloque de accion segun el estado del visitante ---- */}
                <div className="mt-6 border-t border-ink-800 pt-6">
                  <EnrollAction
                    course={course}
                    user={user}
                    isAuthenticated={isAuthenticated}
                    myEnrollment={myEnrollment}
                    isFull={isFull}
                    isOpen={isOpen}
                    hasStarted={hasStarted}
                    upcomingSessions={upcomingSessions}
                    onEnroll={() => setConfirming(true)}
                    onGoToMyCourses={() => navigate('/cliente/cursos')}
                  />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleEnroll}
        loading={enrolling}
        variant="primary"
        title="Confirmar inscripcion"
        message={`Vas a inscribirte en "${course.title}" por ${formatMoney(course.price)}. Podras cancelar sin costo antes del ${formatLongDate(course.startDate)}.`}
        confirmLabel="Si, inscribirme"
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Boton de inscripcion segun el contexto                             */
/* ------------------------------------------------------------------ */

function EnrollAction({
  course,
  user,
  isAuthenticated,
  myEnrollment,
  isFull,
  isOpen,
  hasStarted,
  upcomingSessions,
  onEnroll,
  onGoToMyCourses,
}) {
  // 1. Curso no disponible
  if (!isOpen) {
    return (
      <div className="rounded-xl bg-ink-850 p-4 text-center">
        <Lock className="mx-auto h-6 w-6 text-ink-500" />
        <p className="mt-2 text-sm text-ink-400">
          {course.status === COURSE_STATUS.FINALIZADO
            ? 'Este curso ya finalizo.'
            : course.status === COURSE_STATUS.CANCELADO
              ? 'Este curso fue cancelado.'
              : 'Este curso todavia no esta abierto a inscripciones.'}
        </p>
      </div>
    )
  }

  // 2. Ya inscrito
  if (myEnrollment) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-200">Ya estas inscrito</p>
            {upcomingSessions[0] && (
              <p className="mt-1 text-xs text-emerald-300/80">
                Proxima sesion: {formatShortDate(upcomingSessions[0].date)} a las{' '}
                {formatTime12(upcomingSessions[0].startTime)}
              </p>
            )}
          </div>
        </div>
        <Button fullWidth variant="outline" onClick={onGoToMyCourses}>
          Ver en mis cursos
        </Button>
      </div>
    )
  }

  // 3. Sin sesion iniciada
  if (!isAuthenticated) {
    return (
      <div className="space-y-3">
        <Button to="/registro" fullWidth size="lg" icon={GraduationCap}>
          Crear cuenta e inscribirme
        </Button>
        <p className="text-center text-xs text-ink-400">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="text-gold-400 hover:text-gold-300">
            Inicia sesion
          </Link>
        </p>
      </div>
    )
  }

  // 4. Barbero o administrador: no se inscriben como alumnos
  if (user.role !== ROLES.CLIENTE) {
    return (
      <div className="rounded-xl bg-ink-850 p-4 text-center text-sm text-ink-400">
        Las inscripciones son para cuentas de cliente. Gestiona este curso desde tu panel.
      </div>
    )
  }

  // 5. Cupo lleno
  if (isFull) {
    return (
      <div className="space-y-3">
        <Button fullWidth size="lg" disabled>
          Cupo lleno
        </Button>
        <p className="text-center text-xs text-ink-400">
          Este curso alcanzo su limite de {course.capacity} alumnos. Escribenos para entrar en lista
          de espera.
        </p>
      </div>
    )
  }

  // 6. Todo listo para inscribirse
  return (
    <div className="space-y-3">
      <Button fullWidth size="lg" onClick={onEnroll} icon={GraduationCap}>
        Inscribirme ahora
      </Button>
      <p className="text-center text-xs text-ink-400">
        {hasStarted
          ? 'El curso ya comenzo: te incorporas a las sesiones restantes.'
          : 'Cancelacion gratuita antes de la fecha de inicio.'}
      </p>
    </div>
  )
}
