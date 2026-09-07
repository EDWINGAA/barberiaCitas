/**
 * Coleccion "messages" en MODO DEMO.
 *
 * Chat privado entre el cliente y el barbero de una cita. El hilo vive
 * pegado a la cita: solo sus dos participantes pueden leerlo o escribir,
 * y solo mientras la cita esta confirmada.
 *
 * La conversacion MUERE CON LA CITA: al completarla, cancelarla o marcar
 * que no asistio se borra entera, igual que en el modo Firebase.
 */

import { CHAT_WRITABLE_STATUS, MESSAGE_MAX_LENGTH, ROLES } from '@/constants'
import { createMessageModel } from '@/models'
import { delay, fail, getDB, insert, readCollection, saveDB } from './store'

/** Rol de un usuario dentro de una cita concreta, o null si no participa */
function participantRole(appointment, userId) {
  if (!appointment || !userId) return null
  if (appointment.clientId === userId) return ROLES.CLIENTE
  if (appointment.barberId === userId) return ROLES.BARBERO
  return null
}

/** Campo de "leido" que le corresponde a un rol */
function readField(role) {
  return role === ROLES.BARBERO ? 'readByBarber' : 'readByClient'
}

/** Mensajes de una cita, del mas antiguo al mas reciente */
async function listThread({ appointmentId, userId }) {
  await delay(120)
  const db = getDB()
  const appointment = db.appointments.find((a) => a.id === appointmentId)
  if (!appointment) fail('messages/appointment-not-found', 'La cita no existe.')
  if (userId && !participantRole(appointment, userId)) {
    fail('messages/forbidden', 'No puedes ver esta conversacion.')
  }

  return readCollection('messages')
    .filter((m) => m.appointmentId === appointmentId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

/** Envia un mensaje en el hilo de una cita */
async function send({ appointmentId, senderId, text }) {
  await delay()
  const db = getDB()
  const appointment = db.appointments.find((a) => a.id === appointmentId)
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

  return insert(
    'messages',
    createMessageModel({
      appointmentId,
      clientId: appointment.clientId,
      barberId: appointment.barberId,
      senderId,
      senderRole: role,
      text: limpio.slice(0, MESSAGE_MAX_LENGTH),
    })
  )
}

/**
 * Marca como leidos todos los mensajes de una cita que le llegaron al
 * usuario indicado. Devuelve cuantos ha tocado.
 */
async function markRead({ appointmentId, userId }) {
  await delay(80)
  const db = getDB()
  const appointment = db.appointments.find((a) => a.id === appointmentId)
  const role = participantRole(appointment, userId)
  if (!role) return 0

  const field = readField(role)
  let touched = 0
  ;(db.messages || []).forEach((m) => {
    if (m.appointmentId === appointmentId && !m[field]) {
      m[field] = true
      touched += 1
    }
  })
  if (touched) saveDB()
  return touched
}

/**
 * Mensajes sin leer del usuario, agrupados por cita: { [appointmentId]: n }.
 * Cada mensaje lleva copiados clientId y barberId, asi que basta con
 * mirar el lado del usuario. Lo usan el boton "Mensajes" y la campana.
 */
async function unreadCounts({ userId, role }) {
  await delay(80)
  const db = getDB()

  const side = role === ROLES.BARBERO ? ROLES.BARBERO : ROLES.CLIENTE
  const ownerField = side === ROLES.BARBERO ? 'barberId' : 'clientId'
  const field = readField(side)

  const counts = {}
  ;(db.messages || []).forEach((m) => {
    if (m[ownerField] === userId && !m[field]) {
      counts[m.appointmentId] = (counts[m.appointmentId] || 0) + 1
    }
  })
  return counts
}

/**
 * Resumen de cada conversacion del usuario (una por cita con mensajes):
 * ultimo mensaje, hora, quien lo envio y cuantos quedan sin leer.
 * Ordenadas de la mas reciente a la mas antigua.
 */
async function listConversations({ userId, role }) {
  await delay(120)
  const db = getDB()

  const side = role === ROLES.BARBERO ? ROLES.BARBERO : ROLES.CLIENTE
  const ownerField = side === ROLES.BARBERO ? 'barberId' : 'clientId'
  const field = readField(side)

  const byAppt = new Map()
  ;(db.messages || []).forEach((m) => {
    if (m[ownerField] !== userId) return
    const cur =
      byAppt.get(m.appointmentId) ||
      { appointmentId: m.appointmentId, lastText: '', lastAt: '', lastSenderId: '', unread: 0, total: 0 }
    cur.total += 1
    if (!m[field]) cur.unread += 1
    if (String(m.createdAt) >= String(cur.lastAt)) {
      cur.lastText = m.text
      cur.lastAt = m.createdAt
      cur.lastSenderId = m.senderId
    }
    byAppt.set(m.appointmentId, cur)
  })

  return [...byAppt.values()].sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))
}

/**
 * Borra la conversacion entera de una cita.
 *
 * La llama sola la capa de citas cuando la cita termina. Devuelve
 * cuantos mensajes se borraron.
 */
async function purgeThread({ appointmentId }) {
  await delay(80)
  if (!appointmentId) return 0

  const db = getDB()
  const antes = (db.messages || []).length
  db.messages = (db.messages || []).filter((m) => m.appointmentId !== appointmentId)
  const borrados = antes - db.messages.length

  if (borrados) saveDB(db)
  return borrados
}

export const mockMessages = {
  listThread,
  send,
  markRead,
  unreadCounts,
  listConversations,
  purgeThread,
}

export default mockMessages
