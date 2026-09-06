/**
 * Metricas leyendo de Firestore.
 * Carga las colecciones necesarias y delega el calculo en statsCore,
 * el mismo modulo que usa el modo demo.
 */

import { collection, getDocs, query, where } from 'firebase/firestore'

import { COLLECTIONS, firestore } from '@/config/firebase'
import { computeAdminStats, computeBarberStats, computeClientStats } from '@/services/statsCore'
import { run, snapshotToArray } from './helpers'

/** Lee una coleccion completa como array de objetos */
async function readAll(name) {
  const snapshot = await getDocs(collection(firestore(), name))
  return snapshotToArray(snapshot)
}

/** users lleva el uid como id de documento */
async function readUsers() {
  const snapshot = await getDocs(collection(firestore(), COLLECTIONS.USERS))
  return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }))
}

async function getAdminStats() {
  return run(async () => {
    const [appointments, services, users, courses, enrollments] = await Promise.all([
      readAll(COLLECTIONS.APPOINTMENTS),
      readAll(COLLECTIONS.SERVICES),
      readUsers(),
      readAll(COLLECTIONS.COURSES),
      readAll(COLLECTIONS.ENROLLMENTS),
    ])
    return computeAdminStats({ appointments, services, users, courses, enrollments })
  }, 'stats/admin-failed')
}

async function getBarberStats(barberId) {
  return run(async () => {
    const [appointmentsSnapshot, coursesSnapshot] = await Promise.all([
      getDocs(
        query(collection(firestore(), COLLECTIONS.APPOINTMENTS), where('barberId', '==', barberId))
      ),
      getDocs(
        query(collection(firestore(), COLLECTIONS.COURSES), where('instructorId', '==', barberId))
      ),
    ])

    const appointments = snapshotToArray(appointmentsSnapshot)
    const courses = snapshotToArray(coursesSnapshot)

    // Solo hacen falta las inscripciones de los cursos de este barbero
    const enrollmentChunks = await Promise.all(
      courses.map(async (course) => {
        const snapshot = await getDocs(
          query(collection(firestore(), COLLECTIONS.ENROLLMENTS), where('courseId', '==', course.id))
        )
        return snapshotToArray(snapshot)
      })
    )

    return computeBarberStats({
      appointments,
      courses,
      enrollments: enrollmentChunks.flat(),
      barberId,
    })
  }, 'stats/barber-failed')
}

async function getClientStats(clientId) {
  return run(async () => {
    const [appointmentsSnapshot, enrollmentsSnapshot, courses] = await Promise.all([
      getDocs(
        query(collection(firestore(), COLLECTIONS.APPOINTMENTS), where('clientId', '==', clientId))
      ),
      getDocs(
        query(collection(firestore(), COLLECTIONS.ENROLLMENTS), where('clientId', '==', clientId))
      ),
      readAll(COLLECTIONS.COURSES),
    ])

    return computeClientStats({
      appointments: snapshotToArray(appointmentsSnapshot),
      enrollments: snapshotToArray(enrollmentsSnapshot),
      courses,
      clientId,
    })
  }, 'stats/client-failed')
}

export const firebaseStats = { getAdminStats, getBarberStats, getClientStats }

export default firebaseStats
