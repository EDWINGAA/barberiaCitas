/**
 * Coleccion "messages" en Firestore.
 *
 * Chat privado entre el cliente y el barbero de una cita. Misma API que
 * la version mock.
 *
 * Cada mensaje lleva copiados "appointmentId", "clientId" y "barberId".
 * En Firestore las reglas NO filtran: una consulta solo pasa si esta
 * acotada por el mismo campo que comprueba la regla. Por eso todas las
 * consultas llevan el lado del usuario (clientId o barberId), y las que
 * ademas miran un hilo concreto anaden el appointmentId en la propia
 * consulta en lugar de filtrar en memoria.
 *
 * La conversacion MUERE CON LA CITA: al completarla, cancelarla o marcar
 * que no asistio se borra entera. Eso mantiene la coleccion pequena, que
 * es lo que de verdad abarata cada lectura.
 */

import { addDoc, collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore'

import { CHAT_WRITABLE_STATUS, MESSAGE_MAX_LENGTH, ROLES } from '@/constants'
import { COLLECTIONS, firestore } from '@/config/firebase'
import { createMessageModel } from '@/models'
import { fail, run, snapshotToArray } from './helpers'

/* ------------------------------------------------------------------ */
/*  Ayudantes                                                          */
/* ------------------------------------------------------------------ */

async function getAppointment(id) {
  const snap = await getDoc(doc(firestore(), COLLECTIONS.APPOINTMENTS, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

function participantRole(appointment, userId) {
  if (!appointment || !userId) return null
  if (appointment.clientId === userId) return ROLES.CLIENTE
  if (appointment.barberId === userId) return ROLES.BARBERO
  return null
}

/** Campo que identifica al usuario dentro de un mensaje, segun su rol */
function ownerField(role) {
  return role === ROLES.BARBERO ? 'barberId' : 'clientId'
}

/** Campo de "leido" que le corresponde a un rol */
function readField(role) {
  return role === ROLES.BARBERO ? 'readByBarber' : 'readByClient'
}

/** Referencia a la coleccion, para no repetirla en cada consulta */
function coleccion() {
  return collection(firestore(), COLLECTIONS.MESSAGES)
}

/**
 * Todos los mensajes del usuario.
 *
 * La consulta va acotada por su lado (clientId o barberId) porque es la
 * unica forma de que las reglas la dejen pasar: en Firestore una
 * consulta solo se acepta si esta limitada por el mismo campo que
 * comprueba la regla.
 *
 * Solo la usan las pantallas que necesitan ver TODAS las conversaciones
 * a la vez. Como los hilos se borran al terminar la cita, aqui nunca hay
 * mas que las citas confirmadas en curso.
 */
function messagesOf(userId, role) {
  return getDocs(query(coleccion(), where(ownerField(role), '==', userId)))
}

/**
 * Mensajes de UNA cita concreta.
 *
 * Lleva las dos condiciones a la vez: el lado del usuario (para que las
 * reglas la acepten) y la cita (para no descargar de mas). Antes se
 * pedian todos los mensajes del usuario y se filtraba en memoria, lo que
 * con el refresco automatico del chat abierto multiplicaba el coste por
 * cada mensaje acumulado.
 *
 * El administrador no es participante de ninguna cita, asi que consulta
 * por la cita a secas: su regla no mira los campos del documento.
 */
function threadOf(appointmentId, userId, role) {
  if (role === ROLES.ADMIN) {
    return getDocs(query(coleccion(), where('appointmentId', '==', appointmentId)))
  }
  return getDocs(
    query(
      coleccion(),
      where(ownerField(role), '==', userId),
      where('appointmentId', '==', appointmentId)
    )
  )
}

/* ------------------------------------------------------------------ */
/*  Consultas                                                          */
/* ------------------------------------------------------------------ */

async function listThread({ appointmentId, userId, role }) {
  return run(async () => {
    const snap = await threadOf(appointmentId, userId, role)
    return snapshotToArray(snap).sort((a, b) =>
      String(a.createdAt).localeCompare(String(b.createdAt))
    )
  }, 'messages/list-failed')
}

/**
 * Resumen de cada conversacion del usuario (una por cita con mensajes):
 * ultimo mensaje, hora, quien lo envio y cuantos quedan sin leer.
 * Ordenadas de la mas reciente a la mas antigua.
 */
async function listConversations({ userId, role }) {
  return run(async () => {
    const side = role === ROLES.BARBERO ? ROLES.BARBERO : ROLES.CLIENTE
    const field = readField(side)
    const snap = await messagesOf(userId, side)

    const byAppt = new Map()
    snap.docs.forEach((d) => {
      const m = d.data()
      const cur =
        byAppt.get(m.appointmentId) ||
        { appointmentId: m.appointmentId, lastText: '', lastAt: '', lastSenderId: '', unread: 0, total: 0 }
      cur.total += 1
      if (m[field] === false) cur.unread += 1
      if (String(m.createdAt) >= String(cur.lastAt)) {
        cur.lastText = m.text
        cur.lastAt = m.createdAt
        cur.lastSenderId = m.senderId
      }
      byAppt.set(m.appointmentId, cur)
    })

    return [...byAppt.values()].sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))
  }, 'messages/conversations-failed')
}

/**
 * Mensajes sin leer del usuario, agrupados por cita: { [appointmentId]: n }.
 */
async function unreadCounts({ userId, role }) {
  return run(async () => {
    const side = role === ROLES.BARBERO ? ROLES.BARBERO : ROLES.CLIENTE
    const field = readField(side)
    const snap = await messagesOf(userId, side)

    const counts = {}
    snap.docs.forEach((d) => {
      const m = d.data()
      if (m[field] === false) {
        counts[m.appointmentId] = (counts[m.appointmentId] || 0) + 1
      }
    })
    return counts
  }, 'messages/unread-failed')
}

/* ------------------------------------------------------------------ */
/*  Escrituras                                                         */
/* ------------------------------------------------------------------ */

async function send({ appointmentId, senderId, text }) {
  return run(async () => {
    const appointment = await getAppointment(appointmentId)
    if (!appointment) fail('messages/appointment-not-found', 'La cita no existe.')

    const role = participantRole(appointment, senderId)
    if (!role) fail('messages/forbidden', 'No puedes escribir en esta conversacion.')

    if (!CHAT_WRITABLE_STATUS.includes(appointment.status)) {
      fail(
        'messages/chat-closed',
        'El chat solo esta disponible mientras la cita esta confirmada.'
      )
    }

    const limpio = String(text || '').trim()
    if (!limpio) fail('messages/empty', 'Escribe un mensaje.')

    const model = createMessageModel({
      appointmentId,
      clientId: appointment.clientId,
      barberId: appointment.barberId,
      senderId,
      senderRole: role,
      text: limpio.slice(0, MESSAGE_MAX_LENGTH),
    })
    const { id: _id, ...payload } = model
    const created = await addDoc(collection(firestore(), COLLECTIONS.MESSAGES), payload)
    return { ...model, id: created.id }
  }, 'messages/send-failed')
}

async function markRead({ appointmentId, userId, role }) {
  return run(async () => {
    const side = role === ROLES.BARBERO ? ROLES.BARBERO : ROLES.CLIENTE
    const field = readField(side)

    const snap = await threadOf(appointmentId, userId, side)
    const pendientes = snap.docs.filter((d) => d.data()[field] === false)
    if (!pendientes.length) return 0

    const batch = writeBatch(firestore())
    pendientes.forEach((d) => batch.update(d.ref, { [field]: true }))
    await batch.commit()
    return pendientes.length
  }, 'messages/read-failed')
}

/**
 * Borra la conversacion entera de una cita.
 *
 * Se llama sola cuando la cita termina (completada, cancelada o no
 * asistio): el chat sirve para esa sesion y despues no tiene por que
 * seguir ocupando sitio ni encareciendo cada consulta.
 *
 * Devuelve cuantos mensajes se borraron.
 */
async function purgeThread({ appointmentId, userId, role }) {
  return run(async () => {
    if (!appointmentId) return 0

    const snap = await threadOf(appointmentId, userId, role)
    if (snap.empty) return 0

    /*
     * writeBatch admite 500 operaciones. Un hilo de una cita nunca se
     * acerca a eso, pero se trocea igual para que nunca falle un borrado
     * por una conversacion inusualmente larga.
     */
    const docs = snap.docs
    for (let i = 0; i < docs.length; i += 450) {
      const lote = writeBatch(firestore())
      docs.slice(i, i + 450).forEach((d) => lote.delete(d.ref))
      // eslint-disable-next-line no-await-in-loop -- los lotes van en orden
      await lote.commit()
    }
    return docs.length
  }, 'messages/purge-failed')
}

export const firebaseMessages = {
  listThread,
  send,
  markRead,
  unreadCounts,
  listConversations,
  purgeThread,
}

export default firebaseMessages
