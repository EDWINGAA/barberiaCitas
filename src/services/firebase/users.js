/**
 * Coleccion "users" en Firestore.
 */

import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'

import { ROLES } from '@/constants'
import { COLLECTIONS, firestore } from '@/config/firebase'
import { normalizeText } from '@/utils/format'
import { fail, run, snapshotToArray, stripUndefined } from './helpers'

/** Los documentos de users usan el uid como id, no un campo "id" */
function withUid(rows) {
  return rows.map(({ id, ...rest }) => ({ uid: id, ...rest }))
}

async function list(filters = {}) {
  return run(async () => {
    const { role, active, search } = filters
    const conditions = []
    if (role) conditions.push(where('role', '==', role))
    if (active !== undefined) conditions.push(where('active', '==', Boolean(active)))

    const ref = collection(firestore(), COLLECTIONS.USERS)
    const snapshot = await getDocs(conditions.length ? query(ref, ...conditions) : ref)
    let rows = withUid(snapshotToArray(snapshot))

    // La busqueda por texto se hace en cliente: Firestore no ofrece
    // busqueda parcial sin un servicio externo tipo Algolia.
    if (search?.trim()) {
      const q = normalizeText(search)
      rows = rows.filter(
        (u) =>
          normalizeText(u.name || '').includes(q) ||
          normalizeText(u.email || '').includes(q) ||
          (u.phone || '').includes(q)
      )
    }

    return rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
  }, 'users/list-failed')
}

async function listBarbers({ activeOnly = true } = {}) {
  return list({ role: ROLES.BARBERO, ...(activeOnly ? { active: true } : {}) })
}

async function listClients({ search } = {}) {
  return list({ role: ROLES.CLIENTE, search })
}

async function get(uid) {
  return run(async () => {
    const snapshot = await getDoc(doc(firestore(), COLLECTIONS.USERS, uid))
    if (!snapshot.exists()) return null
    return { uid, ...snapshot.data() }
  }, 'users/get-failed')
}

/**
 * Lee varios usuarios por uid.
 * Firestore limita el operador "in" a 30 valores, asi que se trocea.
 */
async function getMany(uids = []) {
  if (!uids.length) return []
  return run(async () => {
    const unique = [...new Set(uids)]
    const chunks = []
    for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30))

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const snapshot = await getDocs(
          query(collection(firestore(), COLLECTIONS.USERS), where('__name__', 'in', chunk))
        )
        return withUid(snapshotToArray(snapshot))
      })
    )
    return results.flat()
  }, 'users/get-many-failed')
}

async function updateUser(uid, data) {
  return run(async () => {
    const allowed = ['name', 'phone', 'photoURL', 'bio', 'specialties', 'active', 'role']
    const changes = stripUndefined(
      Object.fromEntries(allowed.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]))
    )
    await updateDoc(doc(firestore(), COLLECTIONS.USERS, uid), changes)
    return get(uid)
  }, 'users/update-failed')
}

async function setActive(uid, active) {
  return run(async () => {
    const user = await get(uid)
    if (!user) fail('users/not-found', 'El usuario no existe.')
    if (user.role === ROLES.ADMIN && !active) {
      fail('users/cannot-disable-admin', 'No puedes desactivar una cuenta de administrador.')
    }
    await updateDoc(doc(firestore(), COLLECTIONS.USERS, uid), { active: Boolean(active) })
    return { ...user, active: Boolean(active) }
  }, 'users/set-active-failed')
}

export const firebaseUsers = {
  list,
  listBarbers,
  listClients,
  get,
  getMany,
  update: updateUser,
  setActive,
}

export default firebaseUsers
