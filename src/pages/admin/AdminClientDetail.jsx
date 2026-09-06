import { useCallback, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CalendarDays,
  GraduationCap,
  Mail,
  Phone,
  Scissors,
  UserX,
  Wallet,
} from 'lucide-react'

import { APPOINTMENT_STATUS, ENROLLMENT_STATUS } from '@/constants'
import { formatMoney, formatMoneyShort, formatPhone } from '@/utils/format'
import { formatShortDate, formatTime12, formatTimestamp } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import {
  AppointmentStatusBadge,
  Avatar,
  Card,
  CardHeader,
  CourseStatusBadge,
  EmptyState,
  EnrollmentStatusBadge,
  ErrorState,
  FullPageLoader,
  PaymentStatusBadge,
  StatCard,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

/** Ficha completa de un cliente: sus citas y sus cursos. */
export default function AdminClientDetail() {
  const { id } = useParams()

  const loader = useCallback(async () => {
    const client = await services.users.get(id)
    if (!client) return { client: null }

    const [appointments, enrollments, serviceList, barbers] = await Promise.all([
      services.appointments.list({ clientId: id }),
      services.enrollments.list({ clientId: id }),
      services.services.list(),
      services.users.listBarbers({ activeOnly: false }),
    ])

    const courseIds = [...new Set(enrollments.map((e) => e.courseId))]
    const courses = await Promise.all(courseIds.map((cid) => services.courses.get(cid)))

    return {
      client,
      appointments,
      enrollments,
      serviceById: Object.fromEntries(serviceList.map((s) => [s.id, s])),
      barberById: Object.fromEntries(barbers.map((b) => [b.uid, b])),
      courseById: Object.fromEntries(courses.filter(Boolean).map((c) => [c.id, c])),
    }
  }, [id])

  const { data, loading, error, reload } = useAsync(loader, [id])

  const stats = useMemo(() => {
    if (!data?.appointments) return null
    const completed = data.appointments.filter((a) => a.status === APPOINTMENT_STATUS.COMPLETADA)
    const activeCourses = (data.enrollments || []).filter(
      (e) => e.status !== ENROLLMENT_STATUS.CANCELADO
    )
    const courseSpend = activeCourses.reduce(
      (sum, e) => sum + (Number(data.courseById[e.courseId]?.price) || 0),
      0
    )

    return {
      total: data.appointments.length,
      completed: completed.length,
      noShow: data.appointments.filter((a) => a.status === APPOINTMENT_STATUS.NO_SHOW).length,
      serviceSpend: completed.reduce((sum, a) => sum + (Number(a.price) || 0), 0),
      courseCount: activeCourses.length,
      courseSpend,
    }
  }, [data])

  if (loading) return <FullPageLoader message="Cargando ficha del cliente..." />
  if (error) return <ErrorState error={error} onRetry={reload} />

  if (!data?.client) {
    return (
      <EmptyState
        icon={UserX}
        title="Cliente no encontrado"
        description="La cuenta ya no existe o el enlace no es correcto."
        actionLabel="Volver a clientes"
        to="/admin/clientes"
      />
    )
  }

  const { client, appointments, enrollments, serviceById, barberById, courseById } = data

  return (
    <>
      <PageHeader
        back="/admin/clientes"
        backLabel="Volver a clientes"
        title={client.name}
        description={`Cliente desde ${formatTimestamp(client.createdAt).split(' ')[0]}.`}
      />

      {/* ---------- Ficha ---------- */}
      <Card className="mb-6 flex flex-wrap items-center gap-5">
        <Avatar src={client.photoURL} name={client.name} size="xl" ring />

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-ink-50">{client.name}</h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-400">
            <a
              href={`mailto:${client.email}`}
              className="inline-flex items-center gap-1.5 transition hover:text-gold-400"
            >
              <Mail className="h-4 w-4" />
              {client.email}
            </a>
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="inline-flex items-center gap-1.5 transition hover:text-gold-400"
              >
                <Phone className="h-4 w-4" />
                {formatPhone(client.phone)}
              </a>
            )}
          </div>
        </div>
      </Card>

      {/* ---------- Metricas ---------- */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Citas totales"
          value={stats.total}
          icon={CalendarDays}
          hint={`${stats.completed} completadas`}
        />
        <StatCard
          label="Inasistencias"
          value={stats.noShow}
          icon={UserX}
          accent={stats.noShow > 1 ? 'rose' : 'emerald'}
        />
        <StatCard
          label="Gasto en servicios"
          value={formatMoneyShort(stats.serviceSpend)}
          icon={Scissors}
          accent="emerald"
        />
        <StatCard
          label="Gasto en cursos"
          value={formatMoneyShort(stats.courseSpend)}
          icon={GraduationCap}
          accent="violet"
          hint={`${stats.courseCount} inscripciones`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- Citas ---------- */}
        <Card>
          <CardHeader title="Historial de citas" icon={Scissors} subtitle={`${appointments.length} en total`} />

          <div className="mt-5">
            {appointments.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Sin citas registradas" compact />
            ) : (
              <ul className="divide-y divide-ink-800">
                {appointments
                  .slice()
                  .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))
                  .map((appointment) => (
                    <li key={appointment.id} className="flex items-center gap-3 py-3">
                      <div className="w-20 shrink-0">
                        <p className="text-xs font-medium text-ink-200">
                          {formatShortDate(appointment.date)}
                        </p>
                        <p className="text-[11px] text-ink-500">
                          {formatTime12(appointment.startTime)}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink-100">
                          {serviceById[appointment.serviceId]?.name || 'Servicio'}
                        </p>
                        <p className="truncate text-xs text-ink-500">
                          {barberById[appointment.barberId]?.name || 'Barbero'}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <AppointmentStatusBadge status={appointment.status} size="xs" withDot={false} />
                        <p className="mt-1 text-xs text-gold-400">{formatMoney(appointment.price)}</p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </Card>

        {/* ---------- Cursos ---------- */}
        <Card>
          <CardHeader
            title="Cursos e inscripciones"
            icon={GraduationCap}
            subtitle={`${enrollments.length} en total`}
          />

          <div className="mt-5">
            {enrollments.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No se ha inscrito a ningun curso" compact />
            ) : (
              <ul className="divide-y divide-ink-800">
                {enrollments.map((enrollment) => {
                  const course = courseById[enrollment.courseId]
                  const attended = (enrollment.attendance || []).filter((a) => a.present).length

                  return (
                    <li key={enrollment.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink-100">
                            {course ? (
                              <Link
                                to={`/cursos/${course.id}`}
                                className="transition hover:text-gold-400"
                              >
                                {course.title}
                              </Link>
                            ) : (
                              'Curso eliminado'
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-500">
                            Inscrito el {formatTimestamp(enrollment.enrolledAt).split(' ')[0]} ·{' '}
                            {attended} asistencias
                          </p>
                        </div>

                        {course && (
                          <span className="shrink-0 text-sm text-gold-400">
                            {formatMoney(course.price)}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <EnrollmentStatusBadge status={enrollment.status} size="xs" />
                        <PaymentStatusBadge status={enrollment.paymentStatus} />
                        {course && <CourseStatusBadge status={course.status} size="xs" />}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
