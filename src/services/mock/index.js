/**
 * Punto de entrada de la implementacion MOCK.
 * Reune todos los servicios del modo demo con la misma forma exacta que
 * la implementacion de Firebase (ver /services/firebase/index.js).
 */

import { mockAuth } from './auth'
import { mockUsers } from './users'
import { mockCatalog } from './catalog'
import { mockBarberServices } from './barberServices'
import { mockAppointments } from './appointments'
import { mockCourses } from './courses'
import { mockStats } from './stats'
import { resetDB } from './store'

export const mockServices = {
  auth: mockAuth,
  users: mockUsers,
  services: mockCatalog.services,
  barberServices: mockBarberServices,
  gallery: mockCatalog.gallery,
  business: mockCatalog.business,
  storage: mockCatalog.storage,
  appointments: mockAppointments.appointments,
  blocks: mockAppointments.blocks,
  courses: mockCourses.courses,
  enrollments: mockCourses.enrollments,
  stats: mockStats,

  /** Exclusivo del modo demo: vuelve a sembrar los datos de ejemplo */
  demo: {
    reset: async () => {
      resetDB()
      return true
    },
  },
}

export default mockServices
