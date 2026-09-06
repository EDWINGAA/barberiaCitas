/**
 * Colecciones "services" y "business", mas el almacenamiento de archivos,
 * en MODO DEMO.
 */

import { GALLERY_LOCATION_LABELS, GALLERY_LOCATION_MAX } from '@/constants'
import { comprimirParaDocumento } from '@/utils/image'
import {
  createServiceModel,
  createBusinessModel,
  createGalleryItemModel,
  nowISO,
} from '@/models'
import { clone, delay, fail, findById, getDB, insert, readCollection, saveDB, update } from './store'

/* ================================================================== */
/*  services                                                           */
/* ================================================================== */

/** Lista de servicios; por defecto solo los activos */
async function listServices({ activeOnly = false } = {}) {
  await delay()
  let rows = readCollection('services')
  if (activeOnly) rows = rows.filter((s) => s.active)
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

async function getService(id) {
  await delay(90)
  const row = findById('services', id)
  return row ? clone(row) : null
}

async function createService(data) {
  await delay()
  const db = getDB()
  const name = String(data.name || '').trim()
  if (db.services.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    fail('services/duplicate', 'Ya existe un servicio con ese nombre.')
  }
  return insert('services', createServiceModel(data))
}

async function updateService(id, data) {
  await delay()
  const db = getDB()
  const name = String(data.name || '').trim()
  if (name && db.services.some((s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) {
    fail('services/duplicate', 'Ya existe un servicio con ese nombre.')
  }
  const changes = {}
  ;['name', 'description', 'duration', 'price', 'active'].forEach((key) => {
    if (data[key] !== undefined) changes[key] = data[key]
  })
  if (changes.duration !== undefined) changes.duration = Number(changes.duration)
  if (changes.price !== undefined) changes.price = Number(changes.price)

  const result = update('services', id, changes)
  if (!result) fail('services/not-found', 'El servicio no existe.')
  return result
}

/** Desactiva (o reactiva) un servicio. No se borra para no romper el historial. */
async function setServiceActive(id, active) {
  await delay()
  const result = update('services', id, { active: Boolean(active) })
  if (!result) fail('services/not-found', 'El servicio no existe.')
  return result
}

/**
 * Borrado definitivo. Solo se permite si ninguna cita lo referencia;
 * en caso contrario se sugiere desactivarlo.
 */
async function removeService(id) {
  await delay()
  const db = getDB()
  const used = db.appointments.some((a) => a.serviceId === id)
  if (used) {
    fail(
      'services/in-use',
      'Este servicio tiene citas asociadas. Desactivalo en lugar de eliminarlo.'
    )
  }
  const index = db.services.findIndex((s) => s.id === id)
  if (index === -1) fail('services/not-found', 'El servicio no existe.')
  db.services.splice(index, 1)
  saveDB()
  return true
}

/* ================================================================== */
/*  gallery                                                            */
/* ================================================================== */

/**
 * Fotos de trabajos que alimentan los carruseles del sitio publico.
 * Cada foto pertenece a una sola galeria (inicio o servicios) y lleva
 * un "order" que decide su posicion dentro de ella.
 */
async function listGallery({ location, activeOnly = false } = {}) {
  await delay()
  let rows = readCollection('gallery')
  if (location) rows = rows.filter((g) => g.location === location)
  if (activeOnly) rows = rows.filter((g) => g.active)
  return rows.sort((a, b) => a.order - b.order || String(a.createdAt).localeCompare(b.createdAt))
}

async function getGalleryItem(id) {
  await delay(90)
  const row = findById('gallery', id)
  return row ? clone(row) : null
}

/**
 * Comprueba que una zona admite otra foto mas.
 * La portada solo tiene sitio para dos, asi que se rechaza el intento en
 * lugar de guardar imagenes que nunca llegarian a verse.
 */
function assertHayHueco(location, ignorarId = null) {
  const maximo = GALLERY_LOCATION_MAX[location] || 0
  if (maximo === 0) return

  const db = getDB()
  const ocupadas = (db.gallery || []).filter(
    (g) => g.location === location && g.id !== ignorarId
  ).length

  if (ocupadas >= maximo) {
    fail(
      'gallery/location-full',
      `${GALLERY_LOCATION_LABELS[location]} solo admite ${maximo} fotos. Cambia o elimina alguna de las que ya hay.`
    )
  }
}

/** Crea una foto y la coloca al final de su galeria */
async function createGalleryItem(data) {
  await delay()
  const db = getDB()
  if (!db.gallery) db.gallery = []

  assertHayHueco(data.location)

  const enLaMismaGaleria = db.gallery.filter((g) => g.location === data.location)
  const siguienteOrden = enLaMismaGaleria.length
    ? Math.max(...enLaMismaGaleria.map((g) => g.order)) + 1
    : 0

  return insert('gallery', createGalleryItemModel({ ...data, order: siguienteOrden }))
}

async function updateGalleryItem(id, data) {
  await delay()
  const actual = findById('gallery', id)
  if (!actual) fail('gallery/not-found', 'La foto no existe.')

  // Mover una foto a otra zona tambien tiene que respetar su limite
  if (data.location && data.location !== actual.location) {
    assertHayHueco(data.location, id)
  }

  const changes = {}
  ;['title', 'description', 'imageURL', 'location', 'active', 'order'].forEach((key) => {
    if (data[key] !== undefined) changes[key] = data[key]
  })
  changes.updatedAt = nowISO()

  const result = update('gallery', id, changes)
  if (!result) fail('gallery/not-found', 'La foto no existe.')
  return result
}

async function setGalleryItemActive(id, active) {
  await delay()
  const result = update('gallery', id, { active: Boolean(active), updatedAt: nowISO() })
  if (!result) fail('gallery/not-found', 'La foto no existe.')
  return result
}

async function removeGalleryItem(id) {
  await delay()
  const db = getDB()
  const index = (db.gallery || []).findIndex((g) => g.id === id)
  if (index === -1) fail('gallery/not-found', 'La foto no existe.')
  db.gallery.splice(index, 1)
  saveDB()
  return true
}

/**
 * Reordena una galeria completa.
 * @param {string[]} ids ids en el orden deseado, de izquierda a derecha
 */
async function reorderGallery(ids = []) {
  await delay(160)
  const db = getDB()
  ids.forEach((id, index) => {
    const item = (db.gallery || []).find((g) => g.id === id)
    if (item) {
      item.order = index
      item.updatedAt = nowISO()
    }
  })
  saveDB()
  return true
}

/* ================================================================== */
/*  business                                                           */
/* ================================================================== */

async function getBusiness() {
  await delay(90)
  return clone(getDB().business)
}

async function updateBusiness(data) {
  await delay()
  const db = getDB()
  db.business = createBusinessModel({ ...db.business, ...data, updatedAt: nowISO() })
  saveDB()
  return clone(db.business)
}

/* ================================================================== */
/*  storage                                                            */
/* ================================================================== */

/**
 * "Sube" un archivo. En modo demo devuelve una data URL comprimida que
 * se guarda igual que una URL de Firebase Storage.
 *
 * @param {string} path ruta destino (se ignora en demo, se mantiene por paridad)
 * @param {File}   file archivo seleccionado por el usuario
 */
async function uploadImage(path, file) {
  if (!file) fail('storage/no-file', 'No se selecciono ningun archivo.')
  if (!String(file.type || '').startsWith('image/')) {
    fail('storage/invalid-type', 'El archivo debe ser una imagen.')
  }
  if (file.size > 8 * 1024 * 1024) {
    fail('storage/too-large', 'La imagen no puede superar los 8 MB.')
  }
  await delay(500)
  return comprimirParaDocumento(file)
}

/**
 * En modo demo no hay ningun archivo fisico que borrar: la imagen vive
 * dentro del propio documento como data URL. Se mantiene el parametro
 * "path" para que la firma sea identica a la de Firebase Storage.
 */
// eslint-disable-next-line no-unused-vars
async function removeFile(path) {
  await delay(120)
  return true
}

export const mockCatalog = {
  services: {
    list: listServices,
    get: getService,
    create: createService,
    update: updateService,
    setActive: setServiceActive,
    remove: removeService,
  },
  gallery: {
    list: listGallery,
    get: getGalleryItem,
    create: createGalleryItem,
    update: updateGalleryItem,
    setActive: setGalleryItemActive,
    remove: removeGalleryItem,
    reorder: reorderGallery,
  },
  business: {
    get: getBusiness,
    update: updateBusiness,
  },
  storage: {
    uploadImage,
    remove: removeFile,
  },
}

export default mockCatalog
