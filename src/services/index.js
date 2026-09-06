/**
 * =====================================================================
 *  INTERFAZ UNICA DE DATOS
 * =====================================================================
 *
 * Este es el UNICO modulo de datos que deben importar los componentes.
 * Elige la implementacion segun la variable de entorno VITE_USE_MOCK:
 *
 *   VITE_USE_MOCK=true   ->  /services/mock       (demo sin Firebase)
 *   VITE_USE_MOCK=false  ->  /services/firebase   (Firebase real)
 *
 * Las dos implementaciones exponen exactamente las mismas funciones con
 * las mismas firmas, por lo que pasar de una a otra no requiere tocar
 * ni una sola vista.
 *
 * API disponible:
 *   services.auth          signIn, signUp, signOut, onAuthChanged,
 *                          getCurrentUser, createAccount, refresh
 *   services.users         list, listBarbers, listClients, get, getMany,
 *                          update, setActive
 *   services.services      list, get, create, update, setActive, remove
 *   services.barberServices lo que ofrece cada barbero y a que precio:
 *                          list, get, listOfferings, getOffering,
 *                          listBarbersForService, listBookableServices,
 *                          setCatalogOverride, createCustom, update, remove
 *   services.appointments  list, get, create, update, setStatus, cancel,
 *                          reschedule, remove, getAvailableSlots,
 *                          getDaySlots, getAgendaDay
 *   services.blocks        list, create, remove
 *   services.courses       list, get, create, update, setStatus, remove
 *   services.enrollments   list, get, enroll, cancel, setAttendance,
 *                          setPaymentStatus
 *   services.gallery       list, get, create, update, setActive, remove,
 *                          reorder
 *   services.business      get, update
 *   services.storage       uploadImage, remove
 *   services.stats         getAdminStats, getBarberStats, getClientStats
 *   services.demo          reset (solo modo demo)
 */

import { USE_MOCK } from '@/constants'
import mockServices from './mock'

/**
 * La implementacion de Firebase se carga de forma DINAMICA.
 *
 * Asi, cuando VITE_USE_MOCK=true el SDK de Firebase ni siquiera se
 * descarga: el empaquetador lo deja fuera del bundle principal y la
 * demo arranca varios cientos de kilobytes mas ligera.
 */
const firebaseServices = USE_MOCK ? null : (await import('./firebase')).firebaseServices

/** Implementacion activa en esta ejecucion */
export const services = USE_MOCK ? mockServices : firebaseServices

/** true si la app corre en modo demo (lo usa el indicador visual) */
export const isMockMode = USE_MOCK

/* Accesos directos, comodos al importar */
export const auth = services.auth
export const usersService = services.users
export const servicesService = services.services
export const barberServicesService = services.barberServices
export const appointmentsService = services.appointments
export const blocksService = services.blocks
export const coursesService = services.courses
export const enrollmentsService = services.enrollments
export const galleryService = services.gallery
export const businessService = services.business
export const storageService = services.storage
export const statsService = services.stats
export const demoService = services.demo

export default services
