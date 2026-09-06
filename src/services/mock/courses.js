/**
 * Colecciones "courses" y "enrollments" en MODO DEMO.
 *
 * Reglas de negocio implementadas aqui:
 *   - no se admiten inscripciones por encima del cupo (capacity)
 *   - un cliente no puede inscribirse dos veces al mismo curso
 *   - solo se cancela una inscripcion antes de la fecha de inicio
 *   - publicar un curso valida que no choque con las citas del instructor
 */

import {
  COURSE_STATUS,
  ENROLLMENT_STATUS,
  PAYMENT_STATUS,
  PUBLIC_COURSE_STATUS,
  BLOCKING_APPOINTMENT_STATUS,
} from '@/constants'
import { createCourseModel, createEnrollmentModel, nowISO } from '@/models'
import { normalizeText } from '@/utils/format'
import { todayISO } from '@/utils/date'
import { getCourseSessions } from '@/utils/schedule'
import { clone, delay, fail, findById, getDB, insert, readCollection, saveDB, update } from './store'

/* ================================================================== */
/*  courses                                                            */
/* ================================================================== */

/**
 * Lista cursos con filtros.
 * @param {{instructorId?:string, status?:string|string[], level?:string,
 *          modality?:string, search?:string, publicOnly?:boolean}} filters
 */
async function listCourses(filters = {}) {
  await delay()
  const { instructorId, status, level, modality, search, publicOnly } = filters
  let rows = readCollection('courses')

  if (publicOnly) rows = rows.filter((c) => PUBLIC_COURSE_STATUS.includes(c.status))
  if (instructorId) rows = rows.filter((c) => c.instructorId === instructorId)
  if (status) {
    const wanted = Array.isArray(status) ? status : [status]
    rows = rows.filter((c) => wanted.includes(c.status))
  }
  if (level) rows = rows.filter((c) => c.level === level)
  if (modality) rows = rows.filter((c) => c.modality === modality)
  if (search?.trim()) {
    const q = normalizeText(search)
    rows = rows.filter(
      (c) => normalizeText(c.title).includes(q) || normalizeText(c.description).includes(q)
    )
  }

  // Primero los que empiezan antes; los sin fecha, al final
  return rows.sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'))
}

async function getCourse(id) {
  await delay(90)
  const row = findById('courses', id)
  return row ? clone(row) : null
}

/**
 * Comprueba que las sesiones del curso no choquen con citas activas del
 * instructor. Se ejecuta al publicar (no al guardar un borrador).
 */
function assertNoAgendaClash(course) {
  const db = getDB()
  const sessions = getCourseSessions(course)
  const today = todayISO()

  const clash = sessions
    .filter((s) => s.date >= today)
    .map((session) =>
      db.appointments.find(
        (a) =>
          a.barberId === course.instructorId &&
          a.date === session.date &&
          BLOCKING_APPOINTMENT_STATUS.includes(a.status) &&
          a.startTime < session.endTime &&
          session.startTime < a.endTime
      )
    )
    .find(Boolean)

  if (clash) {
    fail(
      'courses/agenda-clash',
      `El instructor tiene una cita el ${clash.date} a las ${clash.startTime} que choca con el horario del curso.`
    )
  }
}

async function createCourse(data) {
  await delay()
  const course = createCourseModel({ ...data, enrolledCount: 0 })
  if (course.status !== COURSE_STATUS.BORRADOR) assertNoAgendaClash(course)
  return insert('courses', course)
}

async function updateCourse(id, data) {
  await delay()
  const db = getDB()
  const current = db.courses.find((c) => c.id === id)
  if (!current) fail('courses/not-found', 'El curso no existe.')

  // El cupo nunca puede quedar por debajo de los ya inscritos
  if (data.capacity !== undefined && Number(data.capacity) < current.enrolledCount) {
    fail(
      'courses/capacity-too-low',
      `Ya hay ${current.enrolledCount} inscritos; el cupo no puede ser menor.`
    )
  }

  const merged = createCourseModel({
    ...current,
    ...data,
    id: current.id,
    instructorId: current.instructorId, // el instructor no cambia al editar
    enrolledCount: current.enrolledCount,
    createdAt: current.createdAt,
    updatedAt: nowISO(),
  })

  if (PUBLIC_COURSE_STATUS.includes(merged.status)) assertNoAgendaClash(merged)

  const index = db.courses.findIndex((c) => c.id === id)
  db.courses[index] = merged
  saveDB()
  return clone(merged)
}

/** Cambia el estado del curso (publicar, cancelar, finalizar...) */
async function setCourseStatus(id, status) {
  await delay()
  const db = getDB()
  const course = db.courses.find((c) => c.id === id)
  if (!course) fail('courses/not-found', 'El curso no existe.')
  if (!Object.values(COURSE_STATUS).includes(status)) {
    fail('courses/invalid-status', 'Estado de curso no valido.')
  }

  if (PUBLIC_COURSE_STATUS.includes(status)) {
    assertNoAgendaClash({ ...course, status })
  }

  // Al finalizar, las inscripciones activas pasan a completadas
  if (status === COURSE_STATUS.FINALIZADO) {
    db.enrollments.forEach((e) => {
      if (e.courseId === id && e.status === ENROLLMENT_STATUS.INSCRITO) {
        e.status = ENROLLMENT_STATUS.COMPLETADO
        e.updatedAt = nowISO()
      }
    })
  }

  // Al cancelar el curso, se cancelan sus inscripciones activas
  if (status === COURSE_STATUS.CANCELADO) {
    db.enrollments.forEach((e) => {
      if (e.courseId === id && e.status === ENROLLMENT_STATUS.INSCRITO) {
        e.status = ENROLLMENT_STATUS.CANCELADO
        e.paymentStatus =
          e.paymentStatus === PAYMENT_STATUS.PAGADO ? PAYMENT_STATUS.REEMBOLSADO : e.paymentStatus
        e.updatedAt = nowISO()
      }
    })
  }

  return update('courses', id, { status, updatedAt: nowISO() })
}

/** Borrado definitivo: solo para borradores sin inscritos */
async function removeCourse(id) {
  await delay()
  const db = getDB()
  const course = db.courses.find((c) => c.id === id)
  if (!course) fail('courses/not-found', 'El curso no existe.')
  if (course.enrolledCount > 0) {
    fail('courses/has-enrollments', 'Este curso tiene inscritos. Cancelalo en lugar de eliminarlo.')
  }
  db.courses = db.courses.filter((c) => c.id !== id)
  db.enrollments = db.enrollments.filter((e) => e.courseId !== id)
  saveDB()
  return true
}

/* ================================================================== */
/*  enrollments                                                        */
/* ================================================================== */

async function listEnrollments({ courseId, clientId, status } = {}) {
  await delay()
  let rows = readCollection('enrollments')
  if (courseId) rows = rows.filter((e) => e.courseId === courseId)
  if (clientId) rows = rows.filter((e) => e.clientId === clientId)
  if (status) {
    const wanted = Array.isArray(status) ? status : [status]
    rows = rows.filter((e) => wanted.includes(e.status))
  }
  return rows.sort((a, b) => String(b.enrolledAt).localeCompare(String(a.enrolledAt)))
}

async function getEnrollment(id) {
  await delay(90)
  const row = findById('enrollments', id)
  return row ? clone(row) : null
}

/** Inscripcion de un cliente en un curso, con todas las validaciones */
async function enroll({ courseId, clientId }) {
  await delay()
  const db = getDB()

  const course = db.courses.find((c) => c.id === courseId)
  if (!course) fail('courses/not-found', 'El curso no existe.')
  if (!PUBLIC_COURSE_STATUS.includes(course.status)) {
    fail('enrollments/course-not-open', 'Este curso no admite inscripciones en este momento.')
  }
  if (course.endDate && course.endDate < todayISO()) {
    fail('enrollments/course-finished', 'Este curso ya termino.')
  }

  const client = db.users.find((u) => u.uid === clientId)
  if (!client) fail('enrollments/client-not-found', 'El cliente no existe.')

  // Inscripcion duplicada
  const existing = db.enrollments.find(
    (e) => e.courseId === courseId && e.clientId === clientId && e.status !== ENROLLMENT_STATUS.CANCELADO
  )
  if (existing) fail('enrollments/duplicate', 'Ya estas inscrito en este curso.')

  // Cupo lleno
  const activeCount = db.enrollments.filter(
    (e) => e.courseId === courseId && e.status !== ENROLLMENT_STATUS.CANCELADO
  ).length
  if (activeCount >= course.capacity) {
    fail('enrollments/course-full', 'El cupo de este curso esta lleno.')
  }

  // Si el cliente ya habia cancelado antes, se reactiva su inscripcion
  const cancelled = db.enrollments.find(
    (e) => e.courseId === courseId && e.clientId === clientId && e.status === ENROLLMENT_STATUS.CANCELADO
  )

  let enrollment
  if (cancelled) {
    cancelled.status = ENROLLMENT_STATUS.INSCRITO
    cancelled.paymentStatus = PAYMENT_STATUS.PENDIENTE
    cancelled.enrolledAt = nowISO()
    cancelled.updatedAt = nowISO()
    enrollment = clone(cancelled)
  } else {
    enrollment = createEnrollmentModel({ courseId, clientId })
    db.enrollments.push(enrollment)
  }

  course.enrolledCount = activeCount + 1
  course.updatedAt = nowISO()
  saveDB()

  return clone(enrollment)
}

/** Cancelacion de una inscripcion, permitida antes de que arranque el curso */
async function cancelEnrollment(id, { force = false } = {}) {
  await delay()
  const db = getDB()
  const enrollment = db.enrollments.find((e) => e.id === id)
  if (!enrollment) fail('enrollments/not-found', 'La inscripcion no existe.')
  if (enrollment.status === ENROLLMENT_STATUS.CANCELADO) {
    fail('enrollments/already-cancelled', 'Esta inscripcion ya estaba cancelada.')
  }
  if (enrollment.status === ENROLLMENT_STATUS.COMPLETADO) {
    fail('enrollments/already-completed', 'No puedes cancelar un curso que ya completaste.')
  }

  const course = db.courses.find((c) => c.id === enrollment.courseId)
  if (!force && course?.startDate && course.startDate <= todayISO()) {
    fail(
      'enrollments/course-started',
      'El curso ya comenzo, la inscripcion solo puede cancelarse antes de la fecha de inicio.'
    )
  }

  enrollment.status = ENROLLMENT_STATUS.CANCELADO
  enrollment.paymentStatus =
    enrollment.paymentStatus === PAYMENT_STATUS.PAGADO
      ? PAYMENT_STATUS.REEMBOLSADO
      : enrollment.paymentStatus
  enrollment.updatedAt = nowISO()

  if (course) {
    course.enrolledCount = db.enrollments.filter(
      (e) => e.courseId === course.id && e.status !== ENROLLMENT_STATUS.CANCELADO
    ).length
    course.updatedAt = nowISO()
  }

  saveDB()
  return clone(enrollment)
}

/** Marca asistencia de un alumno en una sesion concreta */
async function setAttendance(id, date, present) {
  await delay(160)
  const db = getDB()
  const enrollment = db.enrollments.find((e) => e.id === id)
  if (!enrollment) fail('enrollments/not-found', 'La inscripcion no existe.')

  const record = enrollment.attendance.find((a) => a.date === date)
  if (record) record.present = Boolean(present)
  else enrollment.attendance.push({ date, present: Boolean(present) })

  enrollment.attendance.sort((a, b) => a.date.localeCompare(b.date))
  enrollment.updatedAt = nowISO()
  saveDB()
  return clone(enrollment)
}

/** Cambia el estado de pago de una inscripcion */
async function setPaymentStatus(id, paymentStatus) {
  await delay()
  if (!Object.values(PAYMENT_STATUS).includes(paymentStatus)) {
    fail('enrollments/invalid-payment', 'Estado de pago no valido.')
  }
  const result = update('enrollments', id, { paymentStatus, updatedAt: nowISO() })
  if (!result) fail('enrollments/not-found', 'La inscripcion no existe.')
  return result
}

export const mockCourses = {
  courses: {
    list: listCourses,
    get: getCourse,
    create: createCourse,
    update: updateCourse,
    setStatus: setCourseStatus,
    remove: removeCourse,
  },
  enrollments: {
    list: listEnrollments,
    get: getEnrollment,
    enroll,
    cancel: cancelEnrollment,
    setAttendance,
    setPaymentStatus,
  },
}

export default mockCourses
