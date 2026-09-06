import { useCallback, useMemo, useState } from 'react'
import { GraduationCap, Search, SlidersHorizontal, X } from 'lucide-react'

import { COURSE_LEVELS, COURSE_LEVEL_LABELS, COURSE_MODALITIES, COURSE_MODALITY_LABELS } from '@/constants'
import { normalizeText } from '@/utils/format'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { Button, EmptyState, ErrorState, Input, SkeletonCourseGrid } from '@/components/ui'
import { PublicHeader } from '@/components/shared/PageHeader'
import { CourseCard } from '@/components/courses/CourseCard'

/** Filtros disponibles en el catalogo */
const LEVEL_OPTIONS = [
  { value: '', label: 'Todos los niveles' },
  ...Object.values(COURSE_LEVELS).map((value) => ({ value, label: COURSE_LEVEL_LABELS[value] })),
]

const MODALITY_OPTIONS = [
  { value: '', label: 'Presencial y online' },
  ...Object.values(COURSE_MODALITIES).map((value) => ({ value, label: COURSE_MODALITY_LABELS[value] })),
]

/**
 * Catalogo publico de cursos.
 * El filtrado se hace en cliente sobre la lista ya cargada: son pocos
 * cursos y asi la respuesta es instantanea.
 */
export default function CoursesCatalog() {
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('')
  const [modality, setModality] = useState('')

  const loader = useCallback(async () => {
    const [courses, barbers] = await Promise.all([
      services.courses.list({ publicOnly: true }),
      services.users.listBarbers({ activeOnly: false }),
    ])
    return { courses, barbers }
  }, [])

  const { data, loading, error, reload } = useAsync(loader, [])

  const instructorById = useMemo(
    () => Object.fromEntries((data?.barbers || []).map((b) => [b.uid, b])),
    [data]
  )

  const filtered = useMemo(() => {
    let rows = data?.courses || []
    if (level) rows = rows.filter((c) => c.level === level)
    if (modality) rows = rows.filter((c) => c.modality === modality)
    if (search.trim()) {
      const q = normalizeText(search)
      rows = rows.filter(
        (c) =>
          normalizeText(c.title).includes(q) ||
          normalizeText(c.description).includes(q) ||
          normalizeText(instructorById[c.instructorId]?.name || '').includes(q)
      )
    }
    return rows
  }, [data, level, modality, search, instructorById])

  const hasFilters = Boolean(search || level || modality)

  function clearFilters() {
    setSearch('')
    setLevel('')
    setModality('')
  }

  return (
    <>
      <PublicHeader
        eyebrow="La escuela"
        title="Cursos de barberia"
        description="Formacion practica impartida por los barberos que ves cada dia en la silla. Grupos pequenos, cupo limitado."
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ---------- Filtros ---------- */}
        <div className="mb-8 rounded-2xl border border-ink-700/70 bg-ink-900 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-200">
            <SlidersHorizontal className="h-4 w-4 text-gold-500/80" />
            Filtrar cursos
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Input
                placeholder="Buscar por titulo, tema o instructor..."
                icon={Search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar cursos"
              />
            </div>

            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              aria-label="Filtrar por nivel"
              className="w-full cursor-pointer rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
            >
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={modality}
              onChange={(e) => setModality(e.target.value)}
              aria-label="Filtrar por modalidad"
              className="w-full cursor-pointer rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
            >
              {MODALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-400">
                {filtered.length} curso{filtered.length === 1 ? '' : 's'} encontrado
                {filtered.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-xs text-gold-400 transition hover:text-gold-300"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* ---------- Resultados ---------- */}
        {loading ? (
          <SkeletonCourseGrid />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={hasFilters ? 'Ningun curso coincide con tu busqueda' : 'Aun no hay cursos publicados'}
            description={
              hasFilters
                ? 'Prueba a quitar algun filtro o busca con otras palabras.'
                : 'Estamos preparando las proximas generaciones. Vuelve pronto.'
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                instructor={instructorById[course.instructorId]}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
