/**
 * Validaciones reutilizables de formularios.
 *
 * Cada funcion "validateX" recibe un objeto de datos y devuelve un objeto
 * de errores { campo: mensaje }. Si el objeto viene vacio, los datos son
 * validos. Este mismo formato lo consume el hook useForm.
 */

import { COURSE_LEVELS, COURSE_MODALITIES, GALLERY_LOCATIONS } from '@/constants'
import { timeToMinutes } from '@/utils/date'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email) {
  return EMAIL_RE.test(String(email || '').trim())
}

export function isValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

export function isStrongEnough(password) {
  return String(password || '').length >= 6
}

/* ------------------------------------------------------------------ */
/*  Autenticacion                                                      */
/* ------------------------------------------------------------------ */

export function validateLogin({ email, password }) {
  const errors = {}
  if (!email?.trim()) errors.email = 'El correo es obligatorio'
  else if (!isValidEmail(email)) errors.email = 'Formato de correo no valido'
  if (!password) errors.password = 'La contrasena es obligatoria'
  return errors
}

export function validateRegister({ name, email, phone, password, confirmPassword }) {
  const errors = {}
  if (!name?.trim()) errors.name = 'El nombre es obligatorio'
  else if (name.trim().length < 3) errors.name = 'Escribe tu nombre completo'

  if (!email?.trim()) errors.email = 'El correo es obligatorio'
  else if (!isValidEmail(email)) errors.email = 'Formato de correo no valido'

  if (!phone?.trim()) errors.phone = 'El telefono es obligatorio'
  else if (!isValidPhone(phone)) errors.phone = 'Telefono no valido (10 digitos)'

  if (!password) errors.password = 'La contrasena es obligatoria'
  else if (!isStrongEnough(password)) errors.password = 'Minimo 6 caracteres'

  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.confirmPassword = 'Las contrasenas no coinciden'
  }
  return errors
}

/* ------------------------------------------------------------------ */
/*  Perfil                                                             */
/* ------------------------------------------------------------------ */

export function validateProfile({ name, phone }) {
  const errors = {}
  if (!name?.trim()) errors.name = 'El nombre es obligatorio'
  if (phone && !isValidPhone(phone)) errors.phone = 'Telefono no valido'
  return errors
}

/* ------------------------------------------------------------------ */
/*  Barberos (alta desde el panel de administrador)                    */
/* ------------------------------------------------------------------ */

export function validateBarber({ name, email, phone, password, isEdit }) {
  const errors = {}
  if (!name?.trim()) errors.name = 'El nombre es obligatorio'
  if (!email?.trim()) errors.email = 'El correo es obligatorio'
  else if (!isValidEmail(email)) errors.email = 'Formato de correo no valido'
  if (phone && !isValidPhone(phone)) errors.phone = 'Telefono no valido'
  // Al editar no se pide contrasena; al crear si es obligatoria
  if (!isEdit) {
    if (!password) errors.password = 'La contrasena es obligatoria'
    else if (!isStrongEnough(password)) errors.password = 'Minimo 6 caracteres'
  }
  return errors
}

/* ------------------------------------------------------------------ */
/*  Servicios                                                          */
/* ------------------------------------------------------------------ */

export function validateService({ name, duration, price }) {
  const errors = {}
  if (!name?.trim()) errors.name = 'El nombre es obligatorio'
  const dur = Number(duration)
  if (!dur || dur < 5) errors.duration = 'Duracion minima de 5 minutos'
  else if (dur > 480) errors.duration = 'Duracion maxima de 8 horas'
  const p = Number(price)
  if (Number.isNaN(p) || p < 0) errors.price = 'Precio no valido'
  return errors
}

/* ------------------------------------------------------------------ */
/*  Citas                                                              */
/* ------------------------------------------------------------------ */

export function validateAppointment({ clientId, barberId, serviceId, date, startTime }) {
  const errors = {}
  if (!clientId) errors.clientId = 'Selecciona un cliente'
  if (!serviceId) errors.serviceId = 'Selecciona un servicio'
  if (!barberId) errors.barberId = 'Selecciona un barbero'
  if (!date) errors.date = 'Selecciona una fecha'
  if (!startTime) errors.startTime = 'Selecciona un horario'
  return errors
}

/* ------------------------------------------------------------------ */
/*  Bloqueos de horario                                                */
/* ------------------------------------------------------------------ */

export function validateBlock({ date, startTime, endTime, reason }) {
  const errors = {}
  if (!date) errors.date = 'Selecciona una fecha'
  if (!startTime) errors.startTime = 'Hora de inicio obligatoria'
  if (!endTime) errors.endTime = 'Hora de fin obligatoria'
  if (startTime && endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    errors.endTime = 'La hora de fin debe ser posterior al inicio'
  }
  if (!reason?.trim()) errors.reason = 'Indica un motivo'
  return errors
}

/* ------------------------------------------------------------------ */
/*  Cursos                                                             */
/* ------------------------------------------------------------------ */

export function validateCourse(data) {
  const errors = {}
  const {
    title,
    description,
    level,
    modality,
    price,
    capacity,
    startDate,
    endDate,
    schedule,
    location,
    enrolledCount,
  } = data

  if (!title?.trim()) errors.title = 'El titulo es obligatorio'
  else if (title.trim().length < 5) errors.title = 'Titulo demasiado corto'

  if (!description?.trim()) errors.description = 'La descripcion es obligatoria'
  else if (description.trim().length < 20) errors.description = 'Describe el curso con mas detalle'

  if (!Object.values(COURSE_LEVELS).includes(level)) errors.level = 'Selecciona un nivel'
  if (!Object.values(COURSE_MODALITIES).includes(modality)) errors.modality = 'Selecciona una modalidad'

  const p = Number(price)
  if (Number.isNaN(p) || p < 0) errors.price = 'Precio no valido'

  const cap = Number(capacity)
  if (!cap || cap < 1) errors.capacity = 'El cupo debe ser al menos 1'
  else if (enrolledCount && cap < enrolledCount) {
    errors.capacity = `Ya hay ${enrolledCount} inscritos, el cupo no puede ser menor`
  }

  if (!startDate) errors.startDate = 'Fecha de inicio obligatoria'
  if (!endDate) errors.endDate = 'Fecha de fin obligatoria'
  if (startDate && endDate && endDate < startDate) {
    errors.endDate = 'La fecha de fin no puede ser anterior al inicio'
  }

  if (!schedule?.days?.length) errors.scheduleDays = 'Selecciona al menos un dia'
  if (!schedule?.startTime) errors.scheduleStart = 'Hora de inicio obligatoria'
  if (!schedule?.endTime) errors.scheduleEnd = 'Hora de fin obligatoria'
  if (
    schedule?.startTime &&
    schedule?.endTime &&
    timeToMinutes(schedule.endTime) <= timeToMinutes(schedule.startTime)
  ) {
    errors.scheduleEnd = 'La hora de fin debe ser posterior al inicio'
  }

  if (modality === COURSE_MODALITIES.PRESENCIAL && !location?.trim()) {
    errors.location = 'Indica el lugar donde se imparte'
  }

  return errors
}

/* ------------------------------------------------------------------ */
/*  Galeria de fotos                                                   */
/* ------------------------------------------------------------------ */

export function validateGalleryItem({ title, imageURL, location }) {
  const errors = {}
  if (!title?.trim()) errors.title = 'Ponle un nombre a la foto'
  else if (title.trim().length > 60) errors.title = 'Maximo 60 caracteres'
  if (!imageURL) errors.imageURL = 'Sube una imagen'
  if (!Object.values(GALLERY_LOCATIONS).includes(location)) {
    errors.location = 'Elige donde se va a mostrar'
  }
  return errors
}

/* ------------------------------------------------------------------ */
/*  Configuracion del negocio                                          */
/* ------------------------------------------------------------------ */

export function validateBusiness({ name, phone, address }) {
  const errors = {}
  if (!name?.trim()) errors.name = 'El nombre del negocio es obligatorio'
  if (phone && !isValidPhone(phone)) errors.phone = 'Telefono no valido'
  if (!address?.trim()) errors.address = 'La direccion es obligatoria'
  return errors
}

/** true si el objeto de errores esta vacio */
export function isValid(errors) {
  return !errors || Object.keys(errors).length === 0
}
