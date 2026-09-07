/**
 * Inicializacion de Firebase.
 *
 * La inicializacion es PEREZOSA a proposito: nada se ejecuta al importar
 * este archivo. Asi, en MODO DEMO la app arranca sin credenciales y sin
 * lanzar un solo error, aunque el bundle incluya el SDK.
 */

import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const APP_NAME = 'barberia-app'
/** App secundaria: el administrador crea cuentas sin perder su sesion */
const SECONDARY_APP_NAME = 'barberia-admin-worker'

/** Lee la configuracion desde las variables de entorno de Vite */
export function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  }
}

/** true si hay credenciales suficientes en el .env */
export function isFirebaseConfigured() {
  const cfg = getFirebaseConfig()
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId)
}

let cachedApp = null

/** Devuelve (creando si hace falta) la app principal de Firebase */
export function getFirebaseApp() {
  if (cachedApp) return cachedApp

  if (!isFirebaseConfigured()) {
    throw new Error(
      'Faltan las variables VITE_FIREBASE_* en tu archivo .env. ' +
        'Copia .env.example, rellena las credenciales del proyecto y reinicia el servidor.'
    )
  }

  const existing = getApps().find((a) => a.name === APP_NAME)
  cachedApp = existing || initializeApp(getFirebaseConfig(), APP_NAME)
  return cachedApp
}

export function firebaseAuth() {
  return getAuth(getFirebaseApp())
}

export function firestore() {
  return getFirestore(getFirebaseApp())
}

export function firebaseStorage() {
  return getStorage(getFirebaseApp())
}

/**
 * Crea una app secundaria temporal.
 *
 * createUserWithEmailAndPassword inicia sesion automaticamente con la
 * cuenta recien creada. Si lo hicieramos en la app principal, el
 * administrador quedaria firmado como el barbero que acaba de dar de
 * alta. Con una app aparte, esa sesion se crea y se destruye aislada.
 */
export async function withSecondaryApp(callback) {
  const name = `${SECONDARY_APP_NAME}-${Date.now()}`
  const app = initializeApp(getFirebaseConfig(), name)
  try {
    return await callback(app)
  } finally {
    try {
      await getAuth(app).signOut()
    } catch {
      /* la sesion secundaria puede no existir */
    }
    await deleteApp(getApp(name))
  }
}

/** Nombres de las colecciones de Firestore, en un solo sitio */
export const COLLECTIONS = {
  USERS: 'users',
  SERVICES: 'services',
  BARBER_SERVICES: 'barberServices',
  APPOINTMENTS: 'appointments',
  // Espejo publico de las horas ocupadas, sin datos personales
  BUSY: 'busy',
  // Chat privado entre el cliente y el barbero de cada cita
  MESSAGES: 'messages',
  BLOCKS: 'blocks',
  COURSES: 'courses',
  ENROLLMENTS: 'enrollments',
  GALLERY: 'gallery',
  BUSINESS: 'business',
}

/** Documento unico donde vive la configuracion del negocio */
export const BUSINESS_DOC_ID = 'config'
