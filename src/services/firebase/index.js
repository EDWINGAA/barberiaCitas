/**
 * Punto de entrada de la implementacion de FIREBASE.
 * Misma forma exacta que /services/mock/index.js: los componentes no
 * notan ninguna diferencia al cambiar VITE_USE_MOCK.
 */

import { firebaseAuthProvider } from './auth'
import { firebaseUsers } from './users'
import { firebaseCatalog } from './catalog'
import { firebaseBarberServices } from './barberServices'
import { firebaseAppointments } from './appointments'
import { firebaseMessages } from './messages'
import { firebaseCourses } from './courses'
import { firebaseStats } from './stats'

export const firebaseServices = {
  auth: firebaseAuthProvider,
  users: firebaseUsers,
  services: firebaseCatalog.services,
  barberServices: firebaseBarberServices,
  gallery: firebaseCatalog.gallery,
  business: firebaseCatalog.business,
  storage: firebaseCatalog.storage,
  appointments: firebaseAppointments.appointments,
  blocks: firebaseAppointments.blocks,
  messages: firebaseMessages,
  courses: firebaseCourses.courses,
  enrollments: firebaseCourses.enrollments,
  stats: firebaseStats,

  /** El reinicio de datos solo tiene sentido en modo demo */
  demo: {
    reset: async () => {
      throw new Error('Reiniciar datos solo esta disponible en MODO DEMO.')
    },
  },
}

export default firebaseServices
