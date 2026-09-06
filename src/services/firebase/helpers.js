/**
 * Utilidades compartidas por los servicios de Firebase.
 */

import { Timestamp } from 'firebase/firestore'

/**
 * Error de negocio con codigo, identico al del modo mock, para que las
 * vistas puedan reaccionar igual en los dos modos.
 */
export class ServiceError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
  }
}

export function fail(code, message) {
  throw new ServiceError(code, message)
}

/** Convierte un snapshot de documento en objeto plano con id */
export function docToObject(snapshot) {
  if (!snapshot.exists()) return null
  return normalizeDates({ id: snapshot.id, ...snapshot.data() })
}

/** Convierte un snapshot de consulta en array de objetos planos */
export function snapshotToArray(snapshot) {
  return snapshot.docs.map((d) => normalizeDates({ id: d.id, ...d.data() }))
}

/**
 * Firestore devuelve Timestamp donde el modo mock devuelve texto ISO.
 * Se normaliza a texto para que las vistas no tengan que distinguirlos.
 */
export function normalizeDates(obj) {
  const out = { ...obj }
  Object.entries(out).forEach(([key, value]) => {
    if (value instanceof Timestamp) out[key] = value.toDate().toISOString()
  })
  return out
}

/** Traduce los codigos de error de Firebase Auth a mensajes en espanol */
export function translateAuthError(error) {
  const map = {
    'auth/invalid-email': 'El correo no tiene un formato valido.',
    'auth/user-disabled': 'Esta cuenta esta desactivada. Contacta al administrador.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'La contrasena es incorrecta.',
    'auth/invalid-credential': 'Correo o contrasena incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contrasena debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos.',
    'auth/network-request-failed': 'Sin conexion con el servidor. Revisa tu internet.',
  }
  const code = error?.code || 'auth/unknown'
  return new ServiceError(code, map[code] || error?.message || 'No se pudo completar la operacion.')
}

/**
 * Ejecuta una operacion de Firestore traduciendo el error si falla.
 * Evita repetir try/catch en cada funcion.
 */
export async function run(operation, fallbackCode = 'firestore/error') {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof ServiceError) throw error
    if (String(error?.code || '').startsWith('auth/')) throw translateAuthError(error)
    if (error?.code === 'permission-denied') {
      throw new ServiceError(
        'firestore/permission-denied',
        'No tienes permisos para realizar esta accion.'
      )
    }
    throw new ServiceError(fallbackCode, error?.message || 'Error al comunicarse con el servidor.')
  }
}

/** Elimina claves con valor undefined: Firestore las rechaza */
export function stripUndefined(obj) {
  const out = {}
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value
  })
  return out
}
