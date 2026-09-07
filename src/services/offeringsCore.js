/**
 * Resolucion de "que ofrece cada barbero y a que precio".
 *
 * Son funciones PURAS: reciben el catalogo de la barberia y las filas de
 * barberServices, y devuelven la oferta final de un barbero. Las usan
 * igual el modo demo y el de Firebase, asi que el precio que ve el
 * cliente y el que valida el servidor salen siempre del mismo calculo.
 *
 * Regla de herencia:
 *   - sin fila propia            -> el barbero ofrece el servicio al
 *                                   precio y duracion del catalogo
 *   - fila con active: false     -> ese barbero NO ofrece el servicio
 *   - fila con precio/duracion   -> manda lo que puso el barbero
 *   - fila sin serviceId         -> servicio propio, solo suyo
 */

import { OFFERING_ORIGIN } from '@/constants'

/**
 * Construye una oferta a partir de un servicio del catalogo y, si
 * existe, de la fila con los ajustes del barbero.
 */
function fromCatalog(service, row, barberId) {
  const price = row && row.price > 0 ? Number(row.price) : Number(service.price) || 0
  const duration = row && row.duration > 0 ? Number(row.duration) : Number(service.duration) || 30

  return {
    // Identificador que viaja en la cita
    id: service.id,
    rowId: row?.id || null,
    barberId,
    serviceId: service.id,
    origin: OFFERING_ORIGIN.CATALOGO,
    name: service.name,
    description: service.description,
    price,
    duration,
    // Un servicio inactivo en el catalogo no lo ofrece nadie
    active: service.active !== false && (row ? row.active !== false : true),
    // Para avisar en el panel de que se ha cambiado respecto al catalogo
    basePrice: Number(service.price) || 0,
    baseDuration: Number(service.duration) || 30,
    customized: Boolean(row) && (price !== Number(service.price) || duration !== Number(service.duration)),
  }
}

/** Construye una oferta a partir de un servicio propio del barbero */
function fromOwnRow(row) {
  return {
    id: row.id,
    rowId: row.id,
    barberId: row.barberId,
    serviceId: '',
    origin: OFFERING_ORIGIN.PROPIO,
    name: row.name,
    description: row.description,
    price: Number(row.price) || 0,
    duration: Number(row.duration) || 30,
    active: row.active !== false,
    basePrice: null,
    baseDuration: null,
    customized: true,
  }
}

/**
 * Oferta completa de un barbero: catalogo heredado o ajustado, mas sus
 * servicios propios. Ordenada por nombre.
 *
 * @param {object}  params
 * @param {Array}   params.services    catalogo de la barberia
 * @param {Array}   params.rows        filas de barberServices (de ese barbero o de todos)
 * @param {string}  params.barberId
 * @param {boolean} [params.activeOnly] descarta lo que el barbero no ofrece
 */
export function resolveOfferings({ services = [], rows = [], barberId, activeOnly = false }) {
  const propias = rows.filter((r) => r.barberId === barberId)
  const porServicio = Object.fromEntries(propias.filter((r) => r.serviceId).map((r) => [r.serviceId, r]))

  const delCatalogo = services.map((service) =>
    fromCatalog(service, porServicio[service.id], barberId)
  )
  const propiasResueltas = propias.filter((r) => !r.serviceId).map(fromOwnRow)

  const todas = [...delCatalogo, ...propiasResueltas]
  const filtradas = activeOnly ? todas.filter((o) => o.active) : todas

  return filtradas.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
}

/**
 * Una sola oferta. Acepta tanto un id del catalogo como el id de un
 * servicio propio del barbero, que es lo que llega en las citas.
 */
export function resolveOffering({ services = [], rows = [], barberId, serviceId }) {
  if (!serviceId) return null

  const service = services.find((s) => s.id === serviceId)
  if (service) {
    const row = rows.find((r) => r.barberId === barberId && r.serviceId === serviceId)
    return fromCatalog(service, row, barberId)
  }

  // Si no esta en el catalogo, puede ser un servicio propio del barbero
  const own = rows.find((r) => r.id === serviceId && !r.serviceId && r.barberId === barberId)
  return own ? fromOwnRow(own) : null
}

/* ================================================================== */
/*  Lo que ve el CLIENTE                                               */
/* ================================================================== */
//  Decision de negocio: el cliente NO compara precios entre barberos.
//  Poner las tarifas una al lado de otra empuja a elegir siempre la mas
//  barata y presiona al equipo a bajar precios entre ellos. Por eso las
//  funciones de esta seccion no devuelven importes: el precio aparece
//  una sola vez, al confirmar, y solo el de la combinacion elegida.

/**
 * Datos publicos de un barbero para las tarjetas del cliente.
 * Solo identidad y foto: nunca precios ni tarifas.
 */
function publicBarber(barber) {
  return {
    uid: barber.uid,
    name: barber.name,
    photoURL: barber.photoURL || '',
  }
}

/**
 * Que barberos ofrecen un servicio. SIN precio, a proposito.
 * Es lo que alimenta el paso "elige barbero" del asistente de reserva.
 *
 * @returns {Array<{barber:object}>}
 */
export function resolveBarbersForService({ services = [], rows = [], barbers = [], serviceId }) {
  return barbers
    .map((barber) => ({
      barber,
      offering: resolveOffering({ services, rows, barberId: barber.uid, serviceId }),
    }))
    .filter((entry) => entry.offering?.active)
    // Se descarta la oferta entera para no filtrar el precio a la vista
    .map(({ barber }) => ({ barber }))
}

/**
 * Catalogo visible para el cliente en el primer paso de la reserva:
 * los servicios de la barberia que ofrece al menos un barbero activo,
 * mas los servicios propios de cada barbero. Tampoco lleva precios.
 *
 * "approxDuration" es solo orientativa (la de referencia de la casa);
 * la real depende del barbero y se resuelve al elegirlo.
 */
export function resolveBookableServices({ services = [], rows = [], barbers = [] }) {
  const delCatalogo = services
    .filter((s) => s.active !== false)
    .map((service) => {
      const quienes = resolveBarbersForService({ services, rows, barbers, serviceId: service.id })
      if (!quienes.length) return null
      return {
        id: service.id,
        name: service.name,
        description: service.description,
        origin: OFFERING_ORIGIN.CATALOGO,
        approxDuration: Number(service.duration) || 30,
        barberCount: quienes.length,
        // Fotos de quienes lo hacen, para verlas sin abrir el servicio
        barbers: quienes.map(({ barber }) => publicBarber(barber)),
      }
    })
    .filter(Boolean)

  // Servicios propios: cada uno solo lo hace su barbero
  const activos = new Set(barbers.map((b) => b.uid))
  const porUid = Object.fromEntries(barbers.map((b) => [b.uid, b]))
  const propios = rows
    .filter((r) => !r.serviceId && r.active !== false && activos.has(r.barberId))
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      origin: OFFERING_ORIGIN.PROPIO,
      approxDuration: Number(r.duration) || 30,
      barberCount: 1,
      barberId: r.barberId,
      barbers: porUid[r.barberId] ? [publicBarber(porUid[r.barberId])] : [],
    }))

  return [...delCatalogo, ...propios].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'es')
  )
}

/**
 * Presupuesto de UNA combinacion concreta de barbero y servicio.
 *
 * Es lo unico con precio que se le entrega al cliente, y solo despues de
 * que haya elegido con quien se corta. Devuelve null si ese barbero no
 * ofrece ese servicio.
 *
 * @returns {{name:string, price:number, duration:number}|null}
 */
export function resolveQuote({ services = [], rows = [], barberId, serviceId }) {
  const oferta = resolveOffering({ services, rows, barberId, serviceId })
  if (!oferta || !oferta.active) return null
  return { name: oferta.name, price: oferta.price, duration: oferta.duration }
}
