/**
 * Colecciones "services" y "business", mas Firebase Storage.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'

import { GALLERY_LOCATION_LABELS, GALLERY_LOCATION_MAX } from '@/constants'
import { comprimirParaDocumento } from '@/utils/image'
import { BUSINESS_DOC_ID, COLLECTIONS, firebaseStorage, firestore } from '@/config/firebase'
import {
  createBusinessModel,
  createGalleryItemModel,
  createServiceModel,
  nowISO,
} from '@/models'
import { docToObject, fail, run, snapshotToArray, stripUndefined } from './helpers'

/* ================================================================== */
/*  services                                                           */
/* ================================================================== */

async function listServices({ activeOnly = false } = {}) {
  return run(async () => {
    const ref_ = collection(firestore(), COLLECTIONS.SERVICES)
    const snapshot = await getDocs(activeOnly ? query(ref_, where('active', '==', true)) : ref_)
    return snapshotToArray(snapshot).sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
  }, 'services/list-failed')
}

async function getService(id) {
  return run(
    async () => docToObject(await getDoc(doc(firestore(), COLLECTIONS.SERVICES, id))),
    'services/get-failed'
  )
}

async function createService(data) {
  return run(async () => {
    const model = createServiceModel(data)
    const { id: _id, ...payload } = model
    const created = await addDoc(collection(firestore(), COLLECTIONS.SERVICES), payload)
    return { ...model, id: created.id }
  }, 'services/create-failed')
}

async function updateService(id, data) {
  return run(async () => {
    const changes = stripUndefined({
      name: data.name,
      description: data.description,
      duration: data.duration !== undefined ? Number(data.duration) : undefined,
      price: data.price !== undefined ? Number(data.price) : undefined,
      active: data.active,
    })
    await updateDoc(doc(firestore(), COLLECTIONS.SERVICES, id), changes)
    return getService(id)
  }, 'services/update-failed')
}

async function setServiceActive(id, active) {
  return run(async () => {
    await updateDoc(doc(firestore(), COLLECTIONS.SERVICES, id), { active: Boolean(active) })
    return getService(id)
  }, 'services/set-active-failed')
}

async function removeService(id) {
  return run(async () => {
    // No se borra un servicio con historial de citas
    const used = await getDocs(
      query(
        collection(firestore(), COLLECTIONS.APPOINTMENTS),
        where('serviceId', '==', id),
        limit(1)
      )
    )
    if (!used.empty) {
      fail('services/in-use', 'Este servicio tiene citas asociadas. Desactivalo en lugar de eliminarlo.')
    }
    await deleteDoc(doc(firestore(), COLLECTIONS.SERVICES, id))
    return true
  }, 'services/remove-failed')
}

/* ================================================================== */
/*  gallery                                                            */
/* ================================================================== */

/**
 * Fotos de trabajos de los carruseles publicos.
 * Se filtra por "location" en el servidor y se ordena en cliente por
 * el campo "order", que evita necesitar un indice compuesto.
 */
async function listGallery({ location, activeOnly = false } = {}) {
  return run(async () => {
    const ref_ = collection(firestore(), COLLECTIONS.GALLERY)
    const snapshot = await getDocs(
      location ? query(ref_, where('location', '==', location)) : ref_
    )
    let rows = snapshotToArray(snapshot)
    if (activeOnly) rows = rows.filter((g) => g.active)
    return rows.sort(
      (a, b) => (a.order || 0) - (b.order || 0) || String(a.createdAt).localeCompare(String(b.createdAt))
    )
  }, 'gallery/list-failed')
}

async function getGalleryItem(id) {
  return run(
    async () => docToObject(await getDoc(doc(firestore(), COLLECTIONS.GALLERY, id))),
    'gallery/get-failed'
  )
}

/**
 * Comprueba que una zona admite otra foto mas.
 * La portada solo tiene sitio para dos, asi que se rechaza el intento en
 * lugar de guardar imagenes que nunca llegarian a verse.
 */
async function assertHayHueco(location, ignorarId = null) {
  const maximo = GALLERY_LOCATION_MAX[location] || 0
  if (maximo === 0) return

  const existentes = await listGallery({ location })
  const ocupadas = existentes.filter((g) => g.id !== ignorarId).length

  if (ocupadas >= maximo) {
    fail(
      'gallery/location-full',
      `${GALLERY_LOCATION_LABELS[location]} solo admite ${maximo} fotos. Cambia o elimina alguna de las que ya hay.`
    )
  }
}

/** Crea una foto y la coloca al final de su galeria */
async function createGalleryItem(data) {
  return run(async () => {
    await assertHayHueco(data.location)

    const enLaMismaGaleria = await listGallery({ location: data.location })
    const siguienteOrden = enLaMismaGaleria.length
      ? Math.max(...enLaMismaGaleria.map((g) => g.order || 0)) + 1
      : 0

    const model = createGalleryItemModel({ ...data, order: siguienteOrden })
    const { id: _id, ...payload } = model
    const created = await addDoc(collection(firestore(), COLLECTIONS.GALLERY), payload)
    return { ...model, id: created.id }
  }, 'gallery/create-failed')
}

async function updateGalleryItem(id, data) {
  return run(async () => {
    const actual = await getGalleryItem(id)
    if (!actual) fail('gallery/not-found', 'La foto no existe.')

    // Mover una foto a otra zona tambien tiene que respetar su limite
    if (data.location && data.location !== actual.location) {
      await assertHayHueco(data.location, id)
    }

    const changes = stripUndefined({
      title: data.title,
      description: data.description,
      imageURL: data.imageURL,
      location: data.location,
      active: data.active,
      order: data.order,
      updatedAt: nowISO(),
    })
    await updateDoc(doc(firestore(), COLLECTIONS.GALLERY, id), changes)
    return getGalleryItem(id)
  }, 'gallery/update-failed')
}

async function setGalleryItemActive(id, active) {
  return run(async () => {
    await updateDoc(doc(firestore(), COLLECTIONS.GALLERY, id), {
      active: Boolean(active),
      updatedAt: nowISO(),
    })
    return getGalleryItem(id)
  }, 'gallery/set-active-failed')
}

async function removeGalleryItem(id) {
  return run(async () => {
    await deleteDoc(doc(firestore(), COLLECTIONS.GALLERY, id))
    return true
  }, 'gallery/remove-failed')
}

/**
 * Reordena una galeria completa en un solo lote atomico.
 * @param {string[]} ids ids en el orden deseado, de izquierda a derecha
 */
async function reorderGallery(ids = []) {
  return run(async () => {
    if (!ids.length) return true
    const batch = writeBatch(firestore())
    ids.forEach((id, index) => {
      batch.update(doc(firestore(), COLLECTIONS.GALLERY, id), {
        order: index,
        updatedAt: nowISO(),
      })
    })
    await batch.commit()
    return true
  }, 'gallery/reorder-failed')
}

/* ================================================================== */
/*  business                                                           */
/* ================================================================== */

async function getBusiness() {
  return run(async () => {
    const snapshot = await getDoc(doc(firestore(), COLLECTIONS.BUSINESS, BUSINESS_DOC_ID))
    if (!snapshot.exists()) {
      // Primer arranque contra un proyecto vacio: se crea la configuracion
      const initial = createBusinessModel({})
      await setDoc(doc(firestore(), COLLECTIONS.BUSINESS, BUSINESS_DOC_ID), initial)
      return initial
    }
    return snapshot.data()
  }, 'business/get-failed')
}

async function updateBusiness(data) {
  return run(async () => {
    const current = await getBusiness()
    const merged = createBusinessModel({ ...current, ...data, updatedAt: nowISO() })
    await setDoc(doc(firestore(), COLLECTIONS.BUSINESS, BUSINESS_DOC_ID), merged)
    return merged
  }, 'business/update-failed')
}

/* ================================================================== */
/*  storage                                                            */
/* ================================================================== */

/**
 * Sube una imagen a Firebase Storage y devuelve su URL publica.
 * @param {string} path ruta destino, p.ej. "courses/crs_123/cover.jpg"
 * @param {File}   file archivo seleccionado
 */
async function uploadImage(path, file) {
  if (!file) fail('storage/no-file', 'No se selecciono ningun archivo.')
  if (!String(file.type || '').startsWith('image/')) {
    fail('storage/invalid-type', 'El archivo debe ser una imagen.')
  }
  if (file.size > 8 * 1024 * 1024) {
    fail('storage/too-large', 'La imagen no puede superar los 8 MB.')
  }

  /*
   * Se intenta Cloud Storage y, si no esta disponible, se guarda la
   * imagen comprimida dentro del propio documento.
   *
   * El motivo es practico: Cloud Storage exige el plan de pago (Blaze)
   * con tarjeta, y una barberia con unas decenas de fotos no lo
   * necesita. Comprimida a 900 px una foto ronda los 150 KB, muy por
   * debajo del limite de 1 MB por documento de Firestore.
   *
   * La ventaja de intentarlo primero es que el dia que se active Blaze
   * esto empieza a usar Storage solo, sin tocar una linea.
   */
  try {
    const storageRef = ref(firebaseStorage(), path)
    await uploadBytes(storageRef, file, { contentType: file.type })
    return await getDownloadURL(storageRef)
  } catch (error) {
    console.warn(
      '[storage] Cloud Storage no disponible, se guarda la imagen comprimida en Firestore.',
      error?.code || error?.message || error
    )
    return run(() => comprimirParaDocumento(file), 'storage/upload-failed')
  }
}

async function removeFile(path) {
  return run(async () => {
    try {
      await deleteObject(ref(firebaseStorage(), path))
    } catch (error) {
      // Si el archivo ya no existe, no es un fallo real
      if (error?.code !== 'storage/object-not-found') throw error
    }
    return true
  }, 'storage/remove-failed')
}

export const firebaseCatalog = {
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

export default firebaseCatalog
