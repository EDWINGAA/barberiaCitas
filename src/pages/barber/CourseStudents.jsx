import { useCallback, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  Download,
  Mail,
  Phone,
  Users,
  Wallet,
  X,
} from 'lucide-react'

import { ENROLLMENT_STATUS, PAYMENT_STATUS, PAYMENT_STATUS_LABELS, ROLES } from '@/constants'
import { formatMoney, formatMoneyShort, formatPhone } from '@/utils/format'
import { formatShortDate, formatTimestamp, todayISO } from '@/utils/date'
import { getCourseSessions } from '@/utils/schedule'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  Avatar,
  Badge,
  Button,
  CapacityBar,
  Card,
  CourseStatusBadge,
  EmptyState,
  EnrollmentStatusBadge,
  ErrorState,
  FullPageLoader,
  PaymentStatusBadge,
  Select,
  StatCard,
  Tabs,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * Lista de inscritos de un curso, con datos de contacto, estado de pago
 * y control de asistencia sesion a sesion.
 *
 * La usan tanto el barbero (sus cursos) como el administrador (todos).
 */
export default function CourseStudents() {
  const { id } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const toast = useToast()

  const isAdminView = location.pathname.startsWith('/admin')
  const backTo = isAdminView ? '/admin/cursos' : '/barbero/cursos'

  const [tab, setTab] = useState('inscritos')
  const [busyId, setBusyId] = useState(null)

  const loader = useCallback(async () => {
    const course = await services.courses.get(id)
    if (!course) return { course: null }

    const [enrollments, clients, instructor] = await Promise.all([
      services.enrollments.list({ courseId: id }),
      services.users.listClients(),
      services.users.get(course.instructorId),
    ])

    return {
      course,
      enrollments,
      instructor,
      clientById: Object.fromEntries(clients.map((c) => [c.uid, c])),
    }
  }, [id])

  const { data, loading, error, reload } = useAsync(loader, [id])

  const sessions = useMemo(
    () => (data?.course ? getCourseSessions(data.course) : []),
    [data]
  )
  const pastSessions = useMemo(() => sessions.filter((s) => s.date < todayISO()), [sessions])

  const { activeRows, cancelledRows } = useMemo(() => {
    const rows = data?.enrollments || []
    return {
      activeRows: rows.filter((e) => e.status !== ENROLLMENT_STATUS.CANCELADO),
      cancelledRows: rows.filter((e) => e.status === ENROLLMENT_STATUS.CANCELADO),
    }
  }, [data])

  const visible = tab === 'inscritos' ? activeRows : cancelledRows

  /* ---------------- Acciones ---------------- */

  async function toggleAttendance(enrollment, date, present) {
    setBusyId(`${enrollment.id}-${date}`)
    try {
      await services.enrollments.setAttendance(enrollment.id, date, present)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos registrar la asistencia.')
    } finally {
      setBusyId(null)
    }
  }

  async function changePayment(enrollment, paymentStatus) {
    setBusyId(enrollment.id)
    try {
      await services.enrollments.setPaymentStatus(enrollment.id, paymentStatus)
      toast.success('Estado de pago actualizado.')
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos actualizar el pago.')
    } finally {
      setBusyId(null)
    }
  }

  /** Exporta la lista de inscritos a CSV, util para pasar lista en papel */
  function exportCSV() {
    const header = ['Nombre', 'Correo', 'Telefono', 'Estado', 'Pago', 'Asistencias']
    const lines = activeRows.map((enrollment) => {
      const client = data.clientById[enrollment.clientId] || {}
      const attended = (enrollment.attendance || []).filter((a) => a.present).length
      return [
        client.name || '',
        client.email || '',
        client.phone || '',
        enrollment.status,
        enrollment.paymentStatus,
        `${attended}/${pastSessions.length}`,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    })

    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inscritos-${data.course.title.toLowerCase().replace(/\s+/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Lista descargada.')
  }

  if (loading) return <FullPageLoader message="Cargando inscritos..." />
  if (error) return <ErrorState error={error} onRetry={reload} />

  if (!data?.course) {
    return (
      <EmptyState
        icon={Users}
        title="Curso no encontrado"
        description="El curso ya no existe o no tienes acceso a el."
        actionLabel="Volver"
        to={backTo}
      />
    )
  }

  const { course, clientById, instructor } = data

  // Un barbero solo puede gestionar sus propios cursos
  const isOwner = course.instructorId === user.uid
  if (!isOwner && user.role !== ROLES.ADMIN) {
    return (
      <EmptyState
        icon={Users}
        title="Este curso no es tuyo"
        description="Solo puedes ver los inscritos de los cursos que impartes."
        actionLabel="Volver a mis cursos"
        to="/barbero/cursos"
      />
    )
  }

  const paidCount = activeRows.filter((e) => e.paymentStatus === PAYMENT_STATUS.PAGADO).length
  const revenue = activeRows.length * (Number(course.price) || 0)

  return (
    <>
      <PageHeader
        back={backTo}
        backLabel={isAdminView ? 'Volver a cursos' : 'Volver a mis cursos'}
        title={course.title}
        description={`Inscritos, contacto y control de asistencia.${instructor ? ` Imparte ${instructor.name}.` : ''}`}
        actions={
          activeRows.length > 0 && (
            <Button variant="secondary" icon={Download} onClick={exportCSV}>
              Descargar CSV
            </Button>
          )
        }
      />

      {/* ---------- Resumen ---------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Inscritos" value={`${activeRows.length} / ${course.capacity}`} icon={Users} />
        <StatCard
          label="Pagos confirmados"
          value={`${paidCount} / ${activeRows.length}`}
          icon={Wallet}
          accent="emerald"
        />
        <StatCard
          label="Ingresos del curso"
          value={formatMoneyShort(revenue)}
          icon={Wallet}
          accent="violet"
          hint={`${formatMoney(course.price)} por alumno`}
        />
        <StatCard
          label="Sesiones impartidas"
          value={`${pastSessions.length} / ${sessions.length}`}
          icon={CheckCircle2}
          accent="sky"
        />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CourseStatusBadge status={course.status} />
            <span className="text-sm text-ink-400">
              {formatShortDate(course.startDate)} - {formatShortDate(course.endDate)}
            </span>
          </div>
          <div className="w-full sm:w-64">
            <CapacityBar enrolled={activeRows.length} capacity={course.capacity} />
          </div>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'inscritos', label: 'Inscritos', count: activeRows.length },
          { value: 'cancelados', label: 'Cancelados', count: cancelledRows.length },
        ]}
        className="mb-6"
      />

      {/* ---------- Lista ---------- */}
      {visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tab === 'inscritos' ? 'Todavia no hay inscritos' : 'Ninguna cancelacion'}
          description={
            tab === 'inscritos'
              ? 'Cuando alguien se inscriba, veras aqui sus datos y podras pasar lista.'
              : 'Nadie ha cancelado su inscripcion en este curso.'
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((enrollment) => {
            const client = clientById[enrollment.clientId] || {}
            const attendance = enrollment.attendance || []
            const attended = attendance.filter((a) => a.present).length

            return (
              <Card key={enrollment.id}>
                {/* Cabecera del alumno */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={client.photoURL} name={client.name} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-100">
                        {client.name || 'Alumno'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                        {client.email && (
                          <a
                            href={`mailto:${client.email}`}
                            className="inline-flex items-center gap-1.5 transition hover:text-gold-400"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {client.email}
                          </a>
                        )}
                        {client.phone && (
                          <a
                            href={`tel:${client.phone}`}
                            className="inline-flex items-center gap-1.5 transition hover:text-gold-400"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {formatPhone(client.phone)}
                          </a>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-ink-600">
                        Inscrito el {formatTimestamp(enrollment.enrolledAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <EnrollmentStatusBadge status={enrollment.status} />
                    <PaymentStatusBadge status={enrollment.paymentStatus} />
                  </div>
                </div>

                {/* Control de asistencia y pago */}
                {enrollment.status !== ENROLLMENT_STATUS.CANCELADO && (
                  <div className="mt-5 space-y-4 border-t border-ink-800 pt-5">
                    {pastSessions.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                            Asistencia
                          </p>
                          <Badge size="xs">
                            {attended} de {pastSessions.length}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {pastSessions.map((session) => {
                            const record = attendance.find((a) => a.date === session.date)
                            const present = record?.present === true
                            const absent = record?.present === false
                            const busy = busyId === `${enrollment.id}-${session.date}`

                            return (
                              <button
                                key={session.date}
                                type="button"
                                disabled={busy}
                                onClick={() => toggleAttendance(enrollment, session.date, !present)}
                                title={`${formatShortDate(session.date)} - ${
                                  present ? 'Asistio' : absent ? 'Falto' : 'Sin registrar'
                                }`}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                                  present
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                    : absent
                                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                                      : 'border-ink-600 bg-ink-850 text-ink-400 hover:border-ink-500'
                                }`}
                              >
                                {present ? (
                                  <Check className="h-3 w-3" />
                                ) : absent ? (
                                  <X className="h-3 w-3" />
                                ) : null}
                                {formatShortDate(session.date)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="max-w-xs">
                      <Select
                        label="Estado de pago"
                        value={enrollment.paymentStatus}
                        disabled={busyId === enrollment.id}
                        onChange={(e) => changePayment(enrollment, e.target.value)}
                        options={Object.values(PAYMENT_STATUS).map((value) => ({
                          value,
                          label: PAYMENT_STATUS_LABELS[value],
                        }))}
                      />
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
