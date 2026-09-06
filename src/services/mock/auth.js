/**
 * Proveedor de autenticacion del MODO DEMO.
 *
 * Expone exactamente la misma API que el proveedor de Firebase:
 *   signIn, signUp, signOut, onAuthChanged, getCurrentUser, createAccount
 *
 * Las contrasenas viven en el mapa "passwords" del almacen. Obviamente
 * esto solo sirve para la demo: en produccion las gestiona Firebase Auth.
 */

import { ROLES } from '@/constants'
import { createUserModel } from '@/models'
import {
  clone,
  clearSession,
  delay,
  fail,
  getDB,
  insert,
  readSession,
  saveDB,
  writeSession,
} from './store'

/* ------------------------------------------------------------------ */
/*  Observadores                                                       */
/* ------------------------------------------------------------------ */

const listeners = new Set()

function currentProfile() {
  const uid = readSession()
  if (!uid) return null
  const user = getDB().users.find((u) => u.uid === uid)
  if (!user) return null
  // Una cuenta desactivada no puede mantener la sesion abierta
  if (!user.active) return null
  return clone(user)
}

function notify() {
  const profile = currentProfile()
  listeners.forEach((cb) => cb(profile))
}

/* ------------------------------------------------------------------ */
/*  API publica                                                        */
/* ------------------------------------------------------------------ */

/**
 * Suscribe un observador al usuario actual.
 * Se invoca de inmediato con el estado presente y devuelve la funcion
 * para cancelar la suscripcion.
 */
function onAuthChanged(callback) {
  listeners.add(callback)
  // Emision inicial asincrona, para imitar el comportamiento de Firebase
  const timer = setTimeout(() => callback(currentProfile()), 60)
  return () => {
    clearTimeout(timer)
    listeners.delete(callback)
  }
}

/** Perfil del usuario con sesion iniciada (o null) */
function getCurrentUser() {
  return currentProfile()
}

/** Inicia sesion con correo y contrasena */
async function signIn(email, password) {
  await delay()
  const db = getDB()
  const clean = String(email || '').trim().toLowerCase()

  const user = db.users.find((u) => u.email === clean)
  if (!user) fail('auth/user-not-found', 'No existe una cuenta con ese correo.')
  if (db.passwords[clean] !== password) fail('auth/wrong-password', 'La contrasena es incorrecta.')
  if (!user.active) fail('auth/user-disabled', 'Esta cuenta esta desactivada. Contacta al administrador.')

  writeSession(user.uid)
  notify()
  return clone(user)
}

/**
 * Registro publico. SIEMPRE crea la cuenta con rol "cliente":
 * las cuentas de barbero solo las da de alta el administrador.
 */
async function signUp({ name, email, password, phone }) {
  await delay()
  const db = getDB()
  const clean = String(email || '').trim().toLowerCase()

  if (db.users.some((u) => u.email === clean)) {
    fail('auth/email-already-in-use', 'Ya existe una cuenta con ese correo.')
  }
  if (String(password || '').length < 6) {
    fail('auth/weak-password', 'La contrasena debe tener al menos 6 caracteres.')
  }

  const user = createUserModel({
    name,
    email: clean,
    phone,
    role: ROLES.CLIENTE, // no negociable en el registro publico
  })

  insert('users', user)
  db.passwords[clean] = password
  saveDB()

  writeSession(user.uid)
  notify()
  return clone(user)
}

/** Cierra la sesion actual */
async function signOut() {
  await delay(120)
  clearSession()
  notify()
}

/**
 * Alta de cuenta desde el panel de administrador (barberos u otros admins).
 * Importante: NO cambia la sesion del administrador que la ejecuta.
 */
async function createAccount({ name, email, password, phone, role = ROLES.BARBERO, bio, specialties, photoURL }) {
  await delay()
  const db = getDB()
  const clean = String(email || '').trim().toLowerCase()

  if (db.users.some((u) => u.email === clean)) {
    fail('auth/email-already-in-use', 'Ya existe una cuenta con ese correo.')
  }
  if (String(password || '').length < 6) {
    fail('auth/weak-password', 'La contrasena debe tener al menos 6 caracteres.')
  }

  const user = createUserModel({ name, email: clean, phone, role, bio, specialties, photoURL })
  insert('users', user)
  db.passwords[clean] = password
  saveDB()
  return clone(user)
}

/**
 * Refresca el perfil en memoria de los observadores.
 * Se llama tras editar el perfil para que el header y el avatar cambien
 * sin necesidad de recargar la pagina.
 */
function refresh() {
  notify()
}

export const mockAuth = {
  signIn,
  signUp,
  signOut,
  onAuthChanged,
  getCurrentUser,
  createAccount,
  refresh,
}

export default mockAuth
