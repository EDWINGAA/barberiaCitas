/**
 * Motor de disponibilidad.
 *
 * Son funciones PURAS: reciben los datos ya cargados y calculan huecos
 * y conflictos. Por eso las comparten tal cual la implementacion mock y
 * la de Firebase, garantizando que las validaciones se comportan igual
 * en los dos modos.
 */

import {
  SLOT_STEP_MINUTES,
  BLOCKING_APPOINTMENT_STATUS,
  BLOCKING_COURSE_STATUS,
  OPENING_HOURS_KEYS,
} from '@/constants'
import {
  addDays,
  addMinutes,
  buildTimeGrid,
  datesBetween,
  isWithin,
  overlaps,
  timeToMinutes,
  todayISO,
  nowTime,
  weekdayOf,
} from '@/utils/date'

/* ------------------------------------------------------------------ */
/*  Sesiones de curso                                                  */
/* ------------------------------------------------------------------ */

/**
 * Expande un curso en la lista concreta de sesiones que genera,
 * segun su rango de fechas y los dias de la semana de su horario.
 *
 * @returns {Array<{date:string,startTime:string,endTime:string}>}
 */
export function getCourseSessions(course) {
  if (!course?.startDate || !course?.endDate) return []
  const days = course.schedule?.days || []
  const startTime = course.schedule?.startTime
  const endTime = course.schedule?.endTime
  if (!days.length || !startTime || !endTime) return []

  return datesBetween(course.startDate, course.endDate)
    .filter((date) => days.includes(weekdayOf(date)))
    .map((date) => ({ date, startTime, endTime }))
}

/** Sesiones de un curso que caen exactamente en la fecha indicada */
export function getCourseSessionsOnDate(course, date) {
  const days = course?.schedule?.days || []
  if (!course?.startDate || !course?.endDate) return []
  if (!isWithin(date, course.startDate, course.endDate)) return []
  if (!days.includes(weekdayOf(date))) return []
  return [
    {
      date,
      startTime: course.schedule.startTime,
      endTime: course.schedule.endTime,
    },
  ]
}

/** Proximas sesiones de un curso a partir de hoy (limitadas en cantidad) */
export function getUpcomingSessions(course, limit = 5) {
  const today = todayISO()
  return getCourseSessions(course)
    .filter((s) => s.date >= today)
    .slice(0, limit)
}

/** Numero total de sesiones que tendra el curso */
export function countSessions(course) {
  return getCourseSessions(course).length
}

/* ------------------------------------------------------------------ */
/*  Intervalos ocupados                                                */
/* ------------------------------------------------------------------ */

/**
 * Construye la lista de intervalos ocupados de un barbero en una fecha.
 * Une tres fuentes: citas activas, bloqueos manuales y sesiones de curso.
 *
 * @param {object}   params
 * @param {string}   params.date          fecha "YYYY-MM-DD"
 * @param {Array}    params.appointments  citas del barbero (ya filtradas o no)
 * @param {Array}    params.blocks        bloqueos del barbero
 * @param {Array}    params.courses       cursos donde el barbero es instructor
 * @param {string}   [params.ignoreAppointmentId] cita a excluir (al reagendar)
 * @returns {Array<{start:string,end:string,type:string,label:string,refId:string}>}
 */
export function buildBusyIntervals({
  date,
  appointments = [],
  blocks = [],
  courses = [],
  ignoreAppointmentId = null,
}) {
  const busy = []

  // 1. Citas que realmente ocupan la silla
  appointments.forEach((apt) => {
    if (apt.date !== date) return
    if (apt.id === ignoreAppointmentId) return
    if (!BLOCKING_APPOINTMENT_STATUS.includes(apt.status)) return
    busy.push({
      start: apt.startTime,
      end: apt.endTime,
      type: 'cita',
      label: 'Cita agendada',
      refId: apt.id,
    })
  })

  // 2. Bloqueos manuales (descansos, dias libres...)
  blocks.forEach((block) => {
    if (block.date !== date) return
    busy.push({
      start: block.startTime,
      end: block.endTime,
      type: 'bloqueo',
      label: block.reason || 'Horario bloqueado',
      refId: block.id,
    })
  })

  // 3. Sesiones de cursos publicados o en curso que imparte el barbero
  courses.forEach((course) => {
    if (!BLOCKING_COURSE_STATUS.includes(course.status)) return
    getCourseSessionsOnDate(course, date).forEach((session) => {
      busy.push({
        start: session.startTime,
        end: session.endTime,
        type: 'curso',
        label: course.title,
        refId: course.id,
      })
    })
  })

  return busy.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
}

/** Primer intervalo ocupado que choca con [start, end), o null si esta libre */
export function findConflict(start, end, busy = []) {
  return busy.find((b) => overlaps(start, end, b.start, b.end)) || null
}

/* ------------------------------------------------------------------ */
/*  Horario del negocio                                                */
/* ------------------------------------------------------------------ */

/** Horario de apertura aplicable a una fecha, o null si el negocio cierra */
export function getOpeningForDate(openingHours, date) {
  const key = OPENING_HOURS_KEYS[weekdayOf(date)]
  const day = openingHours?.[key]
  if (!day || day.closed) return null
  if (!day.open || !day.close) return null
  return day
}

/**
 * Estado del local en este preciso momento.
 *
 * Devuelve si esta abierto, a que hora cierra, o cuando vuelve a abrir.
 * Se usa en la portada para mostrar un indicador vivo en lugar de un
 * horario estatico.
 *
 * @returns {{open:boolean, closesAt?:string, opensAt?:string, opensDay?:string}}
 */
export function getOpenStatus(openingHours, date = todayISO(), time = nowTime()) {
  const hoy = getOpeningForDate(openingHours, date)
  const ahora = timeToMinutes(time)

  if (hoy) {
    const abre = timeToMinutes(hoy.open)
    const cierra = timeToMinutes(hoy.close)

    if (ahora >= abre && ahora < cierra) return { open: true, closesAt: hoy.close }
    // Aun no ha abierto, pero abre hoy mismo
    if (ahora < abre) return { open: false, opensAt: hoy.open, opensDay: date }
  }

  // Ya cerro (o hoy no abre): se busca el proximo dia con horario
  for (let i = 1; i <= 7; i += 1) {
    const siguiente = addDays(date, i)
    const horario = getOpeningForDate(openingHours, siguiente)
    if (horario) return { open: false, opensAt: horario.open, opensDay: siguiente }
  }

  return { open: false }
}

/* ------------------------------------------------------------------ */
/*  Calculo de huecos disponibles                                      */
/* ------------------------------------------------------------------ */

/**
 * Devuelve todos los horarios de una fecha con su disponibilidad.
 * Cada elemento indica si el hueco esta libre y, si no, por que motivo.
 *
 * @returns {Array<{time:string,endTime:string,available:boolean,reason:string|null}>}
 */
export function computeSlots({
  date,
  durationMinutes,
  openingHours,
  appointments = [],
  blocks = [],
  courses = [],
  ignoreAppointmentId = null,
  step = SLOT_STEP_MINUTES,
}) {
  const opening = getOpeningForDate(openingHours, date)
  if (!opening) return []

  const busy = buildBusyIntervals({ date, appointments, blocks, courses, ignoreAppointmentId })
  const grid = buildTimeGrid(opening.open, opening.close, step, durationMinutes)

  const today = todayISO()
  const currentTime = nowTime()

  return grid.map((time) => {
    const endTime = addMinutes(time, durationMinutes)

    // No se puede agendar en el pasado
    if (date < today || (date === today && timeToMinutes(time) <= timeToMinutes(currentTime))) {
      return { time, endTime, available: false, reason: 'pasado' }
    }

    const conflict = findConflict(time, endTime, busy)
    if (conflict) {
      return { time, endTime, available: false, reason: conflict.type }
    }

    return { time, endTime, available: true, reason: null }
  })
}

/** Solo los horarios libres (lo que consume el asistente de reserva) */
export function computeAvailableSlots(params) {
  return computeSlots(params).filter((s) => s.available)
}
