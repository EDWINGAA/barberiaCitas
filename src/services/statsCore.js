/**
 * Calculo de metricas.
 *
 * Son funciones puras que reciben las colecciones ya cargadas. Las usan
 * tanto el modo demo como el de Firebase, asi que los tableros muestran
 * exactamente los mismos numeros en los dos modos.
 */

import {
  APPOINTMENT_STATUS,
  COURSE_STATUS,
  ENROLLMENT_STATUS,
  PAYMENT_STATUS,
} from '@/constants'
import {
  todayISO,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isWithin,
} from '@/utils/date'
import { getCourseSessions } from '@/utils/schedule'

/** Citas dentro de un rango de fechas inclusivo */
function inRange(appointments, from, to) {
  return appointments.filter((a) => isWithin(a.date, from, to))
}

/** Ingresos de las citas completadas de una lista */
function revenueFromAppointments(appointments) {
  return appointments
    .filter((a) => a.status === APPOINTMENT_STATUS.COMPLETADA)
    .reduce((sum, a) => sum + (Number(a.price) || 0), 0)
}

/**
 * Ingresos por cursos: se cuentan las inscripciones no canceladas,
 * usando el precio del curso correspondiente.
 */
function revenueFromEnrollments(enrollments, courses, { onlyPaid = false } = {}) {
  const priceById = Object.fromEntries(courses.map((c) => [c.id, Number(c.price) || 0]))
  return enrollments
    .filter((e) => e.status !== ENROLLMENT_STATUS.CANCELADO)
    .filter((e) => !onlyPaid || e.paymentStatus === PAYMENT_STATUS.PAGADO)
    .reduce((sum, e) => sum + (priceById[e.courseId] || 0), 0)
}

/* ================================================================== */
/*  Tablero del administrador                                          */
/* ================================================================== */

export function computeAdminStats({ appointments = [], services = [], users = [], courses = [], enrollments = [] }) {
  const today = todayISO()
  const weekFrom = startOfWeek(today)
  const weekTo = endOfWeek(today)
  const monthFrom = startOfMonth(today)
  const monthTo = endOfMonth(today)

  const todayAppointments = inRange(appointments, today, today)
  const weekAppointments = inRange(appointments, weekFrom, weekTo)
  const monthAppointments = inRange(appointments, monthFrom, monthTo)

  /* --- Tasa de no-show de los ultimos 30 dias -------------------- */
  // Se usa una ventana movil en lugar del mes natural: el dia 2 de mes
  // apenas hay citas cerradas y la metrica saldria siempre en cero.
  const noShowFrom = addDays(today, -30)
  const recentClosed = inRange(appointments, noShowFrom, today).filter((a) =>
    [APPOINTMENT_STATUS.COMPLETADA, APPOINTMENT_STATUS.NO_SHOW].includes(a.status)
  )
  const noShows = recentClosed.filter((a) => a.status === APPOINTMENT_STATUS.NO_SHOW)
  const noShowRate = recentClosed.length ? noShows.length / recentClosed.length : 0

  /* --- Ingresos ------------------------------------------------ */
  const serviceRevenueMonth = revenueFromAppointments(monthAppointments)
  const monthEnrollments = enrollments.filter((e) => isWithin(String(e.enrolledAt).slice(0, 10), monthFrom, monthTo))
  const courseRevenueMonth = revenueFromEnrollments(monthEnrollments, courses)

  /* --- Ranking de barberos ------------------------------------- */
  const barbers = users.filter((u) => u.role === 'barbero')
  const topBarbers = barbers
    .map((barber) => {
      const own = monthAppointments.filter((a) => a.barberId === barber.uid)
      const completed = own.filter((a) => a.status === APPOINTMENT_STATUS.COMPLETADA)
      return {
        uid: barber.uid,
        name: barber.name,
        photoURL: barber.photoURL,
        active: barber.active,
        total: own.length,
        completed: completed.length,
        revenue: revenueFromAppointments(own),
      }
    })
    .sort((a, b) => b.completed - a.completed || b.revenue - a.revenue)

  /* --- Servicios mas vendidos ---------------------------------- */
  const topServices = services
    .map((service) => {
      const own = monthAppointments.filter(
        (a) => a.serviceId === service.id && a.status !== APPOINTMENT_STATUS.CANCELADA
      )
      return {
        id: service.id,
        name: service.name,
        price: service.price,
        count: own.length,
        revenue: revenueFromAppointments(own),
      }
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)

  /* --- Cursos --------------------------------------------------- */
  const activeCourses = courses.filter((c) =>
    [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(c.status)
  )
  const topCourses = courses
    .map((course) => {
      const active = enrollments.filter(
        (e) => e.courseId === course.id && e.status !== ENROLLMENT_STATUS.CANCELADO
      ).length
      return {
        id: course.id,
        title: course.title,
        coverURL: course.coverURL,
        status: course.status,
        capacity: course.capacity,
        enrolled: active,
        occupancy: course.capacity ? active / course.capacity : 0,
        revenue: active * (Number(course.price) || 0),
      }
    })
    .sort((a, b) => b.enrolled - a.enrolled)

  const occupancySource = topCourses.filter((c) =>
    activeCourses.some((ac) => ac.id === c.id)
  )
  const avgOccupancy = occupancySource.length
    ? occupancySource.reduce((sum, c) => sum + c.occupancy, 0) / occupancySource.length
    : 0

  /* --- Distribucion por estado (mes) --------------------------- */
  const statusBreakdown = Object.values(APPOINTMENT_STATUS).map((status) => ({
    status,
    count: monthAppointments.filter((a) => a.status === status).length,
  }))

  return {
    // Citas
    todayCount: todayAppointments.length,
    weekCount: weekAppointments.length,
    monthCount: monthAppointments.length,
    todayAppointments,
    statusBreakdown,
    pendingCount: appointments.filter(
      (a) => a.status === APPOINTMENT_STATUS.PENDIENTE && a.date >= today
    ).length,

    // Dinero
    serviceRevenueMonth,
    courseRevenueMonth,
    totalRevenueMonth: serviceRevenueMonth + courseRevenueMonth,

    // Calidad
    noShowRate,
    noShowCount: noShows.length,

    // Personas
    barberCount: barbers.filter((b) => b.active).length,
    clientCount: users.filter((u) => u.role === 'cliente').length,

    // Rankings
    topBarbers,
    topServices,
    topCourses,

    // Cursos
    activeCourseCount: activeCourses.length,
    draftCourseCount: courses.filter((c) => c.status === COURSE_STATUS.BORRADOR).length,
    totalEnrollments: enrollments.filter((e) => e.status !== ENROLLMENT_STATUS.CANCELADO).length,
    avgOccupancy,

    range: { today, weekFrom, weekTo, monthFrom, monthTo },
  }
}

/* ================================================================== */
/*  Tablero y estadisticas del barbero                                 */
/* ================================================================== */

export function computeBarberStats({ appointments = [], courses = [], enrollments = [], barberId }) {
  const today = todayISO()
  const weekFrom = startOfWeek(today)
  const weekTo = endOfWeek(today)
  const monthFrom = startOfMonth(today)
  const monthTo = endOfMonth(today)

  const own = appointments.filter((a) => a.barberId === barberId)
  const ownCourses = courses.filter((c) => c.instructorId === barberId)
  const courseIds = new Set(ownCourses.map((c) => c.id))
  const ownEnrollments = enrollments.filter((e) => courseIds.has(e.courseId))

  const todayAppointments = own.filter((a) => a.date === today)
  const weekAppointments = inRange(own, weekFrom, weekTo)
  const monthAppointments = inRange(own, monthFrom, monthTo)

  const completed = own.filter((a) => a.status === APPOINTMENT_STATUS.COMPLETADA)
  const noShows = own.filter((a) => a.status === APPOINTMENT_STATUS.NO_SHOW)
  const finished = completed.length + noShows.length
  const noShowRate = finished ? noShows.length / finished : 0

  // Alumnos unicos con inscripcion activa o completada
  const uniqueStudents = new Set(
    ownEnrollments.filter((e) => e.status !== ENROLLMENT_STATUS.CANCELADO).map((e) => e.clientId)
  )

  const courseRevenue = revenueFromEnrollments(ownEnrollments, ownCourses)

  // Proximas sesiones de curso, ordenadas
  const upcomingSessions = ownCourses
    .filter((c) => [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(c.status))
    .flatMap((course) =>
      getCourseSessions(course)
        .filter((s) => s.date >= today)
        .map((s) => ({ ...s, courseId: course.id, courseTitle: course.title, status: course.status }))
    )
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))

  return {
    todayCount: todayAppointments.length,
    weekCount: weekAppointments.length,
    monthCount: monthAppointments.length,
    todayAppointments: todayAppointments.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    weekAppointments,

    completedCount: completed.length,
    noShowCount: noShows.length,
    noShowRate,
    cancelledCount: own.filter((a) => a.status === APPOINTMENT_STATUS.CANCELADA).length,
    upcomingCount: own.filter(
      (a) =>
        a.date >= today &&
        [APPOINTMENT_STATUS.PENDIENTE, APPOINTMENT_STATUS.CONFIRMADA].includes(a.status)
    ).length,

    serviceRevenue: revenueFromAppointments(completed),
    serviceRevenueMonth: revenueFromAppointments(monthAppointments),

    courseCount: ownCourses.length,
    publishedCourseCount: ownCourses.filter((c) =>
      [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO].includes(c.status)
    ).length,
    finishedCourseCount: ownCourses.filter((c) => c.status === COURSE_STATUS.FINALIZADO).length,
    studentCount: uniqueStudents.size,
    courseRevenue,

    upcomingSessions,
    courses: ownCourses,
  }
}

/* ================================================================== */
/*  Resumen del cliente                                                */
/* ================================================================== */

export function computeClientStats({ appointments = [], enrollments = [], courses = [], clientId }) {
  const today = todayISO()
  const own = appointments.filter((a) => a.clientId === clientId)
  const ownEnrollments = enrollments.filter((e) => e.clientId === clientId)
  const courseById = Object.fromEntries(courses.map((c) => [c.id, c]))

  const upcoming = own
    .filter(
      (a) =>
        a.date >= today &&
        [APPOINTMENT_STATUS.PENDIENTE, APPOINTMENT_STATUS.CONFIRMADA].includes(a.status)
    )
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))

  const history = own
    .filter((a) => !upcoming.some((u) => u.id === a.id))
    .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))

  const activeEnrollments = ownEnrollments.filter((e) => e.status === ENROLLMENT_STATUS.INSCRITO)

  const nextSession = activeEnrollments
    .flatMap((e) => {
      const course = courseById[e.courseId]
      if (!course) return []
      return getCourseSessions(course)
        .filter((s) => s.date >= today)
        .map((s) => ({ ...s, courseId: course.id, courseTitle: course.title }))
    })
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0] || null

  return {
    upcoming,
    history,
    nextAppointment: upcoming[0] || null,
    completedCount: own.filter((a) => a.status === APPOINTMENT_STATUS.COMPLETADA).length,
    totalSpent: revenueFromAppointments(own),
    activeCourseCount: activeEnrollments.length,
    completedCourseCount: ownEnrollments.filter((e) => e.status === ENROLLMENT_STATUS.COMPLETADO).length,
    nextSession,
  }
}
