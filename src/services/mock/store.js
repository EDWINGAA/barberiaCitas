/**
 * Almacen del MODO DEMO.
 *
 * Mantiene toda la "base de datos" en memoria y la persiste en
 * localStorage, de forma que los cambios sobreviven a un refresco del
 * navegador. Si no hay nada guardado, siembra los datos de demostracion.
 */

import { buildSeedData } from '@/data/seed'

// La version del nombre se sube cada vez que cambia la forma de los
// datos semilla. Asi, quien ya tenia la demo guardada en el navegador
// recibe automaticamente los datos nuevos en lugar de quedarse con los
// viejos (v2 anadio la coleccion "gallery" y el nombre del negocio).
const STORAGE_KEY = 'barberia_demo_db_v2'
const SESSION_KEY = 'barberia_demo_session_v2'

/** Copia profunda: evita que las vistas muten el almacen por accidente */
export function clone(value) {
  if (value === null || value === undefined) return value
  return JSON.parse(JSON.stringify(value))
}

/** Retraso artificial para que la interfaz muestre sus estados de carga */
export function delay(ms) {
  const wait = ms ?? 140 + Math.floor(Math.random() * 220)
  return new Promise((resolve) => setTimeout(resolve, wait))
}

/* ------------------------------------------------------------------ */
/*  Carga y persistencia                                               */
/* ------------------------------------------------------------------ */

let db = null

function readStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // Modo incognito o almacenamiento bloqueado: seguimos solo en memoria
    return null
  }
}

function writeStorage(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Sin persistencia: la sesion actual sigue funcionando en memoria
  }
}

/**
 * Comprueba que lo guardado en el navegador sigue sirviendo.
 *
 * No basta con que existan usuarios: si la semilla ha cambiado de forma
 * desde que se guardo (una coleccion nueva, una categoria nueva), esos
 * datos viejos dejan huecos raros, como una galeria que el panel ve
 * vacia mientras la web sigue mostrando fotos.
 */
export function isStoredDataUsable(stored, fresh) {
  if (!stored || !stored.users?.length) return false

  // 1. Sello de version: la comprobacion principal
  if (stored.__seedVersion !== fresh.__seedVersion) return false

  // 2. Red de seguridad por si algun dia se olvida subir la version:
  //    toda coleccion que exista en la semilla debe existir tambien
  //    en lo guardado.
  return Object.keys(fresh).every((key) => stored[key] !== undefined)
}

/** Devuelve la base de datos, sembrandola la primera vez */
export function getDB() {
  if (db) return db

  const stored = readStorage()
  const fresh = buildSeedData()

  if (isStoredDataUsable(stored, fresh)) {
    db = stored
  } else {
    // Datos ausentes o caducados: se vuelve a sembrar desde cero
    db = fresh
    writeStorage(db)
  }

  return db
}

/** Guarda el estado actual en localStorage */
export function saveDB() {
  if (db) writeStorage(db)
}

/** Borra los datos y vuelve a sembrar la demo desde cero */
export function resetDB() {
  db = buildSeedData()
  writeStorage(db)
  clearSession()
  return db
}

/* ------------------------------------------------------------------ */
/*  Sesion del usuario en modo demo                                    */
/* ------------------------------------------------------------------ */

/** uid del usuario con sesion iniciada, o null */
export function readSession() {
  try {
    return window.localStorage.getItem(SESSION_KEY) || null
  } catch {
    return null
  }
}

export function writeSession(uid) {
  try {
    window.localStorage.setItem(SESSION_KEY, uid)
  } catch {
    /* sin persistencia de sesion */
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    /* nada que limpiar */
  }
}

/* ------------------------------------------------------------------ */
/*  Ayudantes de coleccion                                             */
/* ------------------------------------------------------------------ */

/** Lee una coleccion completa (copia) */
export function readCollection(name) {
  return clone(getDB()[name] || [])
}

/** Reemplaza una coleccion completa y persiste */
export function writeCollection(name, rows) {
  const data = getDB()
  data[name] = rows
  saveDB()
}

/** Busca un documento por id dentro de una coleccion */
export function findById(name, id, key = 'id') {
  const data = getDB()
  return (data[name] || []).find((row) => row[key] === id) || null
}

/** Inserta un documento y devuelve su copia */
export function insert(name, doc) {
  const data = getDB()
  if (!data[name]) data[name] = []
  data[name].push(doc)
  saveDB()
  return clone(doc)
}

/** Aplica cambios parciales a un documento y devuelve la version resultante */
export function update(name, id, changes, key = 'id') {
  const data = getDB()
  const list = data[name] || []
  const index = list.findIndex((row) => row[key] === id)
  if (index === -1) return null
  list[index] = { ...list[index], ...changes }
  saveDB()
  return clone(list[index])
}

/** Elimina un documento; devuelve true si existia */
export function remove(name, id, key = 'id') {
  const data = getDB()
  const list = data[name] || []
  const index = list.findIndex((row) => row[key] === id)
  if (index === -1) return false
  list.splice(index, 1)
  saveDB()
  return true
}

/* ------------------------------------------------------------------ */
/*  Errores de negocio                                                 */
/* ------------------------------------------------------------------ */

/**
 * Error con codigo, para que las vistas puedan distinguir el motivo
 * exacto del fallo. Las implementaciones mock y Firebase lanzan los
 * mismos codigos.
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
