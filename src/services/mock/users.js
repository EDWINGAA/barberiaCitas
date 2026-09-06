/**
 * Coleccion "users" en MODO DEMO.
 */

import { ROLES } from '@/constants'
import { normalizeText as normalize } from '@/utils/format'
import { clone, delay, fail, findById, getDB, readCollection, update } from './store'

/**
 * Lista usuarios con filtros opcionales.
 * @param {{role?:string, active?:boolean, search?:string}} filters
 */
async function list(filters = {}) {
  await delay()
  const { role, active, search } = filters
  let rows = readCollection('users')

  if (role) rows = rows.filter((u) => u.role === role)
  if (active !== undefined) rows = rows.filter((u) => Boolean(u.active) === Boolean(active))
  if (search?.trim()) {
    const q = normalize(search)
    rows = rows.filter(
      (u) => normalize(u.name).includes(q) || normalize(u.email).includes(q) || (u.phone || '').includes(q)
    )
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Barberos, por defecto solo los activos */
async function listBarbers({ activeOnly = true } = {}) {
  return list({ role: ROLES.BARBERO, ...(activeOnly ? { active: true } : {}) })
}

/** Todos los clientes */
async function listClients({ search } = {}) {
  return list({ role: ROLES.CLIENTE, search })
}

/** Un usuario por uid */
async function get(uid) {
  await delay(90)
  const user = findById('users', uid, 'uid')
  return user ? clone(user) : null
}

/**
 * Version sincrona sin retardo, util para resolver nombres dentro de
 * listas ya cargadas sin disparar una peticion por fila.
 */
async function getMany(uids = []) {
  await delay(90)
  const set = new Set(uids)
  return readCollection('users').filter((u) => set.has(u.uid))
}

/** Actualiza el perfil de un usuario */
async function updateUser(uid, data) {
  await delay()
  const allowed = ['name', 'phone', 'photoURL', 'bio', 'specialties', 'active', 'role']
  const changes = {}
  allowed.forEach((key) => {
    if (data[key] !== undefined) changes[key] = data[key]
  })

  const result = update('users', uid, changes, 'uid')
  if (!result) fail('users/not-found', 'El usuario no existe.')
  return result
}

/** Activa o desactiva una cuenta (borrado logico) */
async function setActive(uid, active) {
  await delay()
  const db = getDB()
  const user = db.users.find((u) => u.uid === uid)
  if (!user) fail('users/not-found', 'El usuario no existe.')
  if (user.role === ROLES.ADMIN && !active) {
    fail('users/cannot-disable-admin', 'No puedes desactivar una cuenta de administrador.')
  }
  return update('users', uid, { active: Boolean(active) }, 'uid')
}

export const mockUsers = {
  list,
  listBarbers,
  listClients,
  get,
  getMany,
  update: updateUser,
  setActive,
}

export default mockUsers
