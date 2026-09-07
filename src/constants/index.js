/**
 * Constantes globales de la aplicacion.
 * Todo valor "magico" (roles, estados, niveles...) vive aqui para que
 * las vistas, los servicios mock y los de Firebase hablen el mismo idioma.
 */

/* ------------------------------------------------------------------ */
/*  Roles                                                              */
/* ------------------------------------------------------------------ */
export const ROLES = {
  CLIENTE: 'cliente',
  BARBERO: 'barbero',
  ADMIN: 'admin',
}

export const ROLE_LABELS = {
  [ROLES.CLIENTE]: 'Cliente',
  [ROLES.BARBERO]: 'Barbero',
  [ROLES.ADMIN]: 'Administrador',
}

/** Ruta de inicio de cada rol tras iniciar sesion */
export const ROLE_HOME = {
  [ROLES.CLIENTE]: '/cliente',
  [ROLES.BARBERO]: '/barbero',
  [ROLES.ADMIN]: '/admin',
}

/* ------------------------------------------------------------------ */
/*  Citas                                                              */
/* ------------------------------------------------------------------ */
export const APPOINTMENT_STATUS = {
  PENDIENTE: 'pendiente',
  CONFIRMADA: 'confirmada',
  COMPLETADA: 'completada',
  CANCELADA: 'cancelada',
  NO_SHOW: 'no-show',
}

export const APPOINTMENT_STATUS_LABELS = {
  [APPOINTMENT_STATUS.PENDIENTE]: 'Pendiente',
  [APPOINTMENT_STATUS.CONFIRMADA]: 'Confirmada',
  [APPOINTMENT_STATUS.COMPLETADA]: 'Completada',
  [APPOINTMENT_STATUS.CANCELADA]: 'Cancelada',
  [APPOINTMENT_STATUS.NO_SHOW]: 'No asistio',
}

/** Clases Tailwind por estado de cita (badges, bordes de calendario...) */
export const APPOINTMENT_STATUS_STYLES = {
  [APPOINTMENT_STATUS.PENDIENTE]: {
    badge: 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/30',
    dot: 'bg-amber-400',
    border: 'border-l-amber-400',
  },
  [APPOINTMENT_STATUS.CONFIRMADA]: {
    badge: 'bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/30',
    dot: 'bg-sky-400',
    border: 'border-l-sky-400',
  },
  [APPOINTMENT_STATUS.COMPLETADA]: {
    badge: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
    dot: 'bg-emerald-400',
    border: 'border-l-emerald-400',
  },
  [APPOINTMENT_STATUS.CANCELADA]: {
    badge: 'bg-ink-600/30 text-ink-300 ring-1 ring-inset ring-ink-500/40',
    dot: 'bg-ink-400',
    border: 'border-l-ink-500',
  },
  [APPOINTMENT_STATUS.NO_SHOW]: {
    badge: 'bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/30',
    dot: 'bg-rose-400',
    border: 'border-l-rose-400',
  },
}

/** Estados que ocupan un hueco real en la agenda del barbero */
export const BLOCKING_APPOINTMENT_STATUS = [
  APPOINTMENT_STATUS.PENDIENTE,
  APPOINTMENT_STATUS.CONFIRMADA,
  APPOINTMENT_STATUS.COMPLETADA,
]

/* ------------------------------------------------------------------ */
/*  Cursos                                                             */
/* ------------------------------------------------------------------ */
export const COURSE_STATUS = {
  BORRADOR: 'borrador',
  PUBLICADO: 'publicado',
  EN_CURSO: 'en curso',
  FINALIZADO: 'finalizado',
  CANCELADO: 'cancelado',
}

export const COURSE_STATUS_LABELS = {
  [COURSE_STATUS.BORRADOR]: 'Borrador',
  [COURSE_STATUS.PUBLICADO]: 'Publicado',
  [COURSE_STATUS.EN_CURSO]: 'En curso',
  [COURSE_STATUS.FINALIZADO]: 'Finalizado',
  [COURSE_STATUS.CANCELADO]: 'Cancelado',
}

export const COURSE_STATUS_STYLES = {
  [COURSE_STATUS.BORRADOR]: 'bg-ink-600/30 text-ink-300 ring-1 ring-inset ring-ink-500/40',
  [COURSE_STATUS.PUBLICADO]: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
  [COURSE_STATUS.EN_CURSO]: 'bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/30',
  [COURSE_STATUS.FINALIZADO]: 'bg-gold-500/10 text-gold-300 ring-1 ring-inset ring-gold-500/30',
  [COURSE_STATUS.CANCELADO]: 'bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/30',
}

/** Estados de curso que bloquean la agenda del barbero instructor */
export const BLOCKING_COURSE_STATUS = [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO]

/** Estados visibles para el publico en el catalogo */
export const PUBLIC_COURSE_STATUS = [COURSE_STATUS.PUBLICADO, COURSE_STATUS.EN_CURSO]

export const COURSE_LEVELS = {
  PRINCIPIANTE: 'principiante',
  INTERMEDIO: 'intermedio',
  AVANZADO: 'avanzado',
}

export const COURSE_LEVEL_LABELS = {
  [COURSE_LEVELS.PRINCIPIANTE]: 'Principiante',
  [COURSE_LEVELS.INTERMEDIO]: 'Intermedio',
  [COURSE_LEVELS.AVANZADO]: 'Avanzado',
}

export const COURSE_LEVEL_STYLES = {
  [COURSE_LEVELS.PRINCIPIANTE]: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30',
  [COURSE_LEVELS.INTERMEDIO]: 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/30',
  [COURSE_LEVELS.AVANZADO]: 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/30',
}

export const COURSE_MODALITIES = {
  PRESENCIAL: 'presencial',
  ONLINE: 'online',
}

export const COURSE_MODALITY_LABELS = {
  [COURSE_MODALITIES.PRESENCIAL]: 'Presencial',
  [COURSE_MODALITIES.ONLINE]: 'Online',
}

/* ------------------------------------------------------------------ */
/*  Inscripciones                                                      */
/* ------------------------------------------------------------------ */
export const ENROLLMENT_STATUS = {
  INSCRITO: 'inscrito',
  CANCELADO: 'cancelado',
  COMPLETADO: 'completado',
}

export const ENROLLMENT_STATUS_LABELS = {
  [ENROLLMENT_STATUS.INSCRITO]: 'Inscrito',
  [ENROLLMENT_STATUS.CANCELADO]: 'Cancelado',
  [ENROLLMENT_STATUS.COMPLETADO]: 'Completado',
}

export const ENROLLMENT_STATUS_STYLES = {
  [ENROLLMENT_STATUS.INSCRITO]: 'bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/30',
  [ENROLLMENT_STATUS.CANCELADO]: 'bg-ink-600/30 text-ink-300 ring-1 ring-inset ring-ink-500/40',
  [ENROLLMENT_STATUS.COMPLETADO]: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
}

export const PAYMENT_STATUS = {
  PENDIENTE: 'pendiente',
  PAGADO: 'pagado',
  REEMBOLSADO: 'reembolsado',
}

export const PAYMENT_STATUS_LABELS = {
  [PAYMENT_STATUS.PENDIENTE]: 'Pago pendiente',
  [PAYMENT_STATUS.PAGADO]: 'Pagado',
  [PAYMENT_STATUS.REEMBOLSADO]: 'Reembolsado',
}

/* ------------------------------------------------------------------ */
/*  Servicios por barbero                                              */
/* ------------------------------------------------------------------ */

/**
 * Cada barbero parte del catalogo de la barberia y desde ahi puede:
 *   - cambiar su precio y su duracion
 *   - dejar de ofrecer un servicio
 *   - anadir servicios propios que solo hace el
 *
 * Si un barbero no ha tocado nada, hereda el precio del catalogo. Asi
 * un barbero recien creado ya se puede reservar sin configurar nada.
 */
export const OFFERING_ORIGIN = {
  CATALOGO: 'catalogo',
  PROPIO: 'propio',
}

export const OFFERING_ORIGIN_LABELS = {
  [OFFERING_ORIGIN.CATALOGO]: 'Del catalogo',
  [OFFERING_ORIGIN.PROPIO]: 'Servicio propio',
}

/**
 * Formas de ordenar la lista de barberos al reservar.
 *
 * A proposito NO se puede ordenar por precio: el cliente no ve las
 * tarifas del equipo en ese paso, precisamente para que elija por con
 * quien quiere cortarse y no por quien cobra menos.
 */
export const BARBER_SORT = {
  NOMBRE: 'nombre',
  VETERANIA: 'veterania',
}

export const BARBER_SORT_LABELS = {
  [BARBER_SORT.NOMBRE]: 'Orden alfabetico',
  [BARBER_SORT.VETERANIA]: 'Mas veteranos primero',
}

/* ------------------------------------------------------------------ */
/*  Galeria de fotos                                                   */
/* ------------------------------------------------------------------ */

/**
 * Cada foto pertenece a UNA de las dos galerias del sitio publico.
 * Asi el administrador puede poner fotos distintas en cada sitio.
 */
export const GALLERY_LOCATIONS = {
  HERO: 'hero',
  INICIO: 'inicio',
  SERVICIOS: 'servicios',
}

export const GALLERY_LOCATION_LABELS = {
  [GALLERY_LOCATIONS.HERO]: 'Portada (foto principal)',
  [GALLERY_LOCATIONS.INICIO]: 'Carrusel de inicio',
  [GALLERY_LOCATIONS.SERVICIOS]: 'Carrusel de servicios',
}

/** Texto de ayuda de cada galeria, para el panel de administracion */
export const GALLERY_LOCATION_HINTS = {
  [GALLERY_LOCATIONS.HERO]: 'Las dos fotos grandes de lo primero que se ve al entrar.',
  [GALLERY_LOCATIONS.INICIO]: 'El carrusel que aparece a mitad de la portada.',
  [GALLERY_LOCATIONS.SERVICIOS]: 'El carrusel de la pagina de Servicios.',
}

/**
 * Cuantas fotos admite cada zona (0 = las que hagan falta).
 *
 * La portada solo tiene hueco para dos imagenes, asi que se limita de
 * verdad: para cambiarlas hay que editar o borrar las que ya estan, no
 * acumular fotos que nunca se verian.
 */
export const GALLERY_LOCATION_MAX = {
  [GALLERY_LOCATIONS.HERO]: 2,
  [GALLERY_LOCATIONS.INICIO]: 0,
  [GALLERY_LOCATIONS.SERVICIOS]: 0,
}

/** Milisegundos que tarda el carrusel en pasar solo a la siguiente foto */
export const CAROUSEL_AUTOPLAY_MS = 4500

/* ------------------------------------------------------------------ */
/*  Agenda                                                             */
/* ------------------------------------------------------------------ */

/** Granularidad de la rejilla de horarios, en minutos */
export const SLOT_STEP_MINUTES = 30

/** Nombres de los dias, indice 0 = domingo (coincide con Date.getDay) */
export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
export const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** Claves usadas por el horario del negocio (openingHours), indice = getDay() */
export const OPENING_HOURS_KEYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

/** Horas minimas de antelacion para cancelar o reagendar una cita */
export const MIN_HOURS_BEFORE_CANCEL = 2

/* ------------------------------------------------------------------ */
/*  Mensajeria cliente <-> barbero                                     */
/* ------------------------------------------------------------------ */

/** Longitud maxima de un mensaje del chat de una cita */
export const MESSAGE_MAX_LENGTH = 1000

/**
 * El chat vive pegado a la cita y MUERE CON ELLA.
 *
 * Se abre cuando el barbero confirma la cita y desaparece en cuanto esta
 * llega a su fin: al completarla, cancelarla o marcar que no asistio, la
 * conversacion se borra entera de la base de datos.
 *
 * Es a proposito, por dos razones:
 *
 *   1. El chat sirve para esa sesion ("llego cinco minutos tarde"), no
 *      para guardar un historial que nadie va a releer.
 *   2. Cada mensaje guardado se cobra cada vez que se lee. Sin borrarlos
 *      se acumularian miles de mensajes viejos que encarecen cada
 *      consulta sin aportar nada.
 */
export const CHAT_WRITABLE_STATUS = [APPOINTMENT_STATUS.CONFIRMADA]
export const CHAT_VISIBLE_STATUS = [APPOINTMENT_STATUS.CONFIRMADA]

/* ------------------------------------------------------------------ */
/*  Limites contra el abuso                                            */
/* ------------------------------------------------------------------ */
/*
 * Una barberia pierde dinero cuando alguien le llena la agenda de citas
 * que no piensa cumplir: esas horas quedan bloqueadas para clientes de
 * verdad. Estos limites existen para eso, no para incordiar a nadie que
 * use la aplicacion con normalidad.
 */

/** Citas activas (pendiente o confirmada) que puede tener un cliente */
export const MAX_ACTIVE_APPOINTMENTS = 1

/** Cancelaciones seguidas que hacen sospechar, y en cuantos dias */
export const MAX_RECENT_CANCELLATIONS = 4
export const CANCELLATION_WINDOW_DAYS = 7

/** Inasistencias que bloquean nuevas reservas, y en cuantos dias */
export const MAX_RECENT_NO_SHOWS = 3
export const NO_SHOW_WINDOW_DAYS = 60

/** Longitud maxima de la nota que el cliente deja en su cita */
export const APPOINTMENT_NOTES_MAX_LENGTH = 300

/** Estados en los que la cita termina y su conversacion se borra */
export const CHAT_CLOSING_STATUS = [
  APPOINTMENT_STATUS.COMPLETADA,
  APPOINTMENT_STATUS.CANCELADA,
  APPOINTMENT_STATUS.NO_SHOW,
]

/** Cada cuantos milisegundos el chat abierto vuelve a pedir mensajes */
export const CHAT_POLL_MS = 4000

/* ------------------------------------------------------------------ */
/*  Varios                                                             */
/* ------------------------------------------------------------------ */
export const CURRENCY = 'MXN'
export const CURRENCY_SYMBOL = '$'

/** Motivos frecuentes al bloquear horarios */
export const BLOCK_REASONS = [
  'Descanso',
  'Comida',
  'Dia libre',
  'Vacaciones',
  'Cita medica',
  'Capacitacion',
  'Otro',
]

/** Bandera de modo demo, leida del entorno de Vite */
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'true').toLowerCase() !== 'false'
