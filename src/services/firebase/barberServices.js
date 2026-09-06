/**
 * Coleccion "barberServices" en Firestore.
 *
 * Misma API que la version mock. La resolucion de precios usa el mismo
 * offeringsCore, de modo que el precio que se calcula aqui es exactamente
 * el que se calcula en el modo demo.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'

import { ROLES } from '@/constants'
import { COLLECTIONS, firestore } from '@/config/firebase'
import { createBarberServiceModel, nowISO } from '@/models'
import {
  resolveBarbersForService,
  resolveBookableServices,
  resolveOffering,
  resolveOfferings,
  resolveQuote,
} from '@/services/offeringsCore'
import { docToObject, fail, run, snapshotToArray, stripUndefined } from './helpers'
import firebaseCatalog from './catalog'

/* ------------------------------------------------------------------ */
/*  Lecturas auxiliares                                                */
/* ------------------------------------------------------------------ */

async function readRows(barberId) {
  const ref = collection(firestore(), COLLECTIONS.BARBER_SERVICES)
  const snapshot = await getDocs(barberId ? query(ref, where('barberId', '==', barberId)) : ref)
  return snapshotToArray(snapshot)
}

async function readBarbers(activeOnly = true) {
  const conditions = [where('role', '==', ROLES.BARBERO)]
  if (activeOnly) conditions.push(where('active', '==', true))

  const snapshot = await getDocs(
    query(collection(firestore(), COLLECTIONS.USERS), ...conditions)
  )
  return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }))
}

/* ------------------------------------------------------------------ */
/*  Consultas                                                          */
/* ------------------------------------------------------------------ */

async function list({ barberId } = {}) {
  return run(() => readRows(barberId), 'barberServices/list-failed')
}

async function get(id) {
  return run(
    async () => docToObject(await getDoc(doc(firestore(), COLLECTIONS.BARBER_SERVICES, id))),
    'barberServices/get-failed'
  )
}

async function listOfferings({ barberId, activeOnly = false }) {
  return run(async () => {
    const [services, rows] = await Promise.all([
      firebaseCatalog.services.list(),
      readRows(barberId),
    ])
    return resolveOfferings({ services, rows, barberId, activeOnly })
  }, 'barberServices/offerings-failed')
}

async function getOffering({ barberId, serviceId }) {
  return run(async () => {
    const [services, rows] = await Promise.all([
      firebaseCatalog.services.list(),
      readRows(barberId),
    ])
    return resolveOffering({ services, rows, barberId, serviceId })
  }, 'barberServices/offering-failed')
}

/**
 * Presupuesto de UNA combinacion de barbero y servicio.
 *
 * Es el unico dato con precio que recibe el cliente, y solo despues de
 * haber elegido con quien se corta.
 */
async function getQuote({ barberId, serviceId }) {
  return run(async () => {
    const [services, rows] = await Promise.all([
      firebaseCatalog.services.list(),
      readRows(barberId),
    ])
    return resolveQuote({ services, rows, barberId, serviceId })
  }, 'barberServices/quote-failed')
}

/**
 * Barberos que ofrecen un servicio. SIN precios, a proposito: el cliente
 * elige con quien quiere cortarse, no por cuanto cobra cada uno.
 */
async function listBarbersForService({ serviceId, activeOnly = true }) {
  return run(async () => {
    const [services, rows, barbers] = await Promise.all([
      firebaseCatalog.services.list(),
      readRows(),
      readBarbers(activeOnly),
    ])
    return resolveBarbersForService({ services, rows, barbers, serviceId })
  }, 'barberServices/barbers-failed')
}

async function listBookableServices() {
  return run(async () => {
    const [services, rows, barbers] = await Promise.all([
      firebaseCatalog.services.list(),
      readRows(),
      readBarbers(true),
    ])
    return resolveBookableServices({ services, rows, barbers })
  }, 'barberServices/bookable-failed')
}

/* ------------------------------------------------------------------ */
/*  Escrituras                                                         */
/* ------------------------------------------------------------------ */

async function setCatalogOverride({ barberId, serviceId, price, duration, active }) {
  return run(async () => {
    const service = await firebaseCatalog.services.get(serviceId)
    if (!service) fail('services/not-found', 'El servicio no existe en el catalogo.')
    if (price !== undefined && Number(price) < 0) {
      fail('barberServices/invalid-price', 'El precio no puede ser negativo.')
    }
    if (duration !== undefined && Number(duration) < 5) {
      fail('barberServices/invalid-duration', 'La duracion minima es de 5 minutos.')
    }

    const snapshot = await getDocs(
      query(
        collection(firestore(), COLLECTIONS.BARBER_SERVICES),
        where('barberId', '==', barberId),
        where('serviceId', '==', serviceId),
        limit(1)
      )
    )

    // Ya habia ajustes: se actualizan
    if (!snapshot.empty) {
      const existente = snapshot.docs[0]
      const changes = stripUndefined({
        price: price !== undefined ? Number(price) : undefined,
        duration: duration !== undefined ? Number(duration) : undefined,
        active: active !== undefined ? Boolean(active) : undefined,
        updatedAt: nowISO(),
      })
      await updateDoc(existente.ref, changes)
      return { id: existente.id, ...existente.data(), ...changes }
    }

    // Primera vez: se hereda del catalogo lo que el barbero no toque
    const model = createBarberServiceModel({
      barberId,
      serviceId,
      price: price !== undefined ? price : service.price,
      duration: duration !== undefined ? duration : service.duration,
      active: active !== undefined ? active : true,
    })
    const { id: _id, ...payload } = model
    const created = await addDoc(collection(firestore(), COLLECTIONS.BARBER_SERVICES), payload)
    return { ...model, id: created.id }
  }, 'barberServices/override-failed')
}

async function createCustom({ barberId, name, description, price, duration }) {
  return run(async () => {
    const limpio = String(name || '').trim()
    if (!limpio) fail('barberServices/no-name', 'Ponle un nombre al servicio.')
    if (Number(price) < 0) fail('barberServices/invalid-price', 'El precio no puede ser negativo.')
    if (!Number(duration) || Number(duration) < 5) {
      fail('barberServices/invalid-duration', 'La duracion minima es de 5 minutos.')
    }

    const services = await firebaseCatalog.services.list({ activeOnly: true })
    if (services.some((s) => String(s.name).toLowerCase() === limpio.toLowerCase())) {
      fail(
        'barberServices/duplicate-catalog',
        `"${limpio}" ya esta en el catalogo de la barberia: ajusta ahi tu precio en lugar de crearlo aparte.`
      )
    }

    const rows = await readRows(barberId)
    if (rows.some((r) => !r.serviceId && String(r.name).toLowerCase() === limpio.toLowerCase())) {
      fail('barberServices/duplicate', 'Ya tienes un servicio con ese nombre.')
    }

    const model = createBarberServiceModel({ barberId, name: limpio, description, price, duration })
    const { id: _id, ...payload } = model
    const created = await addDoc(collection(firestore(), COLLECTIONS.BARBER_SERVICES), payload)
    return { ...model, id: created.id }
  }, 'barberServices/create-failed')
}

async function updateRow(id, data) {
  return run(async () => {
    const changes = stripUndefined({
      name: data.name,
      description: data.description,
      price: data.price !== undefined ? Number(data.price) : undefined,
      duration: data.duration !== undefined ? Number(data.duration) : undefined,
      active: data.active,
      updatedAt: nowISO(),
    })
    await updateDoc(doc(firestore(), COLLECTIONS.BARBER_SERVICES, id), changes)
    return get(id)
  }, 'barberServices/update-failed')
}

async function removeRow(id) {
  return run(async () => {
    const fila = await get(id)
    if (!fila) fail('barberServices/not-found', 'Ese servicio no existe.')

    // Un servicio propio con historial de citas no se borra
    if (!fila.serviceId) {
      const usadas = await getDocs(
        query(
          collection(firestore(), COLLECTIONS.APPOINTMENTS),
          where('serviceId', '==', id),
          limit(1)
        )
      )
      if (!usadas.empty) {
        fail(
          'barberServices/in-use',
          'Este servicio tiene citas asociadas. Desactivalo en lugar de eliminarlo.'
        )
      }
    }

    await deleteDoc(doc(firestore(), COLLECTIONS.BARBER_SERVICES, id))
    return true
  }, 'barberServices/remove-failed')
}

export const firebaseBarberServices = {
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

export default firebaseBarberServices
