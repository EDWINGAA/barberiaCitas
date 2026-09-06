/**
 * Colecciones "appointments" y "blocks" en Firestore.
 *
 * La validacion de disponibilidad reutiliza el MISMO motor puro que el
 * modo demo (@/utils/schedule), asi que las reglas de negocio son
 * identicas en ambos modos.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'

import {
  APPOINTMENT_STATUS,
  BLOCKING_APPOINTMENT_STATUS,
  MIN_HOURS_BEFORE_CANCEL,
  ROLES,
} from '@/constants'
import { COLLECTIONS, firestore } from '@/config/firebase'
import { createAppointmentModel, createBlockModel, nowISO } from '@/models'
import { addMinutes, hoursUntil, timeToMinutes, todayISO } from '@/utils/date'
import { buildBusyIntervals, computeSlots, findConflict, getOpeningForDate } from '@/utils/schedule'
import { docToObject, fail, run, snapshotToArray, stripUndefined } from './helpers'
import firebaseCatalog from './catalog'
import firebaseBarberServices from './barberServices'

/* ------------------------------------------------------------------ */
/*  Lecturas auxiliares                                                */
/* ------------------------------------------------------------------ */

/** Citas de un barbero en una fecha concreta */
async function barberAppointmentsOn(barberId, date) {
  const snapshot = await getDocs(
    query(
      collection(firestore(), COLLECTIONS.APPOINTMENTS),
      where('barberId', '==', barberId),
      where('date', '==', date)
    )
  )
  return snapshotToArray(snapshot)
}

/** Bloqueos de un barbero en una fecha concreta */
async function barberBlocksOn(barberId, date) {
  const snapshot = await getDocs(
    query(
      collection(firestore(), COLLECTIONS.BLOCKS),
      where('barberId', '==', barberId),
      where('date', '==', date)
    )
  )
  return snapshotToArray(snapshot)
}

/** Cursos del barbero que pueden bloquear su agenda */
async function barberCourses(barberId) {
  const snapshot = await getDocs(
    query(collection(firestore(), COLLECTIONS.COURSES), where('instructorId', '==', barberId))
  )
  return snapshotToArray(snapshot)
}

/** Carga en paralelo todo lo necesario para evaluar un dia */
async function loadDayContext(barberId, date) {
  const [appointments, blocks, courses, business] = await Promise.all([
    barberAppointmentsOn(barberId, date),
    barberBlocksOn(barberId, date),
    barberCourses(barberId),
    firebaseCatalog.business.get(),
  ])
  return { appointments, blocks, courses, business }
}

/* ------------------------------------------------------------------ */
/*  Validacion de disponibilidad                                       */
/* ------------------------------------------------------------------ */

async function assertSlotFree({ barberId, date, startTime, endTime, ignoreAppointmentId = null }) {
  const { appointments, blocks, courses, business } = await loadDayContext(barberId, date)

  const opening = getOpeningForDate(business.openingHours, date)
  if (!opening) fail('appointments/closed-day', 'La barberia no abre ese dia.')

  if (timeToMinutes(startTime) < timeToMinutes(opening.open)) {
    fail('appointments/outside-hours', `El horario de apertura es a las ${opening.open}.`)
  }
  if (timeToMinutes(endTime) > timeToMinutes(opening.close)) {
    fail('appointments/outside-hours', `El servicio no termina antes del cierre (${opening.close}).`)
  }

  const busy = buildBusyIntervals({ date, appointments, blocks, courses, ignoreAppointmentId })
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

async function list(filters = {}) {
  return run(async () => {
    const { clientId, barberId, serviceId, status, from, to } = filters
    const conditions = []

    // Se envia a Firestore un solo filtro de igualdad fuerte para no
    // exigir indices compuestos; el resto se afina en cliente.
    if (clientId) conditions.push(where('clientId', '==', clientId))
    else if (barberId) conditions.push(where('barberId', '==', barberId))

    const ref = collection(firestore(), COLLECTIONS.APPOINTMENTS)
    const snapshot = await getDocs(conditions.length ? query(ref, ...conditions) : ref)
    let rows = snapshotToArray(snapshot)

    if (clientId && barberId) rows = rows.filter((a) => a.barberId === barberId)
    if (serviceId) rows = rows.filter((a) => a.serviceId === serviceId)
    if (status) {
      const wanted = Array.isArray(status) ? status : [status]
      rows = rows.filter((a) => wanted.includes(a.status))
    }
    if (from) rows = rows.filter((a) => a.date >= from)
    if (to) rows = rows.filter((a) => a.date <= to)

    return rows.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
  }, 'appointments/list-failed')
}

async function get(id) {
  return run(
    async () => docToObject(await getDoc(doc(firestore(), COLLECTIONS.APPOINTMENTS, id))),
    'appointments/get-failed'
  )
}

/* ------------------------------------------------------------------ */
/*  Disponibilidad                                                     */
/* ------------------------------------------------------------------ */

async function getDaySlots({ barberId, date, serviceId, ignoreAppointmentId = null }) {
  return run(async () => {
    // La duracion la fija el barbero, no el catalogo
    const offering = await firebaseBarberServices.getOffering({ barberId, serviceId })
    if (!offering) fail('services/not-found', 'Ese barbero no ofrece este servicio.')
    if (!offering.active) fail('services/inactive', 'Ese barbero ya no ofrece este servicio.')

    const { appointments, blocks, courses, business } = await loadDayContext(barberId, date)

    return computeSlots({
      date,
      durationMinutes: offering.duration,
      openingHours: business.openingHours,
      appointments,
      blocks,
      courses,
      ignoreAppointmentId,
    })
  }, 'appointments/slots-failed')
}

async function getAvailableSlots(params) {
  const slots = await getDaySlots(params)
  return slots.filter((s) => s.available)
}

async function getAgendaDay({ barberId, date }) {
  return run(async () => {
    const { appointments, blocks, courses, business } = await loadDayContext(barberId, date)
    const busy = buildBusyIntervals({ date, appointments, blocks, courses })

    return {
      date,
      appointments: appointments.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      blocks,
      courseSessions: busy.filter((b) => b.type === 'curso'),
      opening: getOpeningForDate(business.openingHours, date),
    }
  }, 'appointments/agenda-failed')
}

/* ------------------------------------------------------------------ */
/*  Escrituras                                                         */
/* ------------------------------------------------------------------ */

async function create({ clientId, barberId, serviceId, date, startTime, notes = '', status }) {
  return run(async () => {
    const [client, barber, offering] = await Promise.all([
      getDoc(doc(firestore(), COLLECTIONS.USERS, clientId)),
      getDoc(doc(firestore(), COLLECTIONS.USERS, barberId)),
      // El precio y la duracion salen de lo que ofrece ESE barbero
      firebaseBarberServices.getOffering({ barberId, serviceId }),
    ])

    if (!client.exists()) fail('appointments/client-not-found', 'El cliente no existe.')

    const barberData = barber.exists() ? barber.data() : null
    if (!barberData || barberData.role !== ROLES.BARBERO) {
      fail('appointments/barber-not-found', 'El barbero no existe.')
    }
    if (barberData.active === false) {
      fail('appointments/barber-inactive', 'Ese barbero no esta disponible.')
    }

    if (!offering) fail('services/not-found', 'Ese barbero no ofrece este servicio.')
    if (!offering.active) fail('services/inactive', 'Ese barbero ya no ofrece este servicio.')

    if (date < todayISO()) fail('appointments/past-date', 'No puedes agendar en una fecha pasada.')

    const endTime = addMinutes(startTime, offering.duration)
    await assertSlotFree({ barberId, date, startTime, endTime })

    const model = createAppointmentModel({
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

    const { id: _id, ...payload } = model
    const created = await addDoc(collection(firestore(), COLLECTIONS.APPOINTMENTS), payload)
    return { ...model, id: created.id }
  }, 'appointments/create-failed')
}

async function setStatus(id, status) {
  return run(async () => {
    if (!Object.values(APPOINTMENT_STATUS).includes(status)) {
      fail('appointments/invalid-status', 'Estado de cita no valido.')
    }
    await updateDoc(doc(firestore(), COLLECTIONS.APPOINTMENTS, id), {
      status,
      updatedAt: nowISO(),
    })
    return get(id)
  }, 'appointments/status-failed')
}

async function cancel(id, { force = false } = {}) {
  return run(async () => {
    const appointment = await get(id)
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
    return setStatus(id, APPOINTMENT_STATUS.CANCELADA)
  }, 'appointments/cancel-failed')
}

async function reschedule(id, { date, startTime, barberId }) {
  return run(async () => {
    const appointment = await get(id)
    if (!appointment) fail('appointments/not-found', 'La cita no existe.')
    if ([APPOINTMENT_STATUS.COMPLETADA, APPOINTMENT_STATUS.CANCELADA].includes(appointment.status)) {
      fail('appointments/not-reschedulable', 'Esta cita ya no se puede reagendar.')
    }

    const targetBarber = barberId || appointment.barberId

    // Al reagendar (y mas si se cambia de barbero) hay que recalcular con
    // la duracion y el precio del barbero que la va a atender.
    const offering = await firebaseBarberServices.getOffering({
      barberId: targetBarber,
      serviceId: appointment.serviceId,
    })
    if (!offering) fail('services/not-found', 'Ese barbero no ofrece el servicio de esta cita.')
    if (!offering.active) fail('services/inactive', 'Ese barbero ya no ofrece este servicio.')

    if (date < todayISO()) fail('appointments/past-date', 'No puedes reagendar a una fecha pasada.')

    const endTime = addMinutes(startTime, offering.duration)
    await assertSlotFree({
      barberId: targetBarber,
      date,
      startTime,
      endTime,
      ignoreAppointmentId: id,
    })

    await updateDoc(doc(firestore(), COLLECTIONS.APPOINTMENTS, id), {
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
    return get(id)
  }, 'appointments/reschedule-failed')
}

async function updateAppointment(id, data) {
  return run(async () => {
    const changes = stripUndefined({
      notes: data.notes,
      status: data.status,
      updatedAt: nowISO(),
    })
    await updateDoc(doc(firestore(), COLLECTIONS.APPOINTMENTS, id), changes)
    return get(id)
  }, 'appointments/update-failed')
}

async function removeAppointment(id) {
  return run(async () => {
    await deleteDoc(doc(firestore(), COLLECTIONS.APPOINTMENTS, id))
    return true
  }, 'appointments/remove-failed')
}

/* ================================================================== */
/*  blocks                                                             */
/* ================================================================== */

async function listBlocks({ barberId, from, to } = {}) {
  return run(async () => {
    const ref = collection(firestore(), COLLECTIONS.BLOCKS)
    const snapshot = await getDocs(barberId ? query(ref, where('barberId', '==', barberId)) : ref)
    let rows = snapshotToArray(snapshot)
    if (from) rows = rows.filter((b) => b.date >= from)
    if (to) rows = rows.filter((b) => b.date <= to)
    return rows.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
  }, 'blocks/list-failed')
}

async function createBlock(data) {
  return run(async () => {
    if (timeToMinutes(data.endTime) <= timeToMinutes(data.startTime)) {
      fail('blocks/invalid-range', 'La hora de fin debe ser posterior a la de inicio.')
    }

    const appointments = await barberAppointmentsOn(data.barberId, data.date)
    const clash = appointments.find(
      (a) =>
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

    const model = createBlockModel(data)
    const { id: _id, ...payload } = model
    const created = await addDoc(collection(firestore(), COLLECTIONS.BLOCKS), payload)
    return { ...model, id: created.id }
  }, 'blocks/create-failed')
}

async function removeBlock(id) {
  return run(async () => {
    await deleteDoc(doc(firestore(), COLLECTIONS.BLOCKS, id))
    return true
  }, 'blocks/remove-failed')
}

export const firebaseAppointments = {
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

export default firebaseAppointments
