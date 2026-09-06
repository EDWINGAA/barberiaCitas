/**
 * Colecciones "courses" y "enrollments" en Firestore.
 *
 * La inscripcion se hace dentro de una TRANSACCION: es la unica forma
 * de garantizar que dos clientes simultaneos no superen el cupo.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

import {
  BLOCKING_APPOINTMENT_STATUS,
  COURSE_STATUS,
  ENROLLMENT_STATUS,
  PAYMENT_STATUS,
  PUBLIC_COURSE_STATUS,
} from '@/constants'
import { COLLECTIONS, firestore } from '@/config/firebase'
import { createCourseModel, createEnrollmentModel, nowISO } from '@/models'
import { normalizeText } from '@/utils/format'
import { todayISO } from '@/utils/date'
import { getCourseSessions } from '@/utils/schedule'
import { docToObject, fail, run, snapshotToArray } from './helpers'

/* ================================================================== */
/*  courses                                                            */
/* ================================================================== */

async function listCourses(filters = {}) {
  return run(async () => {
    const { instructorId, status, level, modality, search, publicOnly } = filters
    const ref = collection(firestore(), COLLECTIONS.COURSES)

    // Un solo filtro en servidor evita indices compuestos obligatorios
    const snapshot = await getDocs(
      instructorId ? query(ref, where('instructorId', '==', instructorId)) : ref
    )
    let rows = snapshotToArray(snapshot)

    if (publicOnly) rows = rows.filter((c) => PUBLIC_COURSE_STATUS.includes(c.status))
    if (status) {
      const wanted = Array.isArray(status) ? status : [status]
      rows = rows.filter((c) => wanted.includes(c.status))
    }
    if (level) rows = rows.filter((c) => c.level === level)
    if (modality) rows = rows.filter((c) => c.modality === modality)
    if (search?.trim()) {
      const q = normalizeText(search)
      rows = rows.filter(
        (c) => normalizeText(c.title || '').includes(q) || normalizeText(c.description || '').includes(q)
      )
    }

    return rows.sort((a, b) => String(a.startDate || '9999').localeCompare(String(b.startDate || '9999')))
  }, 'courses/list-failed')
}

async function getCourse(id) {
  return run(
    async () => docToObject(await getDoc(doc(firestore(), COLLECTIONS.COURSES, id))),
    'courses/get-failed'
  )
}

/** Impide publicar un curso que choque con citas activas del instructor */
async function assertNoAgendaClash(course) {
  const sessions = getCourseSessions(course).filter((s) => s.date >= todayISO())
  if (!sessions.length) return

  const snapshot = await getDocs(
    query(
      collection(firestore(), COLLECTIONS.APPOINTMENTS),
      where('barberId', '==', course.instructorId)
    )
  )
  const appointments = snapshotToArray(snapshot).filter((a) =>
    BLOCKING_APPOINTMENT_STATUS.includes(a.status)
  )

  const clash = sessions
    .map((session) =>
      appointments.find(
        (a) => a.date === session.date && a.startTime < session.endTime && session.startTime < a.endTime
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
  return run(async () => {
    const model = createCourseModel({ ...data, enrolledCount: 0 })
    if (model.status !== COURSE_STATUS.BORRADOR) await assertNoAgendaClash(model)

    const { id: _id, ...payload } = model
    const created = await addDoc(collection(firestore(), COLLECTIONS.COURSES), payload)
    return { ...model, id: created.id }
  }, 'courses/create-failed')
}

async function updateCourse(id, data) {
  return run(async () => {
    const current = await getCourse(id)
    if (!current) fail('courses/not-found', 'El curso no existe.')

    if (data.capacity !== undefined && Number(data.capacity) < (current.enrolledCount || 0)) {
      fail(
        'courses/capacity-too-low',
        `Ya hay ${current.enrolledCount} inscritos; el cupo no puede ser menor.`
      )
    }

    const merged = createCourseModel({
      ...current,
      ...data,
      id,
      instructorId: current.instructorId,
      enrolledCount: current.enrolledCount || 0,
      createdAt: current.createdAt,
      updatedAt: nowISO(),
    })

    if (PUBLIC_COURSE_STATUS.includes(merged.status)) await assertNoAgendaClash(merged)

    const { id: _id, ...payload } = merged
    await updateDoc(doc(firestore(), COLLECTIONS.COURSES, id), payload)
    return merged
  }, 'courses/update-failed')
}

async function setCourseStatus(id, status) {
  return run(async () => {
    const course = await getCourse(id)
    if (!course) fail('courses/not-found', 'El curso no existe.')
    if (!Object.values(COURSE_STATUS).includes(status)) {
      fail('courses/invalid-status', 'Estado de curso no valido.')
    }

    if (PUBLIC_COURSE_STATUS.includes(status)) {
      await assertNoAgendaClash({ ...course, status })
    }

    await updateDoc(doc(firestore(), COLLECTIONS.COURSES, id), { status, updatedAt: nowISO() })

    // Propagar el nuevo estado a las inscripciones activas
    if ([COURSE_STATUS.FINALIZADO, COURSE_STATUS.CANCELADO].includes(status)) {
      const snapshot = await getDocs(
        query(
          collection(firestore(), COLLECTIONS.ENROLLMENTS),
          where('courseId', '==', id),
          where('status', '==', ENROLLMENT_STATUS.INSCRITO)
        )
      )
      if (!snapshot.empty) {
        const batch = writeBatch(firestore())
        const nextStatus =
          status === COURSE_STATUS.FINALIZADO ? ENROLLMENT_STATUS.COMPLETADO : ENROLLMENT_STATUS.CANCELADO

        snapshot.docs.forEach((d) => {
          const changes = { status: nextStatus, updatedAt: nowISO() }
          if (status === COURSE_STATUS.CANCELADO && d.data().paymentStatus === PAYMENT_STATUS.PAGADO) {
            changes.paymentStatus = PAYMENT_STATUS.REEMBOLSADO
          }
          batch.update(d.ref, changes)
        })
        await batch.commit()

        if (status === COURSE_STATUS.CANCELADO) {
          await updateDoc(doc(firestore(), COLLECTIONS.COURSES, id), { enrolledCount: 0 })
        }
      }
    }

    return getCourse(id)
  }, 'courses/status-failed')
}

async function removeCourse(id) {
  return run(async () => {
    const course = await getCourse(id)
    if (!course) fail('courses/not-found', 'El curso no existe.')
    if ((course.enrolledCount || 0) > 0) {
      fail('courses/has-enrollments', 'Este curso tiene inscritos. Cancelalo en lugar de eliminarlo.')
    }
    await deleteDoc(doc(firestore(), COLLECTIONS.COURSES, id))
    return true
  }, 'courses/remove-failed')
}

/* ================================================================== */
/*  enrollments                                                        */
/* ================================================================== */

async function listEnrollments({ courseId, clientId, status } = {}) {
  return run(async () => {
    const ref = collection(firestore(), COLLECTIONS.ENROLLMENTS)
    const conditions = []
    if (courseId) conditions.push(where('courseId', '==', courseId))
    else if (clientId) conditions.push(where('clientId', '==', clientId))

    const snapshot = await getDocs(conditions.length ? query(ref, ...conditions) : ref)
    let rows = snapshotToArray(snapshot)

    if (courseId && clientId) rows = rows.filter((e) => e.clientId === clientId)
    if (status) {
      const wanted = Array.isArray(status) ? status : [status]
      rows = rows.filter((e) => wanted.includes(e.status))
    }

    return rows.sort((a, b) => String(b.enrolledAt).localeCompare(String(a.enrolledAt)))
  }, 'enrollments/list-failed')
}

async function getEnrollment(id) {
  return run(
    async () => docToObject(await getDoc(doc(firestore(), COLLECTIONS.ENROLLMENTS, id))),
    'enrollments/get-failed'
  )
}

/**
 * Inscribe a un cliente en un curso.
 * La comprobacion de cupo y el incremento de enrolledCount ocurren
 * dentro de una transaccion para que sean atomicos.
 */
async function enroll({ courseId, clientId }) {
  return run(async () => {
    const db = firestore()
    const courseRef = doc(db, COLLECTIONS.COURSES, courseId)

    // Inscripcion duplicada: se comprueba antes de la transaccion
    const existingSnapshot = await getDocs(
      query(
        collection(db, COLLECTIONS.ENROLLMENTS),
        where('courseId', '==', courseId),
        where('clientId', '==', clientId)
      )
    )
    const existing = snapshotToArray(existingSnapshot)
    if (existing.some((e) => e.status !== ENROLLMENT_STATUS.CANCELADO)) {
      fail('enrollments/duplicate', 'Ya estas inscrito en este curso.')
    }
    const cancelled = existing.find((e) => e.status === ENROLLMENT_STATUS.CANCELADO)

    const enrollmentRef = cancelled
      ? doc(db, COLLECTIONS.ENROLLMENTS, cancelled.id)
      : doc(collection(db, COLLECTIONS.ENROLLMENTS))

    const result = await runTransaction(db, async (tx) => {
      const courseSnapshot = await tx.get(courseRef)
      if (!courseSnapshot.exists()) fail('courses/not-found', 'El curso no existe.')

      const course = courseSnapshot.data()
      if (!PUBLIC_COURSE_STATUS.includes(course.status)) {
        fail('enrollments/course-not-open', 'Este curso no admite inscripciones en este momento.')
      }
      if (course.endDate && course.endDate < todayISO()) {
        fail('enrollments/course-finished', 'Este curso ya termino.')
      }

      const enrolled = Number(course.enrolledCount) || 0
      if (enrolled >= Number(course.capacity)) {
        fail('enrollments/course-full', 'El cupo de este curso esta lleno.')
      }

      const model = createEnrollmentModel({
        id: enrollmentRef.id,
        courseId,
        clientId,
        attendance: cancelled?.attendance || [],
      })
      const { id: _id, ...payload } = model

      tx.set(enrollmentRef, payload)
      tx.update(courseRef, { enrolledCount: enrolled + 1, updatedAt: nowISO() })

      return model
    })

    return result
  }, 'enrollments/enroll-failed')
}

/** Cancela una inscripcion y libera el lugar, tambien en transaccion */
async function cancelEnrollment(id, { force = false } = {}) {
  return run(async () => {
    const db = firestore()
    const enrollmentRef = doc(db, COLLECTIONS.ENROLLMENTS, id)

    return runTransaction(db, async (tx) => {
      const enrollmentSnapshot = await tx.get(enrollmentRef)
      if (!enrollmentSnapshot.exists()) fail('enrollments/not-found', 'La inscripcion no existe.')

      const enrollment = enrollmentSnapshot.data()
      if (enrollment.status === ENROLLMENT_STATUS.CANCELADO) {
        fail('enrollments/already-cancelled', 'Esta inscripcion ya estaba cancelada.')
      }
      if (enrollment.status === ENROLLMENT_STATUS.COMPLETADO) {
        fail('enrollments/already-completed', 'No puedes cancelar un curso que ya completaste.')
      }

      const courseRef = doc(db, COLLECTIONS.COURSES, enrollment.courseId)
      const courseSnapshot = await tx.get(courseRef)
      const course = courseSnapshot.exists() ? courseSnapshot.data() : null

      if (!force && course?.startDate && course.startDate <= todayISO()) {
        fail(
          'enrollments/course-started',
          'El curso ya comenzo, la inscripcion solo puede cancelarse antes de la fecha de inicio.'
        )
      }

      const changes = {
        status: ENROLLMENT_STATUS.CANCELADO,
        updatedAt: nowISO(),
      }
      if (enrollment.paymentStatus === PAYMENT_STATUS.PAGADO) {
        changes.paymentStatus = PAYMENT_STATUS.REEMBOLSADO
      }

      tx.update(enrollmentRef, changes)
      if (course) {
        tx.update(courseRef, {
          enrolledCount: Math.max(0, (Number(course.enrolledCount) || 0) - 1),
          updatedAt: nowISO(),
        })
      }

      return { id, ...enrollment, ...changes }
    })
  }, 'enrollments/cancel-failed')
}

async function setAttendance(id, date, present) {
  return run(async () => {
    const enrollment = await getEnrollment(id)
    if (!enrollment) fail('enrollments/not-found', 'La inscripcion no existe.')

    const attendance = [...(enrollment.attendance || [])]
    const index = attendance.findIndex((a) => a.date === date)
    if (index >= 0) attendance[index] = { date, present: Boolean(present) }
    else attendance.push({ date, present: Boolean(present) })
    attendance.sort((a, b) => a.date.localeCompare(b.date))

    await updateDoc(doc(firestore(), COLLECTIONS.ENROLLMENTS, id), {
      attendance,
      updatedAt: nowISO(),
    })
    return { ...enrollment, attendance }
  }, 'enrollments/attendance-failed')
}

async function setPaymentStatus(id, paymentStatus) {
  return run(async () => {
    if (!Object.values(PAYMENT_STATUS).includes(paymentStatus)) {
      fail('enrollments/invalid-payment', 'Estado de pago no valido.')
    }
    await updateDoc(doc(firestore(), COLLECTIONS.ENROLLMENTS, id), {
      paymentStatus,
      updatedAt: nowISO(),
    })
    return getEnrollment(id)
  }, 'enrollments/payment-failed')
}

export const firebaseCourses = {
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

export default firebaseCourses
