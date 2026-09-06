import { Link } from 'react-router-dom'
import { CalendarDays, Clock, MapPin, Monitor, Users } from 'lucide-react'

import { COURSE_MODALITIES } from '@/constants'
import { formatMoneyShort, truncate } from '@/utils/format'
import { formatShortDate, formatTime12 } from '@/utils/date'
import { countSessions } from '@/utils/schedule'
import {
  Avatar,
  CapacityBar,
  CourseCover,
  CourseLevelBadge,
  CourseModalityBadge,
  CourseStatusBadge,
} from '@/components/ui'

/**
 * Tarjeta de curso para el catalogo publico y los listados de panel.
 *
 * @param {object}  course       documento del curso
 * @param {object}  instructor   perfil del barbero instructor (opcional)
 * @param {string}  to           destino del enlace
 * @param {boolean} showStatus   muestra el estado (paneles, no catalogo)
 * @param {node}    footer       acciones extra al pie
 */
export function CourseCard({ course, instructor, to, showStatus = false, footer }) {
  const sessions = countSessions(course)
  const isOnline = course.modality === COURSE_MODALITIES.ONLINE
  const href = to || `/cursos/${course.id}`

  const card = (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900 transition duration-200 hover:border-gold-500/40 hover:shadow-gold">
      {/* Portada con etiquetas superpuestas */}
      <CourseCover src={course.coverURL} title={course.title} className="h-44 shrink-0">
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <CourseLevelBadge level={course.level} />
          {showStatus && <CourseStatusBadge status={course.status} />}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
          <CourseModalityBadge modality={course.modality} />
          <span className="rounded-lg bg-ink-950/80 px-2.5 py-1 text-sm font-bold text-gold-400 backdrop-blur">
            {formatMoneyShort(course.price)}
          </span>
        </div>
      </CourseCover>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-ink-50 transition group-hover:text-gold-300">
          {course.title}
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-400">
          {truncate(course.description, 140)}
        </p>

        {/* Instructor */}
        {instructor && (
          <div className="mt-4 flex items-center gap-2.5">
            <Avatar src={instructor.photoURL} name={instructor.name} size="xs" />
            <span className="truncate text-xs text-ink-400">
              Imparte <span className="text-ink-200">{instructor.name}</span>
            </span>
          </div>
        )}

        {/* Datos rapidos */}
        <ul className="mt-4 space-y-2 text-xs text-ink-400">
          <li className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
            <span>
              {formatShortDate(course.startDate)} - {formatShortDate(course.endDate)}
              {sessions > 0 && ` · ${sessions} sesiones`}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
            <span>
              {formatTime12(course.schedule?.startTime)} a {formatTime12(course.schedule?.endTime)}
            </span>
          </li>
          <li className="flex items-center gap-2">
            {isOnline ? (
              <Monitor className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
            ) : (
              <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
            )}
            <span className="truncate">{course.location || (isOnline ? 'En linea' : 'En la barberia')}</span>
          </li>
        </ul>

        {/* Cupo, siempre al fondo de la tarjeta */}
        <div className="mt-auto pt-5">
          <CapacityBar enrolled={course.enrolledCount} capacity={course.capacity} />
        </div>

        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </article>
  )

  // Si hay pie con botones, no envolvemos en Link para no anidar acciones
  if (footer) return card

  return (
    <Link to={href} className="block h-full focus-visible:rounded-2xl">
      {card}
    </Link>
  )
}

/** Version compacta en una fila, para listados densos */
export function CourseRow({ course, instructor, to, actions }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-ink-700/70 bg-ink-900 p-4 sm:flex-row sm:items-center">
      <CourseCover
        src={course.coverURL}
        title={course.title}
        className="h-32 w-full shrink-0 rounded-xl sm:h-20 sm:w-32"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CourseStatusBadge status={course.status} size="xs" />
          <CourseLevelBadge level={course.level} size="xs" />
          <CourseModalityBadge modality={course.modality} size="xs" />
        </div>

        <h3 className="mt-2 truncate text-sm font-semibold text-ink-100">
          {to ? (
            <Link to={to} className="transition hover:text-gold-400">
              {course.title}
            </Link>
          ) : (
            course.title
          )}
        </h3>

        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatShortDate(course.startDate)} - {formatShortDate(course.endDate)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {course.enrolledCount} / {course.capacity}
          </span>
          {instructor && <span className="truncate">Imparte {instructor.name}</span>}
        </p>
      </div>

      <div className="w-full shrink-0 sm:w-40">
        <CapacityBar enrolled={course.enrolledCount} capacity={course.capacity} showLabel={false} />
        <p className="mt-2 text-right text-sm font-semibold text-gold-400">
          {formatMoneyShort(course.price)}
        </p>
      </div>

      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export default CourseCard
