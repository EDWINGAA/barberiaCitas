import { useCallback, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Search,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'

import { COURSE_STATUS, COURSE_STATUS_LABELS, ENROLLMENT_STATUS } from '@/constants'
import { formatMoneyShort, formatPercent, normalizeText, occupancyRatio } from '@/utils/format'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/context/ToastContext'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  SkeletonList,
  StatCard,
  Tabs,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { CourseRow } from '@/components/courses/CourseCard'

/**
 * Gestion global de cursos: el administrador puede publicar (aprobar),
 * despublicar, finalizar o cancelar cualquier curso, sea de quien sea.
 */
export default function AdminCourses() {
  const toast = useToast()

  const [tab, setTab] = useState('todos')
  const [search, setSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const [working, setWorking] = useState(false)

  const loader = useCallback(async () => {
    const [courses, barbers, enrollments] = await Promise.all([
      services.courses.list(),
      services.users.listBarbers({ activeOnly: false }),
      services.enrollments.list(),
    ])
    return { courses, barbers, enrollments }
  }, [])

  const { data, loading, error, reload } = useAsync(loader, [])

  const instructorById = useMemo(
    () => Object.fromEntries((data?.barbers || []).map((b) => [b.uid, b])),
    [data]
  )

  const counts = useMemo(() => {
    const rows = data?.courses || []
    return {
      todos: rows.length,
      borrador: rows.filter((c) => c.status === COURSE_STATUS.BORRADOR).length,
      publicados: rows.filter((c) =>
        [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(c.status)
      ).length,
      cerrados: rows.filter((c) =>
        [COURSE_STATUS.FINALIZADO, COURSE_STATUS.CANCELADO].includes(c.status)
      ).length,
    }
  }, [data])

  const filtered = useMemo(() => {
    let rows = data?.courses || []

    if (tab === 'borrador') rows = rows.filter((c) => c.status === COURSE_STATUS.BORRADOR)
    else if (tab === 'publicados')
      rows = rows.filter((c) => [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(c.status))
    else if (tab === 'cerrados')
      rows = rows.filter((c) =>
        [COURSE_STATUS.FINALIZADO, COURSE_STATUS.CANCELADO].includes(c.status)
      )

    if (search.trim()) {
      const q = normalizeText(search)
      rows = rows.filter(
        (c) =>
          normalizeText(c.title).includes(q) ||
          normalizeText(instructorById[c.instructorId]?.name || '').includes(q)
      )
    }

    return rows
  }, [data, tab, search, instructorById])

  const totals = useMemo(() => {
    const rows = data?.courses || []
    const enrollments = data?.enrollments || []
    const active = enrollments.filter((e) => e.status !== ENROLLMENT_STATUS.CANCELADO)
    const priceById = Object.fromEntries(rows.map((c) => [c.id, Number(c.price) || 0]))
    const open = rows.filter((c) =>
      [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(c.status)
    )

    return {
      enrollments: active.length,
      revenue: active.reduce((sum, e) => sum + (priceById[e.courseId] || 0), 0),
      avgOccupancy: open.length
        ? open.reduce((sum, c) => sum + occupancyRatio(c.enrolledCount, c.capacity), 0) / open.length
        : 0,
      openCount: open.length,
    }
  }, [data])

  async function runAction() {
    const { course, status } = confirmAction
    setWorking(true)
    try {
      await services.courses.setStatus(course.id, status)
      toast.success(`Curso marcado como ${COURSE_STATUS_LABELS[status].toLowerCase()}.`)
      setConfirmAction(null)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos actualizar el curso.')
    } finally {
      setWorking(false)
    }
  }

  async function setStatus(course, status) {
    try {
      await services.courses.setStatus(course.id, status)
      toast.success(
        status === COURSE_STATUS.PUBLICADO
          ? 'Curso aprobado y publicado en el catalogo.'
          : 'Curso devuelto a borrador.'
      )
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos actualizar el curso.')
    }
  }

  return (
    <>
      <PageHeader
        title="Cursos"
        description="Todos los cursos de la escuela. Aprueba borradores, edita el estado y consulta los inscritos."
      />

      {/* ---------- Resumen ---------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cursos abiertos" value={totals.openCount} icon={GraduationCap} />
        <StatCard label="Inscripciones" value={totals.enrollments} icon={Users} accent="sky" />
        <StatCard
          label="Ocupacion promedio"
          value={formatPercent(totals.avgOccupancy, 0)}
          icon={TrendingUp}
          accent="emerald"
          hint="de los cursos abiertos"
        />
        <StatCard
          label="Ingresos por cursos"
          value={formatMoneyShort(totals.revenue)}
          icon={Wallet}
          accent="violet"
          hint="inscripciones activas"
        />
      </div>

      <div className="mb-6 max-w-md">
        <Input
          placeholder="Buscar por titulo o instructor..."
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar cursos"
        />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'todos', label: 'Todos', count: counts.todos },
          { value: 'borrador', label: 'Por aprobar', count: counts.borrador },
          { value: 'publicados', label: 'Publicados', count: counts.publicados },
          { value: 'cerrados', label: 'Cerrados', count: counts.cerrados },
        ]}
        className="mb-6"
      />

      {loading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={
            tab === 'borrador'
              ? 'No hay cursos pendientes de aprobar'
              : 'Ningun curso coincide con el filtro'
          }
          description={
            tab === 'borrador'
              ? 'Cuando un barbero guarde un borrador, aparecera aqui para su revision.'
              : 'Prueba con otra pestana o cambia la busqueda.'
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              instructor={instructorById[course.instructorId]}
              to={`/cursos/${course.id}`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Users}
                    to={`/admin/cursos/${course.id}/inscritos`}
                  >
                    Inscritos
                  </Button>

                  {course.status === COURSE_STATUS.BORRADOR && (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Eye}
                      onClick={() => setStatus(course, COURSE_STATUS.PUBLICADO)}
                    >
                      Aprobar y publicar
                    </Button>
                  )}

                  {course.status === COURSE_STATUS.PUBLICADO && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={EyeOff}
                      onClick={() => setStatus(course, COURSE_STATUS.BORRADOR)}
                    >
                      Despublicar
                    </Button>
                  )}

                  {[COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(course.status) && (
                    <>
                      <Button
                        size="sm"
                        variant="success"
                        icon={CheckCircle2}
                        onClick={() =>
                          setConfirmAction({
                            course,
                            status: COURSE_STATUS.FINALIZADO,
                            title: 'Finalizar curso',
                            message: `Vas a marcar "${course.title}" como finalizado. Las ${course.enrolledCount} inscripciones activas pasaran a completadas.`,
                            confirmLabel: 'Finalizar',
                            variant: 'success',
                          })
                        }
                      >
                        Finalizar
                      </Button>

                      <Button
                        size="sm"
                        variant="dangerGhost"
                        icon={XCircle}
                        onClick={() =>
                          setConfirmAction({
                            course,
                            status: COURSE_STATUS.CANCELADO,
                            title: 'Cancelar curso',
                            message: `Vas a cancelar "${course.title}" de ${instructorById[course.instructorId]?.name || 'su instructor'}. Se cancelaran las ${course.enrolledCount} inscripciones activas y los pagos se marcaran para reembolso.`,
                            confirmLabel: 'Cancelar curso',
                            variant: 'danger',
                          })
                        }
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={runAction}
        loading={working}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmLabel={confirmAction?.confirmLabel}
        variant={confirmAction?.variant}
      />
    </>
  )
}
