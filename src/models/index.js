/**
 * Modelos de datos.
 *
 * JavaScript puro no tiene tipos, asi que estas fabricas cumplen esa
 * funcion: documentan la forma exacta de cada documento de Firestore y
 * garantizan que el modo mock y el modo real guarden los mismos campos.
 *
 * Regla practica: ningun servicio escribe un objeto "a mano", siempre
 * pasa por la fabrica correspondiente.
 */

import {
  ROLES,
  APPOINTMENT_STATUS,
  COURSE_STATUS,
  COURSE_LEVELS,
  COURSE_MODALITIES,
  ENROLLMENT_STATUS,
  GALLERY_LOCATIONS,
  PAYMENT_STATUS,
} from '@/constants'

/** Genera un identificador unico para el modo mock */
export function makeId(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 9)
  return `${prefix}_${Date.now().toString(36)}${rand}`
}

/** Marca de tiempo actual en formato ISO 8601 */
export function nowISO() {
  return new Date().toISOString()
}

/* ------------------------------------------------------------------ */
/*  users                                                              */
/* ------------------------------------------------------------------ */
export function createUserModel(data = {}) {
  return {
    uid: data.uid || makeId('usr'),
    name: data.name?.trim() || '',
    email: data.email?.trim().toLowerCase() || '',
    phone: data.phone?.trim() || '',
    role: data.role || ROLES.CLIENTE,
    photoURL: data.photoURL || '',
    bio: data.bio || '',
    // Especialidades del barbero, ignorado para clientes
    specialties: Array.isArray(data.specialties) ? data.specialties : [],
    active: data.active !== undefined ? Boolean(data.active) : true,
    createdAt: data.createdAt || nowISO(),
  }
}

/* ------------------------------------------------------------------ */
/*  services                                                           */
/* ------------------------------------------------------------------ */
export function createServiceModel(data = {}) {
  return {
    id: data.id || makeId('srv'),
    name: data.name?.trim() || '',
    description: data.description?.trim() || '',
    duration: Number(data.duration) || 30, // minutos
    price: Number(data.price) || 0,
    active: data.active !== undefined ? Boolean(data.active) : true,
    createdAt: data.createdAt || nowISO(),
  }
}

/* ------------------------------------------------------------------ */
/*  barberServices                                                     */
/* ------------------------------------------------------------------ */

/**
 * Lo que ofrece un barbero concreto.
 *
 * Dos usos:
 *  - serviceId con valor: ajusta precio/duracion de un servicio del
 *    catalogo, o lo desactiva para ese barbero (active: false).
 *  - serviceId vacio: es un servicio PROPIO del barbero, con su nombre
 *    y su descripcion, que no existe en el catalogo de la barberia.
 */
export function createBarberServiceModel(data = {}) {
  return {
    id: data.id || makeId('bsv'),
    barberId: data.barberId || '',
    // Vacio = servicio propio del barbero
    serviceId: data.serviceId || '',
    name: data.name?.trim() || '',
    description: data.description?.trim() || '',
    price: Number(data.price) || 0,
    duration: Number(data.duration) || 30,
    active: data.active !== undefined ? Boolean(data.active) : true,
    createdAt: data.createdAt || nowISO(),
    updatedAt: data.updatedAt || nowISO(),
  }
}

/* ------------------------------------------------------------------ */
/*  appointments                                                       */
/* ------------------------------------------------------------------ */
export function createAppointmentModel(data = {}) {
  return {
    id: data.id || makeId('apt'),
    clientId: data.clientId || '',
    barberId: data.barberId || '',
    // Puede apuntar al catalogo o a un servicio propio del barbero
    serviceId: data.serviceId || '',
    // Nombre congelado: el historial se lee aunque el servicio cambie
    // de nombre o el barbero deje de ofrecerlo.
    serviceName: data.serviceName || '',
    date: data.date || '', // "YYYY-MM-DD"
    startTime: data.startTime || '', // "HH:mm"
    endTime: data.endTime || '', // "HH:mm"
    status: data.status || APPOINTMENT_STATUS.PENDIENTE,
    notes: data.notes || '',
    // Precio congelado al momento de agendar, para que el historial
    // no cambie si luego se edita el precio del servicio.
    price: Number(data.price) || 0,
    createdAt: data.createdAt || nowISO(),
    updatedAt: data.updatedAt || nowISO(),
  }
}

/* ------------------------------------------------------------------ */
/*  blocks                                                             */
/* ------------------------------------------------------------------ */
export function createBlockModel(data = {}) {
  return {
    id: data.id || makeId('blk'),
    barberId: data.barberId || '',
    date: data.date || '',
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    reason: data.reason || 'Descanso',
    createdAt: data.createdAt || nowISO(),
  }
}

/* ------------------------------------------------------------------ */
/*  courses                                                            */
/* ------------------------------------------------------------------ */
export function createCourseModel(data = {}) {
  return {
    id: data.id || makeId('crs'),
    title: data.title?.trim() || '',
    description: data.description?.trim() || '',
    syllabus: Array.isArray(data.syllabus) ? data.syllabus.filter(Boolean) : [],
    requirements: Array.isArray(data.requirements) ? data.requirements.filter(Boolean) : [],
    coverURL: data.coverURL || '',
    instructorId: data.instructorId || '',
    level: data.level || COURSE_LEVELS.PRINCIPIANTE,
    modality: data.modality || COURSE_MODALITIES.PRESENCIAL,
    price: Number(data.price) || 0,
    capacity: Number(data.capacity) || 10,
    enrolledCount: Number(data.enrolledCount) || 0,
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    // schedule: dias de la semana (0=domingo) y franja horaria de cada sesion
    schedule: {
      days: Array.isArray(data.schedule?.days) ? data.schedule.days : [],
      startTime: data.schedule?.startTime || '',
      endTime: data.schedule?.endTime || '',
    },
    location: data.location || '',
    status: data.status || COURSE_STATUS.BORRADOR,
    createdAt: data.createdAt || nowISO(),
    updatedAt: data.updatedAt || nowISO(),
  }
}

/* ------------------------------------------------------------------ */
/*  enrollments                                                        */
/* ------------------------------------------------------------------ */
export function createEnrollmentModel(data = {}) {
  return {
    id: data.id || makeId('enr'),
    courseId: data.courseId || '',
    clientId: data.clientId || '',
    status: data.status || ENROLLMENT_STATUS.INSCRITO,
    // attendance: [{ date: "YYYY-MM-DD", present: true }]
    attendance: Array.isArray(data.attendance) ? data.attendance : [],
    paymentStatus: data.paymentStatus || PAYMENT_STATUS.PENDIENTE,
    enrolledAt: data.enrolledAt || nowISO(),
    updatedAt: data.updatedAt || nowISO(),
  }
}

/* ------------------------------------------------------------------ */
/*  gallery                                                            */
/* ------------------------------------------------------------------ */
export function createGalleryItemModel(data = {}) {
  return {
    id: data.id || makeId('gal'),
    title: data.title?.trim() || '',
    description: data.description?.trim() || '',
    imageURL: data.imageURL || '',
    // En que carrusel del sitio publico aparece esta foto
    location: data.location || GALLERY_LOCATIONS.SERVICIOS,
    // Posicion dentro de su galeria; menor numero, mas a la izquierda
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 0,
    active: data.active !== undefined ? Boolean(data.active) : true,
    createdAt: data.createdAt || nowISO(),
    updatedAt: data.updatedAt || nowISO(),
  }
}

/* ------------------------------------------------------------------ */
/*  business (documento unico)                                         */
/* ------------------------------------------------------------------ */
export function createBusinessModel(data = {}) {
  return {
    name: data.name || 'Barberia Elite',
    logoURL: data.logoURL || '',
    phone: data.phone || '',
    address: data.address || '',
    email: data.email || '',
    description: data.description || '',
    // openingHours: por clave de dia. closed=true significa cerrado.
    openingHours: data.openingHours || defaultOpeningHours(),
    social: {
      instagram: data.social?.instagram || '',
      facebook: data.social?.facebook || '',
      whatsapp: data.social?.whatsapp || '',
    },
    updatedAt: data.updatedAt || nowISO(),
  }
}

/** Horario por defecto: cerrado los domingos */
export function defaultOpeningHours() {
  return {
    lun: { open: '10:00', close: '20:00', closed: false },
    mar: { open: '10:00', close: '20:00', closed: false },
    mie: { open: '10:00', close: '20:00', closed: false },
    jue: { open: '10:00', close: '21:00', closed: false },
    vie: { open: '10:00', close: '21:00', closed: false },
    sab: { open: '09:00', close: '18:00', closed: false },
    dom: { open: '10:00', close: '14:00', closed: true },
  }
}

/** Objeto vacio de curso, util para inicializar formularios */
export function emptyCourseForm(instructorId = '') {
  return {
    title: '',
    description: '',
    syllabus: [''],
    requirements: [''],
    coverURL: '',
    instructorId,
    level: COURSE_LEVELS.PRINCIPIANTE,
    modality: COURSE_MODALITIES.PRESENCIAL,
    price: '',
    capacity: '',
    startDate: '',
    endDate: '',
    schedule: { days: [], startTime: '', endTime: '' },
    location: '',
    status: COURSE_STATUS.BORRADOR,
  }
}
