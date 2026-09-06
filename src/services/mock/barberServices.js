/**
 * Coleccion "barberServices" en MODO DEMO.
 *
 * Guarda lo que cada barbero ofrece y a que precio. La resolucion final
 * (que hereda del catalogo y que ha cambiado el barbero) vive en
 * offeringsCore, compartido con la implementacion de Firebase.
 */

import { ROLES } from '@/constants'
import { createBarberServiceModel, nowISO } from '@/models'
import {
  resolveBarbersForService,
  resolveBookableServices,
  resolveOffering,
  resolveOfferings,
  resolveQuote,
} from '@/services/offeringsCore'
import { clone, delay, fail, findById, getDB, insert, readCollection, saveDB, update } from './store'

/** Filas crudas de la coleccion, sin resolver */
async function list({ barberId } = {}) {
  await delay()
  let rows = readCollection('barberServices')
  if (barberId) rows = rows.filter((r) => r.barberId === barberId)
  return rows
}

async function get(id) {
  await delay(90)
  const row = findById('barberServices', id)
  return row ? clone(row) : null
}

/** Oferta completa y resuelta de un barbero */
async function listOfferings({ barberId, activeOnly = false }) {
  await delay(160)
  return resolveOfferings({
    services: readCollection('services'),
    rows: readCollection('barberServices'),
    barberId,
    activeOnly,
  })
}

/** Una sola oferta resuelta; es la que fija el precio de una cita */
async function getOffering({ barberId, serviceId }) {
  await delay(90)
  return resolveOffering({
    services: readCollection('services'),
    rows: readCollection('barberServices'),
    barberId,
    serviceId,
  })
}

/**
 * Presupuesto de UNA combinacion de barbero y servicio.
 *
 * Es el unico dato con precio que recibe el cliente, y solo despues de
 * haber elegido con quien se corta. Asi nunca ve las tarifas del resto
 * del equipo puestas una al lado de otra.
 */
async function getQuote({ barberId, serviceId }) {
  await delay(120)
  return resolveQuote({
    services: readCollection('services'),
    rows: readCollection('barberServices'),
    barberId,
    serviceId,
  })
}

/**
 * Barberos que ofrecen un servicio. SIN precios, a proposito: el cliente
 * elige con quien quiere cortarse, no por cuanto cobra cada uno.
 */
async function listBarbersForService({ serviceId, activeOnly = true }) {
  await delay(180)
  const db = getDB()
  const barbers = db.users.filter(
    (u) => u.role === ROLES.BARBERO && (!activeOnly || u.active)
  )

  return resolveBarbersForService({
    services: readCollection('services'),
    rows: readCollection('barberServices'),
    barbers: clone(barbers),
    serviceId,
  })
}

/** Catalogo reservable por el cliente, tambien sin precios */
async function listBookableServices() {
  await delay(180)
  const db = getDB()
  const barbers = db.users.filter((u) => u.role === ROLES.BARBERO && u.active)

  return resolveBookableServices({
    services: readCollection('services'),
    rows: readCollection('barberServices'),
    barbers: clone(barbers),
  })
}

/**
 * Ajusta un servicio del catalogo para un barbero: su precio, su
 * duracion o si deja de ofrecerlo. Crea la fila si aun no existia.
 */
async function setCatalogOverride({ barberId, serviceId, price, duration, active }) {
  await delay()
  const db = getDB()

  const service = db.services.find((s) => s.id === serviceId)
  if (!service) fail('services/not-found', 'El servicio no existe en el catalogo.')
  if (price !== undefined && Number(price) < 0) {
    fail('barberServices/invalid-price', 'El precio no puede ser negativo.')
  }
  if (duration !== undefined && Number(duration) < 5) {
    fail('barberServices/invalid-duration', 'La duracion minima es de 5 minutos.')
  }

  if (!db.barberServices) db.barberServices = []
  const existente = db.barberServices.find(
    (r) => r.barberId === barberId && r.serviceId === serviceId
  )

  if (existente) {
    if (price !== undefined) existente.price = Number(price)
    if (duration !== undefined) existente.duration = Number(duration)
    if (active !== undefined) existente.active = Boolean(active)
    existente.updatedAt = nowISO()
    saveDB()
    return clone(existente)
  }

  return insert(
    'barberServices',
    createBarberServiceModel({
      barberId,
      serviceId,
      // Si el barbero no toca un campo, hereda el del catalogo
      price: price !== undefined ? price : service.price,
      duration: duration !== undefined ? duration : service.duration,
      active: active !== undefined ? active : true,
    })
  )
}

/** Da de alta un servicio propio del barbero, que no esta en el catalogo */
async function createCustom({ barberId, name, description, price, duration }) {
  await delay()
  const db = getDB()

  const limpio = String(name || '').trim()
  if (!limpio) fail('barberServices/no-name', 'Ponle un nombre al servicio.')
  if (Number(price) < 0) fail('barberServices/invalid-price', 'El precio no puede ser negativo.')
  if (!Number(duration) || Number(duration) < 5) {
    fail('barberServices/invalid-duration', 'La duracion minima es de 5 minutos.')
  }

  // Ni el catalogo ni sus propios servicios pueden repetir nombre
  const chocaCatalogo = db.services.some(
    (s) => s.active !== false && s.name.toLowerCase() === limpio.toLowerCase()
  )
  if (chocaCatalogo) {
    fail(
      'barberServices/duplicate-catalog',
      `"${limpio}" ya esta en el catalogo de la barberia: ajusta ahi tu precio en lugar de crearlo aparte.`
    )
  }

  const chocaPropio = (db.barberServices || []).some(
    (r) => r.barberId === barberId && !r.serviceId && r.name.toLowerCase() === limpio.toLowerCase()
  )
  if (chocaPropio) fail('barberServices/duplicate', 'Ya tienes un servicio con ese nombre.')

  return insert(
    'barberServices',
    createBarberServiceModel({ barberId, name: limpio, description, price, duration })
  )
}

/** Edita una fila existente (precio, duracion, nombre, activo) */
async function updateRow(id, data) {
  await delay()
  const changes = {}
  ;['name', 'description', 'price', 'duration', 'active'].forEach((key) => {
    if (data[key] !== undefined) changes[key] = data[key]
  })
  if (changes.price !== undefined) changes.price = Number(changes.price)
  if (changes.duration !== undefined) changes.duration = Number(changes.duration)
  changes.updatedAt = nowISO()

  const result = update('barberServices', id, changes)
  if (!result) fail('barberServices/not-found', 'Ese servicio no existe.')
  return result
}

/**
 * Elimina una fila.
 * Si era un ajuste del catalogo, el barbero vuelve a heredar el precio
 * de la barberia. Si era un servicio propio, se comprueba que no tenga
 * citas antes de borrarlo.
 */
async function removeRow(id) {
  await delay()
  const db = getDB()
  const fila = (db.barberServices || []).find((r) => r.id === id)
  if (!fila) fail('barberServices/not-found', 'Ese servicio no existe.')

  if (!fila.serviceId) {
    const enUso = db.appointments.some((a) => a.serviceId === id)
    if (enUso) {
      fail(
        'barberServices/in-use',
        'Este servicio tiene citas asociadas. Desactivalo en lugar de eliminarlo.'
      )
    }
  }

  db.barberServices = db.barberServices.filter((r) => r.id !== id)
  saveDB()
  return true
}

export const mockBarberServices = {
  list,
  get,
  listOfferings,
  getOffering,
  getQuote,
  listBarbersForService,
  listBookableServices,
  setCatalogOverride,
  createCustom,
  update: updateRow,
  remove: removeRow,
}

export default mockBarberServices
