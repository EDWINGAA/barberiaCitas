/**
 * Colecciones "appointments" y "blocks" en MODO DEMO.
 *
 * Aqui vive la validacion de disponibilidad: ninguna doble reserva del
 * mismo barbero, nada encima de un horario bloqueado y nada encima de
 * una sesion de curso que el barbero imparte.
 */

import {
  APPOINTMENT_STATUS,
  BLOCKING_APPOINTMENT_STATUS,
  MIN_HOURS_BEFORE_CANCEL,
  ROLES,
} from '@/constants'
import { createAppointmentModel, createBlockModel, nowISO } from '@/models'
import { addMinutes, hoursUntil, timeToMinutes, todayISO } from '@/utils/date'
import { buildBusyIntervals, computeSlots, findConflict, getOpeningForDate } from '@/utils/schedule'
import { resolveOffering } from '@/services/offeringsCore'
import { clone, delay, fail, findById, getDB, insert, readCollection, saveDB, update } from './store'

/* ------------------------------------------------------------------ */
/*  Validacion interna de un hueco                                     */
/* ------------------------------------------------------------------ */

/**
 * Comprueba que [startTime, endTime) del barbero indicado esta libre y
 * dentro del horario del negocio. Lanza ServiceError si no lo esta.
 */
function assertSlotFree({ barberId, date, startTime, endTime, ignoreAppointmentId = null }) {
  const db = getDB()

  const opening = getOpeningForDate(db.business.openingHours, date)
  if (!opening) fail('appointments/closed-day', 'La barberia no abre ese dia.')

  if (timeToMinutes(startTime) < timeToMinutes(opening.open)) {
    fail('appointments/outside-hours', `El horario de apertura es a las ${opening.open}.`)
  }
  if (timeToMinutes(endTime) > timeToMinutes(opening.close)) {
    fail('appointments/outside-hours', `El servicio no termina antes del cierre (${opening.close}).`)
  }

  const busy = buildBusyIntervals({
    date,
    appointments: db.appointments.filter((a) => a.barberId === barberId),
    blocks: db.blocks.filter((b) => b.barberId === barberId),
    courses: db.courses.filter((c) => c.instructorId === barberId),
    ignoreAppointmentId,
  })

  const conflict = findConflict(startTime, endTime, busy)
  if (conflict) {
    const messages = {
      cita: 'El barbero ya tiene una cita en ese horario.',
      bloqueo: `El barbero no esta disponible: ${conflict.label}.`,
      curso: `El barbero imparte el curso "${conflict.label}" en ese horario.`,
    }
    fail(`appointments/conflict-${conflict.type}`, messages[conflict.type] || 'Horario no disponible.')
  }
}

/* ------------------------------------------------------------------ */
/*  Consultas                                                          */
/* ------------------------------------------------------------------ */

/**
 * Lista citas con filtros combinables.
 * @param {{clientId?:string, barberId?:string, serviceId?:string,
 *          status?:string|string[], from?:string, to?:string}} filters
 */
async function list(filters = {}) {
  await delay()
  const { clientId, barberId, serviceId, status, from, to } = filters
  let rows = readCollection('appointments')

  if (clientId) rows = rows.filter((a) => a.clientId === clientId)
  if (barberId) rows = rows.filter((a) => a.barberId === barberId)
  if (serviceId) rows = rows.filter((a) => a.serviceId === serviceId)
  if (status) {
    const list_ = Array.isArray(status) ? status : [status]
    rows = rows.filter((a) => list_.includes(a.status))
  }
  if (from) rows = rows.filter((a) => a.date >= from)
  if (to) rows = rows.filter((a) => a.date <= to)

  // Orden cronologico ascendente
  return rows.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
}

async function get(id) {
  await delay(90)
  const row = findById('appointments', id)
  return row ? clone(row) : null
}

/* ------------------------------------------------------------------ */
/*  Disponibilidad                                                     */
/* ------------------------------------------------------------------ */

/**
 * Todos los horarios de un dia con su estado (libre / ocupado y motivo).
 * Lo usa la agenda del barbero.
 */
async function getDaySlots({ barberId, date, serviceId, ignoreAppointmentId = null }) {
  await delay(160)
  const db = getDB()

  // La duracion la fija el barbero, no el catalogo: dos barberos pueden
  // tardar distinto en el mismo servicio y los huecos deben reflejarlo.
  const offering = resolveOffering({
    services: db.services,
    rows: db.barberServices || [],
    barberId,
    serviceId,
  })
  if (!offering) fail('services/not-found', 'Ese barbero no ofrece este servicio.')
  if (!offering.active) fail('services/inactive', 'Ese barbero ya no ofrece este servicio.')

  return computeSlots({
    date,
    durationMinutes: offering.duration,
    openingHours: db.business.openingHours,
    appointments: db.appointments.filter((a) => a.barberId === barberId),
    blocks: db.blocks.filter((b) => b.barberId === barberId),
    courses: db.courses.filter((c) => c.instructorId === barberId),
    ignoreAppointmentId,
  })
}

/** Solo los horarios libres, que es lo que consume el asistente de reserva */
async function getAvailableSlots(params) {
  const slots = await getDaySlots(params)
  return slots.filter((s) => s.available)
}

/**
 * Vista de agenda de un dia: citas del barbero (con datos ya resueltos)
 * mas bloqueos y sesiones de curso.
 */
async function getAgendaDay({ barberId, date }) {
  await delay(160)
  const db = getDB()

  const appointments = db.appointments
    .filter((a) => a.barberId === barberId && a.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((a) => clone(a))

  const busy = buildBusyIntervals({
    date,
    appointments: db.appointments.filter((a) => a.barberId === barberId),
    blocks: db.blocks.filter((b) => b.barberId === barberId),
    courses: db.courses.filter((c) => c.instructorId === barberId),
  })

  return {
    date,
    appointments,
    blocks: db.blocks.filter((b) => b.barberId === barberId && b.date === date).map(clone),
    courseSessions: busy.filter((b) => b.type === 'curso'),
    opening: getOpeningForDate(db.business.openingHours, date),
  }
}

/* ------------------------------------------------------------------ */
/*  Escrituras                                                         */
/* ------------------------------------------------------------------ */

/** Crea una cita validando disponibilidad completa */
async function create({ clientId, barberId, serviceId, date, startTime, notes = '', status }) {
  await delay()
  const db = getDB()

  const client = db.users.find((u) => u.uid === clientId)
  if (!client) fail('appointments/client-not-found', 'El cliente no existe.')

  const barber = db.users.find((u) => u.uid === barberId)
  if (!barber || barber.role !== ROLES.BARBERO) fail('appointments/barber-not-found', 'El barbero no existe.')
  if (!barber.active) fail('appointments/barber-inactive', 'Ese barbero no esta disponible.')

  // El precio y la duracion salen de lo que ofrece ESE barbero
  const offering = resolveOffering({
    services: db.services,
    rows: db.barberServices || [],
    barberId,
    serviceId,
  })
  if (!offering) fail('services/not-found', 'Ese barbero no ofrece este servicio.')
  if (!offering.active) fail('services/inactive', 'Ese barbero ya no ofrece este servicio.')

  if (date < todayISO()) fail('appointments/past-date', 'No puedes agendar en una fecha pasada.')

  const endTime = addMinutes(startTime, offering.duration)
  assertSlotFree({ barberId, date, startTime, endTime })

  const appointment = createAppointmentModel({
    clientId,
    barberId,
    serviceId,
    serviceName: offering.name,
    date,
    startTime,
    endTime,
    status: status || APPOINTMENT_STATUS.PENDIENTE,
    notes,
    price: offering.price,
  })

  return insert('appointments', appointment)
}

/** Cambia el estado de una cita */
async function setStatus(id, status) {
  await delay()
  if (!Object.values(APPOINTMENT_STATUS).includes(status)) {
    fail('appointments/invalid-status', 'Estado de cita no valido.')
  }
  const result = update('appointments', id, { status, updatedAt: nowISO() })
  if (!result) fail('appointments/not-found', 'La cita no existe.')
  return result
}

/** Cancelacion por parte del cliente, con margen minimo de antelacion */
async function cancel(id, { force = false } = {}) {
  await delay()
  const appointment = findById('appointments', id)
  if (!appointment) fail('appointments/not-found', 'La cita no existe.')

  if (appointment.status === APPOINTMENT_STATUS.CANCELADA) {
    fail('appointments/already-cancelled', 'Esta cita ya estaba cancelada.')
  }
  if (appointment.status === APPOINTMENT_STATUS.COMPLETADA) {
    fail('appointments/already-done', 'No puedes cancelar una cita ya completada.')
  }
  if (!force && hoursUntil(appointment.date, appointment.startTime) < MIN_HOURS_BEFORE_CANCEL) {
    fail(
      'appointments/too-late',
      `Las citas solo pueden cancelarse con al menos ${MIN_HOURS_BEFORE_CANCEL} horas de antelacion. Llamanos por telefono.`
    )
  }

  return update('appointments', id, { status: APPOINTMENT_STATUS.CANCELADA, updatedAt: nowISO() })
}

/** Reagenda una cita a otra fecha/hora (y opcionalmente otro barbero) */
async function reschedule(id, { date, startTime, barberId }) {
  await delay()
  const db = getDB()
  const appointment = db.appointments.find((a) => a.id === id)
  if (!appointment) fail('appointments/not-found', 'La cita no existe.')

  if ([APPOINTMENT_STATUS.COMPLETADA, APPOINTMENT_STATUS.CANCELADA].includes(appointment.status)) {
    fail('appointments/not-reschedulable', 'Esta cita ya no se puede reagendar.')
  }

  const targetBarber = barberId || appointment.barberId

  // Al reagendar (y mas si se cambia de barbero) hay que recalcular con
  // la duracion del barbero que la va a atender.
  const offering = resolveOffering({
    services: db.services,
    rows: db.barberServices || [],
    barberId: targetBarber,
    serviceId: appointment.serviceId,
  })
  if (!offering) fail('services/not-found', 'Ese barbero no ofrece el servicio de esta cita.')
  if (!offering.active) fail('services/inactive', 'Ese barbero ya no ofrece este servicio.')

  if (date < todayISO()) fail('appointments/past-date', 'No puedes reagendar a una fecha pasada.')

  const endTime = addMinutes(startTime, offering.duration)
  assertSlotFree({
    barberId: targetBarber,
    date,
    startTime,
    endTime,
    ignoreAppointmentId: id,
  })

  return update('appointments', id, {
    barberId: targetBarber,
    date,
    startTime,
    endTime,
    // Cambiar de barbero puede cambiar el precio: se congela el nuevo
    price: offering.price,
    serviceName: offering.name,
    status: APPOINTMENT_STATUS.PENDIENTE,
    updatedAt: nowISO(),
  })
}

/** Edicion generica (notas, estado...) usada por barbero y administrador */
async function updateAppointment(id, data) {
  await delay()
  const changes = {}
  ;['notes', 'status'].forEach((key) => {
    if (data[key] !== undefined) changes[key] = data[key]
  })
  changes.updatedAt = nowISO()
  const result = update('appointments', id, changes)
  if (!result) fail('appointments/not-found', 'La cita no existe.')
  return result
}

/** Borrado definitivo (solo administrador) */
async function removeAppointment(id) {
  await delay()
  const db = getDB()
  const index = db.appointments.findIndex((a) => a.id === id)
  if (index === -1) fail('appointments/not-found', 'La cita no existe.')
  db.appointments.splice(index, 1)
  saveDB()
  return true
}

/* ================================================================== */
/*  blocks                                                             */
/* ================================================================== */

async function listBlocks({ barberId, from, to } = {}) {
  await delay()
  let rows = readCollection('blocks')
  if (barberId) rows = rows.filter((b) => b.barberId === barberId)
  if (from) rows = rows.filter((b) => b.date >= from)
  if (to) rows = rows.filter((b) => b.date <= to)
  return rows.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
}

/**
 * Crea un bloqueo. Si ya hay citas activas dentro de la franja, se avisa
 * al barbero para que las gestione antes (no se borran a la brava).
 */
async function createBlock(data) {
  await delay()
  const db = getDB()

  if (timeToMinutes(data.endTime) <= timeToMinutes(data.startTime)) {
    fail('blocks/invalid-range', 'La hora de fin debe ser posterior a la de inicio.')
  }

  const clash = db.appointments.find(
    (a) =>
      a.barberId === data.barberId &&
      a.date === data.date &&
      BLOCKING_APPOINTMENT_STATUS.includes(a.status) &&
      timeToMinutes(a.startTime) < timeToMinutes(data.endTime) &&
      timeToMinutes(data.startTime) < timeToMinutes(a.endTime)
  )
  if (clash) {
    fail(
      'blocks/appointment-clash',
      `Tienes una cita a las ${clash.startTime} dentro de esa franja. Cancelala o reagendala primero.`
    )
  }

  return insert('blocks', createBlockModel(data))
}

async function removeBlock(id) {
  await delay()
  const db = getDB()
  const index = db.blocks.findIndex((b) => b.id === id)
  if (index === -1) fail('blocks/not-found', 'El bloqueo no existe.')
  db.blocks.splice(index, 1)
  saveDB()
  return true
}

export const mockAppointments = {
  appointments: {
    list,
    get,
    create,
    update: updateAppointment,
    setStatus,
    cancel,
    reschedule,
    remove: removeAppointment,
    getAvailableSlots,
    getDaySlots,
    getAgendaDay,
  },
  blocks: {
    list: listBlocks,
    create: createBlock,
    remove: removeBlock,
  },
}

export default mockAppointments
