/**
 * Proveedor de autenticacion con Firebase Authentication.
 *
 * Expone exactamente la misma API que el proveedor mock:
 *   signIn, signUp, signOut, onAuthChanged, getCurrentUser, createAccount
 *
 * El perfil (nombre, telefono, rol...) vive en el documento
 * users/{uid} de Firestore; Authentication solo guarda credenciales.
 */

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

import { ROLES } from '@/constants'
import { createUserModel } from '@/models'
import { COLLECTIONS, firebaseAuth, firestore, withSecondaryApp } from '@/config/firebase'
import { fail, run, translateAuthError } from './helpers'

/** Perfil en memoria del usuario actual, para lecturas sincronas */
let currentProfile = null

/** Lee el documento de perfil de un uid */
async function fetchProfile(uid) {
  const snapshot = await getDoc(doc(firestore(), COLLECTIONS.USERS, uid))
  if (!snapshot.exists()) return null
  return { uid, ...snapshot.data() }
}

/**
 * Observa el usuario autenticado y resuelve su perfil de Firestore.
 * Devuelve la funcion para cancelar la suscripcion.
 */
function onAuthChanged(callback) {
  let cancelled = false

  const unsubscribe = onAuthStateChanged(firebaseAuth(), async (fbUser) => {
    if (cancelled) return

    if (!fbUser) {
      currentProfile = null
      callback(null)
      return
    }

    try {
      const profile = await fetchProfile(fbUser.uid)
      if (cancelled) return

      // Cuenta sin perfil o desactivada: se cierra la sesion
      if (!profile || profile.active === false) {
        await fbSignOut(firebaseAuth())
        currentProfile = null
        callback(null)
        return
      }

      currentProfile = profile
      callback(profile)
    } catch {
      currentProfile = null
      callback(null)
    }
  })

  return () => {
    cancelled = true
    unsubscribe()
  }
}

function getCurrentUser() {
  return currentProfile
}

/** Inicia sesion con correo y contrasena */
async function signIn(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(
      firebaseAuth(),
      String(email).trim().toLowerCase(),
      password
    )
    const profile = await fetchProfile(credential.user.uid)

    if (!profile) {
      await fbSignOut(firebaseAuth())
      fail('auth/no-profile', 'Tu cuenta no tiene un perfil asociado. Contacta al administrador.')
    }
    if (profile.active === false) {
      await fbSignOut(firebaseAuth())
      fail('auth/user-disabled', 'Esta cuenta esta desactivada. Contacta al administrador.')
    }

    currentProfile = profile
    return profile
  } catch (error) {
    if (error?.name === 'ServiceError') throw error
    throw translateAuthError(error)
  }
}

/**
 * Registro publico. Crea SIEMPRE la cuenta con rol "cliente":
 * las cuentas de barbero solo las da de alta el administrador.
 */
async function signUp({ name, email, password, phone }) {
  try {
    const clean = String(email).trim().toLowerCase()
    const credential = await createUserWithEmailAndPassword(firebaseAuth(), clean, password)
    const { uid } = credential.user

    // Nombre visible en Authentication, util en la consola de Firebase
    await fbUpdateProfile(credential.user, { displayName: name })

    const profile = createUserModel({
      uid,
      name,
      email: clean,
      phone,
      role: ROLES.CLIENTE,
    })

    // El documento se guarda sin el campo uid duplicado dentro
    const { uid: _uid, ...data } = profile
    await setDoc(doc(firestore(), COLLECTIONS.USERS, uid), data)

    currentProfile = profile
    return profile
  } catch (error) {
    if (error?.name === 'ServiceError') throw error
    throw translateAuthError(error)
  }
}

async function signOut() {
  await run(() => fbSignOut(firebaseAuth()), 'auth/signout-failed')
  currentProfile = null
}

/**
 * Alta de cuenta desde el panel de administrador.
 *
 * Usa una app secundaria para que el administrador NO pierda su sesion:
 * createUserWithEmailAndPassword firma automaticamente al usuario recien
 * creado, asi que ese efecto se aisla en una app desechable.
 */
async function createAccount({
  name,
  email,
  password,
  phone,
  role = ROLES.BARBERO,
  bio = '',
  specialties = [],
  photoURL = '',
}) {
  try {
    const clean = String(email).trim().toLowerCase()

    const uid = await withSecondaryApp(async (app) => {
      const credential = await createUserWithEmailAndPassword(getAuth(app), clean, password)
      await fbUpdateProfile(credential.user, { displayName: name })
      return credential.user.uid
    })

    const profile = createUserModel({
      uid,
      name,
      email: clean,
      phone,
      role,
      bio,
      specialties,
      photoURL,
    })

    const { uid: _uid, ...data } = profile
    // Se escribe con la sesion del administrador, que si tiene permisos
    await setDoc(doc(firestore(), COLLECTIONS.USERS, uid), data)
    return profile
  } catch (error) {
    if (error?.name === 'ServiceError') throw error
    throw translateAuthError(error)
  }
}

/** Refresca el perfil en cache tras editarlo */
async function refresh() {
  const fbUser = firebaseAuth().currentUser
  if (!fbUser) return null
  currentProfile = await fetchProfile(fbUser.uid)
  return currentProfile
}

export const firebaseAuthProvider = {
  signIn,
  signUp,
  signOut,
  onAuthChanged,
  getCurrentUser,
  createAccount,
  refresh,
}

export default firebaseAuthProvider
