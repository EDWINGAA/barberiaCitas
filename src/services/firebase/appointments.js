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
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

import {
  APPOINTMENT_STATUS,
  BLOCKING_APPOINTMENT_STATUS,
  CHAT_CLOSING_STATUS,
  MIN_HOURS_BEFORE_CANCEL,
  ROLES,
} from '@/constants'
import { COLLECTIONS, firebaseAuth, firestore } from '@/config/firebase'
import { createAppointmentModel, createBlockModel, nowISO } from '@/models'
import { addMinutes, hoursUntil, timeToMinutes, todayISO } from '@/utils/date'
import { buildBusyIntervals, computeSlots, findConflict, getOpeningForDate } from '@/utils/schedule'
import { docToObject, fail, run, snapshotToArray, stripUndefined } from './helpers'
import firebaseCatalog from './catalog'
import firebaseBarberServices from './barberServices'
import firebaseMessages from './messages'
import { checkCanBook } from '@/services/bookingPolicy'

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

/* ------------------------------------------------------------------ */
/*  Espejo publico de ocupacion                                        */
/* ------------------------------------------------------------------ */

/*
 * Por que existe la coleccion "busy".
 *
 * Para saber que huecos quedan libres hay que conocer las horas que ya
 * tiene ocupadas el barbero. Pero un cliente NO puede leer las citas de
 * los demas: las reglas solo le dejan ver las suyas.
 *
 * Y en Firestore las reglas no filtran, autorizan: una consulta del
 * tipo "citas del barbero X el dia Y" no puede demostrar que todos los
 * resultados serian del propio cliente, asi que se rechaza entera,
 * incluso cuando no hay ninguna cita.
 *
 * La solucion es este espejo: por cada cita que ocupa la silla se
 * guarda un documento con el MISMO id que la cita y solo cuatro campos
 * -barbero, fecha, hora de inicio y hora de fin-. Ni quien viene, ni
 * que servicio, ni cuanto paga, ni las notas. Con eso basta para
 * calcular huecos, y las citas de verdad siguen siendo privadas.
 */

/** Referencia al documento de ocupacion de una cita */
function ocupacionRef(citaId) {
  return doc(firestore(), COLLECTIONS.BUSY, citaId)
}

/**
 * Deja la ocupacion en linea con la cita.
 *
 * Si la cita ocupa la silla se escribe (o se actualiza) su documento; si
 * esta cancelada, marcada como no asistio o ya no existe, se borra para
 * liberar el hueco.
 */
async function sincronizarOcupacion(citaId, cita) {
  const ocupa = cita && BLOCKING_APPOINTMENT_STATUS.includes(cita.status)

  if (ocupa) {
    await setDoc(ocupacionRef(citaId), {
      barberId: cita.barberId,
      date: cita.date,
      startTime: cita.startTime,
      endTime: cita.endTime,
    })
    return
  }

  try {
    await deleteDoc(ocupacionRef(citaId))
  } catch {
    // Puede no existir todavia: no es un fallo
  }
}

/* ------------------------------------------------------------------ */
/*  Cerradura de reserva activa                                        */
/* ------------------------------------------------------------------ */

/*
 * Por que existe la coleccion "activeBooking".
 *
 * La politica dice que un cliente solo puede tener una cita en pie. Eso
 * se comprueba en el codigo, pero el codigo solo protege a quien usa la
 * aplicacion: cualquiera con la consola del navegador abierta puede
 * hablar con la base de datos directamente y crear cien citas.
 *
 * Contar citas es justo lo que las reglas de Firestore NO saben hacer.
 * Lo que si saben es mirar si existe un documento con un id concreto.
 *
 * De ahi la cerradura: un documento por cliente, cuyo id ES su uid, que
 * apunta a la cita que tiene en pie. Las reglas exigen que exista y que
 * apunte a la cita que se esta creando, asi que un cliente no puede
 * tener dos: la segunda cerradura no se deja crear porque la primera
 * sigue ahi.
 *
 * Se libera sola cuando la cita termina.
 */

function cerraduraRef(clientId) {
  return doc(firestore(), COLLECTIONS.ACTIVE_BOOKING, clientId)
}

/** Pone la cerradura del cliente apuntando a una cita */
async function ponerCerradura(clientId, citaId) {
  await setDoc(cerraduraRef(clientId), { appointmentId: citaId })
}

/** La suelta, para que el cliente pueda volver a reservar */
async function soltarCerradura(clientId) {
  if (!clientId) return
  try {
    await deleteDoc(cerraduraRef(clientId))
  } catch {
    // Puede no existir: no es un fallo
  }
}

/**
 * Cierra todo lo que cuelga de una cita cuando esta llega a su fin.
 *
 * Son dos cosas, y las dos pasan al completarla, cancelarla o marcar que
 * no asistio:
 *
 *   - Se suelta la cerradura, para que el cliente pueda reservar otra.
 *   - Se borra la conversacion: el chat existe para esa sesion concreta
 *     y si no la coleccion engordaria con miles de mensajes viejos que
 *     encarecerian cada consulta.
 *
 * Nunca hace fallar la operacion principal. Si el borrado no sale, la
 * cita ya cambio de estado y eso es lo que importa; el hilo quedaria
 * huerfano pero invisible, porque el chat solo se muestra mientras la
 * cita esta confirmada.
 */
async function cerrarCita(citaId, cita) {
  if (!cita || !CHAT_CLOSING_STATUS.includes(cita.status)) return
  // La cita termino: el cliente vuelve a poder reservar
  await soltarCerradura(cita.clientId)

  // El rol se deduce comparando con la propia cita, sin depender de
  // quien llame: barbero, cliente o administrador.
  const uid = firebaseAuth().currentUser?.uid || null
  let role = ROLES.ADMIN
  if (uid && uid === cita.barberId) role = ROLES.BARBERO
  else if (uid && uid === cita.clientId) role = ROLES.CLIENTE

  try {
    await firebaseMessages.purgeThread({ appointmentId: citaId, userId: uid, role })
  } catch (error) {
    console.warn('[messages] no se pudo borrar la conversacion de la cita', citaId, error?.code)
  }
}

/**
 * Horas ocupadas de un barbero en una fecha, con la forma que espera el
 * motor de disponibilidad. El estado es siempre uno que bloquea, porque
 * las citas que no bloquean ni siquiera tienen documento aqui.
 */
async function barberBusyOn(barberId, date) {
  const snapshot = await getDocs(
    query(
      collection(firestore(), COLLECTIONS.BUSY),
      where('barberId', '==', barberId),
      where('date', '==', date)
    )
  )
  return snapshotToArray(snapshot).map((o) => ({
    id: o.id,
    date: o.date,
    startTime: o.startTime,
    endTime: o.endTime,
    status: APPOINTMENT_STATUS.CONFIRMADA,
  }))
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

/**
 * Todo lo necesario para calcular huecos libres.
 *
 * Lee el espejo de ocupacion, no las citas: asi tambien funciona para un
 * cliente, que no tiene permiso para leer las citas de los demas.
 */
async function loadDayContext(barberId, date) {
  const [appointments, blocks, courses, business] = await Promise.all([
    barberBusyOn(barberId, date),
    barberBlocksOn(barberId, date),
    barberCourses(barberId),
    firebaseCatalog.business.get(),
  ])
  return { appointments, blocks, courses, business }
}

/**
 * Lo mismo, pero con las citas completas. Solo lo usa la agenda del
 * barbero y del administrador, que si tienen permiso para verlas.
 */
async function loadAgendaContext(barberId, date) {
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
    const { appointments, blocks, courses, business } = await loadAgendaContext(barberId, date)
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

    /*
     * Limites contra el abuso. Se saltan si la cita la crea el barbero o
     * el administrador a mano (llega "status"), porque entonces hay
     * alguien de la casa decidiendo.
     */
    if (!status) {
      const suyas = await list({ clientId })
      const veto = checkCanBook({ appointments: suyas, today: todayISO() })
      if (veto) fail(veto.code, veto.message)
    }

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

    /*
     * El id se reserva ANTES de escribir nada. Asi la cerradura puede
     * apuntar a la cita todavia inexistente, y las reglas comprueban al
     * crearla que la cerradura ya la estaba esperando: sin ese orden,
     * entre las dos escrituras habria un hueco por el que colar una
     * segunda cita.
     */
    const ref = doc(collection(firestore(), COLLECTIONS.APPOINTMENTS))
    await ponerCerradura(clientId, ref.id)

    try {
      await setDoc(ref, payload)
    } catch (error) {
      // Si la cita no llega a crearse, la cerradura no puede quedarse
      // puesta o el cliente no podria volver a intentarlo.
      await soltarCerradura(clientId)
      throw error
    }

    // La cita ya existe: ahora se refleja en el espejo de ocupacion
    await sincronizarOcupacion(ref.id, model)

    return { ...model, id: ref.id }
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

    // Cancelar o marcar "no asistio" libera el hueco; volver a un estado
    // activo lo vuelve a ocupar.
    const actualizada = await get(id)
    await sincronizarOcupacion(id, actualizada)
    await cerrarCita(id, actualizada)

    return actualizada
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

    // Cambia de dia, de hora o hasta de barbero: la ocupacion se rehace
    const movida = await get(id)
    await sincronizarOcupacion(id, movida)

    return movida
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

    const actualizada = await get(id)
    // "changes" puede traer un estado nuevo, asi que se revisa siempre
    await sincronizarOcupacion(id, actualizada)
    await cerrarCita(id, actualizada)

    return actualizada
  }, 'appointments/update-failed')
}

async function removeAppointment(id) {
  return run(async () => {
    // Primero la ocupacion y la conversacion: las reglas comprueban de
    // quien es la cita, y para eso la cita todavia tiene que existir.
    const cita = await get(id)
    await sincronizarOcupacion(id, null)
    await cerrarCita(id, cita ? { ...cita, status: APPOINTMENT_STATUS.CANCELADA } : null)
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
