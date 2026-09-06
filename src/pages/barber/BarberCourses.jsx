import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'

import { COURSE_STATUS, COURSE_STATUS_LABELS } from '@/constants'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonList,
  Tabs,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { CourseRow } from '@/components/courses/CourseCard'

/**
 * Gestion de los cursos propios del barbero:
 * crear, editar, publicar/despublicar, finalizar y cancelar.
 */
export default function BarberCourses() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState('todos')
  const [confirmAction, setConfirmAction] = useState(null)
  const [working, setWorking] = useState(false)

  const loader = useCallback(
    () => services.courses.list({ instructorId: user.uid }),
    [user.uid]
  )
  const { data: courses, loading, error, reload } = useAsync(loader, [user.uid], { initialData: [] })

  const counts = useMemo(() => {
    const rows = courses || []
    return {
      todos: rows.length,
      borrador: rows.filter((c) => c.status === COURSE_STATUS.BORRADOR).length,
      activos: rows.filter((c) =>
        [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(c.status)
      ).length,
      cerrados: rows.filter((c) =>
        [COURSE_STATUS.FINALIZADO, COURSE_STATUS.CANCELADO].includes(c.status)
      ).length,
    }
  }, [courses])

  const visible = useMemo(() => {
    const rows = courses || []
    if (tab === 'borrador') return rows.filter((c) => c.status === COURSE_STATUS.BORRADOR)
    if (tab === 'activos')
      return rows.filter((c) => [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(c.status))
    if (tab === 'cerrados')
      return rows.filter((c) =>
        [COURSE_STATUS.FINALIZADO, COURSE_STATUS.CANCELADO].includes(c.status)
      )
    return rows
  }, [courses, tab])

  /** Ejecuta el cambio de estado o el borrado confirmado */
  async function runAction() {
    const { course, type, status } = confirmAction
    setWorking(true)
    try {
      if (type === 'delete') {
        await services.courses.remove(course.id)
        toast.success('Curso eliminado.')
      } else {
        await services.courses.setStatus(course.id, status)
        toast.success(`Curso marcado como ${COURSE_STATUS_LABELS[status].toLowerCase()}.`)
      }
      setConfirmAction(null)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos completar la accion.')
    } finally {
      setWorking(false)
    }
  }

  /** Cambio de estado directo, sin confirmacion (acciones no destructivas) */
  async function setStatus(course, status) {
    try {
      await services.courses.setStatus(course.id, status)
      toast.success(
        status === COURSE_STATUS.PUBLICADO
          ? 'Curso publicado. Ya aparece en el catalogo.'
          : 'Curso guardado como borrador. Ya no es visible al publico.'
      )
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos cambiar el estado del curso.')
    }
  }

  return (
    <>
      <PageHeader
        title="Mis cursos"
        description="Crea y administra los cursos que impartes. Los horarios de un curso publicado bloquean tu agenda automaticamente."
        actions={
          <Button onClick={() => navigate('/barbero/cursos/nuevo')} icon={Plus}>
            Crear curso
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'todos', label: 'Todos', count: counts.todos },
          { value: 'activos', label: 'Activos', count: counts.activos },
          { value: 'borrador', label: 'Borradores', count: counts.borrador },
          { value: 'cerrados', label: 'Cerrados', count: counts.cerrados },
        ]}
        className="mb-6"
      />

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={tab === 'todos' ? 'Todavia no has creado ningun curso' : 'Nada en esta pestana'}
          description={
            tab === 'todos'
              ? 'Comparte lo que sabes: crea tu primer curso y empieza a formar barberos.'
              : 'Prueba con otra pestana para ver el resto de tus cursos.'
          }
          actionLabel={tab === 'todos' ? 'Crear mi primer curso' : undefined}
          onAction={tab === 'todos' ? () => navigate('/barbero/cursos/nuevo') : undefined}
        />
      ) : (
        <div className="space-y-4">
          {visible.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              to={`/cursos/${course.id}`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Users}
                    to={`/barbero/cursos/${course.id}/inscritos`}
                  >
                    Inscritos
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Pencil}
                    to={`/barbero/cursos/${course.id}/editar`}
                  >
                    Editar
                  </Button>

                  {/* Publicar / despublicar */}
                  {course.status === COURSE_STATUS.BORRADOR && (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Eye}
                      onClick={() => setStatus(course, COURSE_STATUS.PUBLICADO)}
                    >
                      Publicar
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

                  {/* Finalizar */}
                  {[COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(course.status) && (
                    <Button
                      size="sm"
                      variant="success"
                      icon={CheckCircle2}
                      onClick={() =>
                        setConfirmAction({
                          course,
                          type: 'status',
                          status: COURSE_STATUS.FINALIZADO,
                          title: 'Finalizar curso',
                          message: `Vas a marcar "${course.title}" como finalizado. Las inscripciones activas pasaran a completadas.`,
                          confirmLabel: 'Finalizar',
                          variant: 'success',
                        })
                      }
                    >
                      Finalizar
                    </Button>
                  )}

                  {/* Cancelar o eliminar */}
                  {[COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(course.status) && (
                    <Button
                      size="sm"
                      variant="dangerGhost"
                      icon={XCircle}
                      onClick={() =>
                        setConfirmAction({
                          course,
                          type: 'status',
                          status: COURSE_STATUS.CANCELADO,
                          title: 'Cancelar curso',
                          message: `Vas a cancelar "${course.title}". Se cancelaran las ${course.enrolledCount} inscripciones activas y se marcaran para reembolso.`,
                          confirmLabel: 'Cancelar curso',
                          variant: 'danger',
                        })
                      }
                    >
                      Cancelar
                    </Button>
                  )}

                  {course.status === COURSE_STATUS.BORRADOR && course.enrolledCount === 0 && (
                    <Button
                      size="sm"
                      variant="dangerGhost"
                      icon={Trash2}
                      onClick={() =>
                        setConfirmAction({
                          course,
                          type: 'delete',
                          title: 'Eliminar curso',
                          message: `Vas a eliminar definitivamente el borrador "${course.title}". Esta accion no se puede deshacer.`,
                          confirmLabel: 'Eliminar',
                          variant: 'danger',
                        })
                      }
                    >
                      Eliminar
                    </Button>
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
