/**
 * Coleccion "messages" en Firestore.
 *
 * Chat privado entre el cliente y el barbero de una cita. Misma API que
 * la version mock.
 *
 * Cada mensaje lleva copiados "appointmentId", "clientId" y "barberId".
 * En Firestore las reglas NO filtran: una consulta solo pasa si esta
 * acotada por el mismo campo que comprueba la regla. Por eso aqui SIEMPRE
 * se consulta por el lado del usuario (clientId o barberId) y el hilo
 * concreto se recorta en memoria. Asi no hacen falta indices compuestos
 * ni un espejo de datos como el de "busy".
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

/**
 * Todos los mensajes del usuario (consulta acotada por su lado, unica
 * forma de que las reglas la dejen pasar).
 */
function messagesOf(userId, role) {
  return getDocs(
    query(collection(firestore(), COLLECTIONS.MESSAGES), where(ownerField(role), '==', userId))
  )
}

/* ------------------------------------------------------------------ */
/*  Consultas                                                          */
/* ------------------------------------------------------------------ */

async function listThread({ appointmentId, userId, role }) {
  return run(async () => {
    const snap = await messagesOf(userId, role)
    return snapshotToArray(snap)
      .filter((m) => m.appointmentId === appointmentId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
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

    const snap = await messagesOf(userId, side)
    const pendientes = snap.docs.filter(
      (d) => d.data().appointmentId === appointmentId && d.data()[field] === false
    )
    if (!pendientes.length) return 0

    const batch = writeBatch(firestore())
    pendientes.forEach((d) => batch.update(d.ref, { [field]: true }))
    await batch.commit()
    return pendientes.length
  }, 'messages/read-failed')
}

export const firebaseMessages = { listThread, send, markRead, unreadCounts, listConversations }

export default firebaseMessages
