/**
 * Metricas en MODO DEMO.
 * Solo lee las colecciones del almacen y delega el calculo en statsCore,
 * el mismo modulo que usa la implementacion de Firebase.
 */

import { computeAdminStats, computeBarberStats, computeClientStats } from '@/services/statsCore'
import { delay, readCollection } from './store'

function snapshot() {
  return {
    appointments: readCollection('appointments'),
    services: readCollection('services'),
    users: readCollection('users'),
    courses: readCollection('courses'),
    enrollments: readCollection('enrollments'),
  }
}

async function getAdminStats() {
  await delay(220)
  return computeAdminStats(snapshot())
}

async function getBarberStats(barberId) {
  await delay(200)
  return computeBarberStats({ ...snapshot(), barberId })
}

async function getClientStats(clientId) {
  await delay(180)
  return computeClientStats({ ...snapshot(), clientId })
}

export const mockStats = { getAdminStats, getBarberStats, getClientStats }

export default mockStats
