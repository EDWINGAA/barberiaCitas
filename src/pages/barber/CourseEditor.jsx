import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Eye, GripVertical, Plus, Save, Trash2, X } from 'lucide-react'

import {
  COURSE_LEVELS,
  COURSE_LEVEL_LABELS,
  COURSE_MODALITIES,
  COURSE_MODALITY_LABELS,
  COURSE_STATUS,
  WEEKDAYS_SHORT,
} from '@/constants'
import { emptyCourseForm } from '@/models'
import { validateCourse } from '@/utils/validation'
import { addDays, todayISO } from '@/utils/date'
import { countSessions } from '@/utils/schedule'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useForm } from '@/hooks/useForm'
import {
  Button,
  Card,
  Field,
  FormError,
  FullPageLoader,
  ImageUpload,
  Input,
  PillGroup,
  Select,
  Textarea,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

const LEVEL_OPTIONS = Object.values(COURSE_LEVELS).map((value) => ({
  value,
  label: COURSE_LEVEL_LABELS[value],
}))

const MODALITY_OPTIONS = Object.values(COURSE_MODALITIES).map((value) => ({
  value,
  label: COURSE_MODALITY_LABELS[value],
}))

/**
 * Alta y edicion de un curso.
 * La misma pantalla sirve para crear (sin :id) y para editar (con :id).
 */
export default function CourseEditor() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()

  const [serverError, setServerError] = useState('')
  const [coverURL, setCoverURL] = useState('')
  const [syllabus, setSyllabus] = useState([''])
  const [requirements, setRequirements] = useState([''])
  const [schedule, setSchedule] = useState({ days: [], startTime: '16:00', endTime: '19:00' })

  /* ---------------- Carga en modo edicion ---------------- */
  const loader = useCallback(async () => {
    if (!isEdit) return null
    return services.courses.get(id)
  }, [id, isEdit])

  const { data: course, loading } = useAsync(loader, [id], { enabled: isEdit })

  const form = useForm(
    isEdit
      ? emptyCourseForm(user.uid)
      : {
          ...emptyCourseForm(user.uid),
          startDate: addDays(todayISO(), 14),
          endDate: addDays(todayISO(), 42),
        },
    (values) =>
      validateCourse({
        ...values,
        syllabus,
        requirements,
        schedule,
        enrolledCount: course?.enrolledCount || 0,
      })
  )

  // Al llegar el curso desde el servicio, se vuelca en el formulario
  useEffect(() => {
    if (!course) return
    form.reset({
      title: course.title,
      description: course.description,
      level: course.level,
      modality: course.modality,
      price: String(course.price),
      capacity: String(course.capacity),
      startDate: course.startDate,
      endDate: course.endDate,
      location: course.location,
      status: course.status,
    })
    setCoverURL(course.coverURL || '')
    setSyllabus(course.syllabus?.length ? course.syllabus : [''])
    setRequirements(course.requirements?.length ? course.requirements : [''])
    setSchedule({
      days: course.schedule?.days || [],
      startTime: course.schedule?.startTime || '16:00',
      endTime: course.schedule?.endTime || '19:00',
    })
    // Solo debe ejecutarse cuando llega el curso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course])

  /* ---------------- Guardado ---------------- */
  async function save(values, status) {
    setServerError('')

    const payload = {
      ...values,
      price: Number(values.price),
      capacity: Number(values.capacity),
      syllabus: syllabus.map((s) => s.trim()).filter(Boolean),
      requirements: requirements.map((r) => r.trim()).filter(Boolean),
      schedule,
      coverURL,
      instructorId: user.uid,
      status,
    }

    try {
      if (isEdit) {
        await services.courses.update(id, payload)
        toast.success('Curso actualizado.')
      } else {
        await services.courses.create(payload)
        toast.success(
          status === COURSE_STATUS.PUBLICADO
            ? 'Curso creado y publicado en el catalogo.'
            : 'Borrador guardado.'
        )
      }
      navigate('/barbero/cursos')
    } catch (error) {
      setServerError(error?.message || 'No pudimos guardar el curso.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const onSaveDraft = form.handleSubmit((values) =>
    save(values, isEdit ? values.status : COURSE_STATUS.BORRADOR)
  )
  const onPublish = form.handleSubmit((values) => save(values, COURSE_STATUS.PUBLICADO))

  if (isEdit && loading) return <FullPageLoader message="Cargando curso..." />

  const sessionCount = countSessions({
    startDate: form.values.startDate,
    endDate: form.values.endDate,
    schedule,
  })

  const isPresencial = form.values.modality === COURSE_MODALITIES.PRESENCIAL

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back="/barbero/cursos"
        backLabel="Volver a mis cursos"
        title={isEdit ? 'Editar curso' : 'Crear curso'}
        description={
          isEdit
            ? 'Los cambios se reflejan de inmediato en el catalogo si el curso esta publicado.'
            : 'Guarda como borrador para seguir puliendolo, o publicalo directamente.'
        }
      />

      <form className="space-y-6" noValidate onSubmit={(e) => e.preventDefault()}>
        <FormError message={serverError} />

        {/* ---------- Informacion basica ---------- */}
        <Card>
          <h2 className="text-base font-semibold text-ink-100">Informacion basica</h2>

          <div className="mt-5 space-y-4">
            <Input
              label="Titulo del curso"
              name="title"
              placeholder="Ej: Fundamentos del corte clasico"
              value={form.values.title}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.errorOf('title')}
              required
            />

            <Textarea
              label="Descripcion"
              name="description"
              rows={5}
              placeholder="Explica que van a aprender, para quien es y como se trabaja en clase."
              value={form.values.description}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.errorOf('description')}
              hint={`${form.values.description.length} caracteres`}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <PillGroup
                label="Nivel"
                value={form.values.level}
                onChange={(value) => form.setValue('level', value)}
                options={LEVEL_OPTIONS}
                error={form.errors.level}
              />
              <PillGroup
                label="Modalidad"
                value={form.values.modality}
                onChange={(value) => form.setValue('modality', value)}
                options={MODALITY_OPTIONS}
                error={form.errors.modality}
              />
            </div>
          </div>
        </Card>

        {/* ---------- Portada ---------- */}
        <Card>
          <h2 className="text-base font-semibold text-ink-100">Imagen de portada</h2>
          <p className="mt-1 text-sm text-ink-400">
            Es lo primero que ve el alumno en el catalogo. Usa una foto tuya trabajando.
          </p>

          <div className="mt-5 max-w-md">
            <ImageUpload
              label={null}
              value={coverURL}
              onChange={setCoverURL}
              path={`courses/${id || 'nuevo'}`}
              aspect="aspect-video"
              hint="Formato horizontal, JPG o PNG, maximo 8 MB"
            />
          </div>
        </Card>

        {/* ---------- Precio y cupo ---------- */}
        <Card>
          <h2 className="text-base font-semibold text-ink-100">Precio y cupo</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input
              label="Precio del curso"
              name="price"
              type="number"
              min={0}
              step={50}
              placeholder="2800"
              value={form.values.price}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.errorOf('price')}
              hint="En pesos, pago unico"
              required
            />

            <Input
              label="Cupo maximo"
              name="capacity"
              type="number"
              min={1}
              max={200}
              placeholder="12"
              value={form.values.capacity}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.errorOf('capacity')}
              hint={
                course?.enrolledCount
                  ? `Ya hay ${course.enrolledCount} inscritos`
                  : 'Numero maximo de alumnos'
              }
              required
            />
          </div>
        </Card>

        {/* ---------- Fechas y horario ---------- */}
        <Card>
          <h2 className="text-base font-semibold text-ink-100">Fechas y horario</h2>
          <p className="mt-1 text-sm text-ink-400">
            Las sesiones bloquearan tu agenda automaticamente al publicar el curso.
          </p>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha de inicio" htmlFor="startDate" error={form.errorOf('startDate')} required>
                <input
                  id="startDate"
                  type="date"
                  name="startDate"
                  min={todayISO()}
                  value={form.values.startDate}
                  onChange={form.handleChange}
                  className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
                />
              </Field>

              <Field label="Fecha de fin" htmlFor="endDate" error={form.errorOf('endDate')} required>
                <input
                  id="endDate"
                  type="date"
                  name="endDate"
                  min={form.values.startDate || todayISO()}
                  value={form.values.endDate}
                  onChange={form.handleChange}
                  className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
                />
              </Field>
            </div>

            {/* Dias de la semana */}
            <Field label="Dias de clase" error={form.errors.scheduleDays} required>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS_SHORT.map((label, index) => {
                  const active = schedule.days.includes(index)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setSchedule((prev) => ({
                          ...prev,
                          days: active
                            ? prev.days.filter((d) => d !== index)
                            : [...prev.days, index].sort(),
                        }))
                      }
                      className={`h-11 w-14 rounded-lg border text-sm font-medium transition ${
                        active
                          ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                          : 'border-ink-600 bg-ink-850 text-ink-400 hover:border-ink-500'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hora de inicio" htmlFor="scheduleStart" error={form.errors.scheduleStart} required>
                <input
                  id="scheduleStart"
                  type="time"
                  step={900}
                  value={schedule.startTime}
                  onChange={(e) => setSchedule((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
                />
              </Field>

              <Field label="Hora de fin" htmlFor="scheduleEnd" error={form.errors.scheduleEnd} required>
                <input
                  id="scheduleEnd"
                  type="time"
                  step={900}
                  value={schedule.endTime}
                  onChange={(e) => setSchedule((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
                />
              </Field>
            </div>

            {sessionCount > 0 && (
              <p className="rounded-xl bg-ink-850 px-4 py-3 text-sm text-ink-300">
                Con esta configuracion el curso tendra{' '}
                <span className="font-semibold text-gold-400">{sessionCount} sesiones</span>.
              </p>
            )}

            <Input
              label={isPresencial ? 'Lugar donde se imparte' : 'Plataforma o enlace'}
              name="location"
              placeholder={isPresencial ? 'Aula 1 - Insurgentes Sur 1425' : 'Zoom, Google Meet...'}
              value={form.values.location}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.errorOf('location')}
              required={isPresencial}
            />
          </div>
        </Card>

        {/* ---------- Temario ---------- */}
        <Card>
          <h2 className="text-base font-semibold text-ink-100">Temario</h2>
          <p className="mt-1 text-sm text-ink-400">Un punto por sesion o por bloque tematico.</p>

          <ListEditor
            items={syllabus}
            onChange={setSyllabus}
            placeholder="Ej: Sectorizacion y guias de corte"
            addLabel="Anadir tema"
            className="mt-5"
          />
        </Card>

        {/* ---------- Requisitos ---------- */}
        <Card>
          <h2 className="text-base font-semibold text-ink-100">Requisitos</h2>
          <p className="mt-1 text-sm text-ink-400">Que necesita traer o saber el alumno.</p>

          <ListEditor
            items={requirements}
            onChange={setRequirements}
            placeholder="Ej: Tijera propia"
            addLabel="Anadir requisito"
            className="mt-5"
          />
        </Card>

        {/* ---------- Estado (solo al editar) ---------- */}
        {isEdit && (
          <Card>
            <Select
              label="Estado del curso"
              name="status"
              value={form.values.status}
              onChange={form.handleChange}
              options={[
                { value: COURSE_STATUS.BORRADOR, label: 'Borrador (no visible)' },
                { value: COURSE_STATUS.PUBLICADO, label: 'Publicado (abierto a inscripciones)' },
                { value: COURSE_STATUS.EN_CURSO, label: 'En curso' },
                { value: COURSE_STATUS.FINALIZADO, label: 'Finalizado' },
                { value: COURSE_STATUS.CANCELADO, label: 'Cancelado' },
              ]}
              hint="Publicado y En curso son los unicos estados visibles en el catalogo."
            />
          </Card>
        )}

        {/* ---------- Acciones ---------- */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => navigate('/barbero/cursos')}>
            Cancelar
          </Button>

          <Button variant="outline" onClick={onSaveDraft} loading={form.submitting} icon={Save}>
            {isEdit ? 'Guardar cambios' : 'Guardar borrador'}
          </Button>

          {!isEdit && (
            <Button onClick={onPublish} loading={form.submitting} icon={Eye}>
              Guardar y publicar
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Editor de listas (temario y requisitos)                            */
/* ------------------------------------------------------------------ */

function ListEditor({ items, onChange, placeholder, addLabel, className = '' }) {
  function update(index, value) {
    const next = [...items]
    next[index] = value
    onChange(next)
  }

  function remove(index) {
    const next = items.filter((_, i) => i !== index)
    onChange(next.length ? next : [''])
  }

  function move(index, delta) {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className={className}>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              className="shrink-0 rounded-lg p-2 text-ink-500 transition hover:bg-ink-800 hover:text-ink-300 disabled:opacity-30"
              aria-label="Subir"
              title="Subir"
            >
              <GripVertical className="h-4 w-4" />
            </button>

            <span className="w-6 shrink-0 text-center text-xs text-ink-500">{index + 1}</span>

            <input
              type="text"
              value={item}
              onChange={(e) => update(index, e.target.value)}
              placeholder={placeholder}
              className="min-w-0 flex-1 rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-gold-500"
            />

            <button
              type="button"
              onClick={() => remove(index)}
              className="shrink-0 rounded-lg p-2 text-ink-500 transition hover:bg-rose-500/10 hover:text-rose-400"
              aria-label="Eliminar"
              title="Eliminar"
            >
              {items.length === 1 ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={Plus}
        className="mt-3"
        onClick={() => onChange([...items, ''])}
      >
        {addLabel}
      </Button>
    </div>
  )
}
