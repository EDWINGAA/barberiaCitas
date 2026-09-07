/**
 * Datos semilla del MODO DEMO.
 *
 * Se generan en relacion a la fecha de hoy para que los tableros y las
 * metricas siempre muestren cifras vivas (citas de hoy, de la semana,
 * cursos por empezar, cursos en marcha...) y nunca ceros.
 *
 * La generacion es determinista: mismo dia, mismos datos.
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
  SLOT_STEP_MINUTES,
} from '@/constants'
import {
  createUserModel,
  createServiceModel,
  createAppointmentModel,
  createMessageModel,
  createBlockModel,
  createCourseModel,
  createEnrollmentModel,
  createBarberServiceModel,
  createBusinessModel,
  createGalleryItemModel,
  defaultOpeningHours,
} from '@/models'
import {
  addDays,
  addMinutes,
  todayISO,
  toISODate,
  fromISODate,
  weekdayOf,
  buildTimeGrid,
  timeToMinutes,
} from '@/utils/date'
import { buildBusyIntervals, findConflict, getCourseSessions, getOpeningForDate } from '@/utils/schedule'
import { resolveOffering } from '@/services/offeringsCore'

/* ================================================================== */
/*  Credenciales visibles en el recuadro del login                     */
/* ================================================================== */

/**
 * Version de la FORMA de los datos de demostracion.
 *
 * Hay que subirla siempre que la semilla cambie de estructura: al anadir
 * una coleccion, un campo nuevo o una categoria nueva. El almacen la
 * compara con la que hay guardada en el navegador y, si no coinciden,
 * vuelve a sembrar. Sin esto, quien ya tenia la demo abierta se queda
 * con datos viejos e incompletos (por ejemplo, sin la galeria de portada
 * o sin los precios por barbero) y el panel no cuadra con la web.
 */
export const SEED_VERSION = 7

export const DEMO_PASSWORD = 'demo123'

export const DEMO_CREDENTIALS = [
  { role: ROLES.ADMIN, label: 'Administrador', email: 'admin@barberia.com', password: DEMO_PASSWORD },
  { role: ROLES.BARBERO, label: 'Barbero', email: 'barbero@barberia.com', password: DEMO_PASSWORD },
  { role: ROLES.CLIENTE, label: 'Cliente', email: 'cliente@barberia.com', password: DEMO_PASSWORD },
]

/* ================================================================== */
/*  Ayudantes de fecha                                                 */
/* ================================================================== */

/**
 * Desplazamiento en dias respecto a hoy, evitando caer en domingo
 * (la barberia cierra ese dia). Empuja hacia adelante si el offset es
 * futuro y hacia atras si es pasado.
 */
function offsetDate(days) {
  let iso = addDays(todayISO(), days)
  if (weekdayOf(iso) === 0) iso = addDays(iso, days >= 0 ? 1 : -1)
  return iso
}

/** Fecha del proximo dia de la semana indicado, a partir de un offset minimo */
function nextWeekdayFrom(minOffset, weekday) {
  let iso = addDays(todayISO(), minOffset)
  for (let i = 0; i < 7; i += 1) {
    if (weekdayOf(iso) === weekday) return iso
    iso = addDays(iso, 1)
  }
  return iso
}

/** Marca de tiempo ISO de hace N dias, util para createdAt realistas */
function daysAgoTimestamp(days, hour = 12) {
  const d = fromISODate(addDays(todayISO(), -days))
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

/* ================================================================== */
/*  Imagenes                                                           */
/* ================================================================== */
// Se usan fotos publicas de Unsplash. Si no cargan (sin internet), los
// componentes Avatar y CourseCover muestran un respaldo con degradado.
const IMG = {
  barber1: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&q=80&auto=format&fit=crop',
  barber2: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80&auto=format&fit=crop',
  barber3: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80&auto=format&fit=crop',
  admin: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=400&q=80&auto=format&fit=crop',
  course1: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&q=80&auto=format&fit=crop',
  course2: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=900&q=80&auto=format&fit=crop',
  course3: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=900&q=80&auto=format&fit=crop',
  course4: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=900&q=80&auto=format&fit=crop',
  course5: 'https://images.unsplash.com/photo-1596728325488-58c87691e9af?w=900&q=80&auto=format&fit=crop',
  course6: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&q=80&auto=format&fit=crop',
}

/** Fotos de trabajos, base para las dos galerias del sitio publico */
function galleryPhoto(id) {
  return `https://images.unsplash.com/photo-${id}?w=1000&q=80&auto=format&fit=crop`
}

/* ================================================================== */
/*  1. Negocio                                                         */
/* ================================================================== */

function buildBusiness() {
  return createBusinessModel({
    name: 'Barberia Elite',
    logoURL: '',
    phone: '5544219087',
    email: 'hola@barberiaelite.com',
    address: 'Av. Insurgentes Sur 1425, Col. Insurgentes Mixcoac, CDMX',
    description:
      'Tres generaciones cuidando el estilo de la ciudad. Cortes clasicos, afeitado a navaja y una escuela propia para quienes quieren vivir del oficio.',
    openingHours: defaultOpeningHours(),
    social: {
      instagram: '@barberiaelite',
      facebook: 'BarberiaElite',
      whatsapp: '5544219087',
    },
  })
}

/* ================================================================== */
/*  Galerias de fotos                                                  */
/* ================================================================== */

/**
 * Dos galerias independientes: una para la portada y otra para la
 * pagina de servicios. El administrador las gestiona por separado,
 * asi que llevan fotos distintas a proposito.
 */
function buildGallery() {
  // Ninguna de estas fotos se repite con las portadas de los cursos ni
  // con los retratos del equipo: cada imagen aparece en un unico sitio.

  // La portada solo tiene sitio para dos fotos, asi que se siembran
  // exactamente esas dos.
  const hero = [
    ['Fade con barba perfilada', 'La foto grande de la portada.', '1503443207922-dff7d543fd0e'],
    ['Detalle de navaja', 'La foto pequena que la acompana.', '1526045478516-99145907023c'],
  ]

  const inicio = [
    ['Fade a la piel', 'Degradado al cero con transicion limpia y linea marcada a navaja.', '1605497788044-5a32c7078486'],
    ['Barba esculpida', 'Perfilado completo con toalla caliente y aceite de argan.', '1512690459411-b9245aed614b'],
    ['Corte clasico con raya', 'Tijera y peine, raya definida y acabado con pomada mate.', '1517832606299-7ae9b720a186'],
    ['Texturizado moderno', 'Volumen natural y movimiento para cabello grueso.', '1519699047748-de8e457a634e'],
    ['Afeitado a navaja', 'El ritual completo: vapor, navaja recta y balsamo frio.', '1567894340315-735d7c361db0'],
    ['Diseno con linea', 'Detalle a mano alzada sobre un fade medio.', '1593702288056-f173f3b1e0e0'],
  ]

  const servicios = [
    ['Skin fade + barba', 'Nuestro paquete estrella, de la nuca a la mandibula.', '1493256338651-d82f7acb2b38'],
    ['Pompadour', 'Clasico con volumen alto y laterales cerrados.', '1614289371518-722f2615943d'],
    ['Buzz cut perfecto', 'Uniforme, con perfilado de contornos y cuello.', '1502767089025-6572583495b9'],
    ['Rizos definidos', 'Corte en capas para respetar la caida natural del rizo.', '1634449571010-02389ed0f9b0'],
    ['Undercut con diseno', 'Contraste marcado y trazo geometrico a navaja.', '1622287162716-f311baa1a2b8'],
    ['Corte infantil', 'Rapido, comodo y con paleta al final.', '1621607512214-68297480165e'],
    ['Cobertura de canas', 'Color natural, sin efecto plano ni raices marcadas.', '1590540179852-2110a54f813a'],
    ['Tijera sobre peine', 'Acabado suave, sin escalones, 100% a tijera.', '1587909209111-5097ee578ec3'],
  ]

  function crear(filas, location, prefijo) {
    return filas.map(([title, description, photoId], index) =>
      createGalleryItemModel({
        id: `gal_${prefijo}_${index + 1}`,
        title,
        description,
        imageURL: galleryPhoto(photoId),
        location,
        order: index,
        active: true,
        createdAt: daysAgoTimestamp(40 - index, 12),
      })
    )
  }

  return [
    ...crear(hero, GALLERY_LOCATIONS.HERO, 'hero'),
    ...crear(inicio, GALLERY_LOCATIONS.INICIO, 'ini'),
    ...crear(servicios, GALLERY_LOCATIONS.SERVICIOS, 'srv'),
  ]
}

/* ================================================================== */
/*  2. Usuarios                                                        */
/* ================================================================== */

function buildUsers() {
  const admin = createUserModel({
    uid: 'usr_admin',
    name: 'Marlon Aaron Herrera',
    email: 'admin@barberia.com',
    phone: '5544219087',
    role: ROLES.ADMIN,
    photoURL: IMG.admin,
    bio: 'Administrador general de la barberia.',
    createdAt: daysAgoTimestamp(420, 9),
  })

  const barbers = [
    createUserModel({
      uid: 'usr_barber_1',
      name: 'Aurelio Mendoza',
      email: 'barbero@barberia.com',
      phone: '5511223344',
      role: ROLES.BARBERO,
      photoURL: IMG.barber1,
      bio: 'Fundador de la casa. 22 anos de oficio y una obsesion sana con el degradado y la navaja.',
      specialties: ['Corte clasico', 'Afeitado a navaja', 'Fade'],
      createdAt: daysAgoTimestamp(400, 10),
    }),
    createUserModel({
      uid: 'usr_barber_2',
      name: 'Sofia Ramirez',
      email: 'sofia@barberia.com',
      phone: '5522334455',
      role: ROLES.BARBERO,
      photoURL: IMG.barber2,
      bio: 'Especialista en barba y trabajo de tijera. Formadora del taller de afeitado tradicional.',
      specialties: ['Barba', 'Tijera', 'Texturizado'],
      createdAt: daysAgoTimestamp(300, 10),
    }),
    createUserModel({
      uid: 'usr_barber_3',
      name: 'Diego Castillo',
      email: 'diego@barberia.com',
      phone: '5533445566',
      role: ROLES.BARBERO,
      photoURL: IMG.barber3,
      bio: 'Color y estilos urbanos. Lleva la parte tecnica de la escuela y los cursos en linea.',
      specialties: ['Colorimetria', 'Diseno de linea', 'Estilos urbanos'],
      createdAt: daysAgoTimestamp(210, 10),
    }),
  ]

  const clientSeed = [
    ['usr_client_1', 'Javier Nunez', 'cliente@barberia.com', '5566778899', 40],
    ['usr_client_2', 'Carla Estrada', 'carla.estrada@correo.com', '5512349876', 120],
    ['usr_client_3', 'Ruben Ortega', 'ruben.ortega@correo.com', '5598761234', 200],
    ['usr_client_4', 'Melissa Fuentes', 'melissa.fuentes@correo.com', '5545678912', 95],
    ['usr_client_5', 'Andres Villalobos', 'andres.villalobos@correo.com', '5587651234', 60],
    ['usr_client_6', 'Paola Serrano', 'paola.serrano@correo.com', '5523456789', 150],
    ['usr_client_7', 'Hector Lozano', 'hector.lozano@correo.com', '5576543210', 30],
    ['usr_client_8', 'Ximena Robles', 'ximena.robles@correo.com', '5534129876', 15],
  ]

  const clients = clientSeed.map(([uid, name, email, phone, ageDays]) =>
    createUserModel({
      uid,
      name,
      email,
      phone,
      role: ROLES.CLIENTE,
      photoURL: '',
      createdAt: daysAgoTimestamp(ageDays, 11),
    })
  )

  return [admin, ...barbers, ...clients]
}

/** Contrasenas del modo demo. En Firebase real las gestiona Authentication. */
function buildPasswords(users) {
  const map = {}
  users.forEach((u) => {
    map[u.email] = DEMO_PASSWORD
  })
  return map
}

/* ================================================================== */
/*  3. Servicios                                                       */
/* ================================================================== */

function buildServices() {
  return [
    createServiceModel({
      id: 'srv_corte_clasico',
      name: 'Corte clasico',
      description: 'Corte a tijera y maquina, lavado, secado y peinado con producto de la casa.',
      duration: 30,
      price: 180,
      createdAt: daysAgoTimestamp(400),
    }),
    createServiceModel({
      id: 'srv_corte_barba',
      name: 'Corte + barba',
      description: 'Nuestro paquete estrella: corte completo mas perfilado y ritual de barba con toalla caliente.',
      duration: 45,
      price: 280,
      createdAt: daysAgoTimestamp(400),
    }),
    createServiceModel({
      id: 'srv_afeitado',
      name: 'Afeitado tradicional a navaja',
      description: 'Afeitado al ras con navaja, aceites tibios, toalla caliente y balsamo calmante.',
      duration: 30,
      price: 200,
      createdAt: daysAgoTimestamp(380),
    }),
    createServiceModel({
      id: 'srv_barba',
      name: 'Arreglo de barba',
      description: 'Perfilado, recorte y acondicionado de barba con aceite y cera.',
      duration: 20,
      price: 150,
      createdAt: daysAgoTimestamp(360),
    }),
    createServiceModel({
      id: 'srv_infantil',
      name: 'Corte infantil',
      description: 'Corte para ninos menores de 12 anos, con paciencia y una paleta al final.',
      duration: 25,
      price: 140,
      createdAt: daysAgoTimestamp(300),
    }),
    createServiceModel({
      id: 'srv_color',
      name: 'Tinte y color',
      description: 'Aplicacion de color, cobertura de canas o decoloracion con diagnostico previo.',
      duration: 60,
      price: 450,
      createdAt: daysAgoTimestamp(180),
    }),
  ]
}

/* ================================================================== */
/*  Servicios por barbero                                              */
/* ================================================================== */

/**
 * Cada barbero cobra lo suyo.
 *
 * Aurelio, el fundador, cobra por encima del catalogo; Sofia va al
 * precio de casa salvo en lo suyo; Diego entra algo mas barato para
 * hacerse cartera. Ademas cada uno tiene un servicio propio que solo
 * hace el, para que se vea que la funcion existe.
 */
function buildBarberServices() {
  const ajustes = [
    // [barbero, servicio, precio, duracion, activo]
    // --- Aurelio: el mas caro de la casa, y no hace color ---
    [1, 'srv_corte_clasico', 220, 35, true],
    [1, 'srv_corte_barba', 330, 50, true],
    [1, 'srv_afeitado', 250, 35, true],
    [1, 'srv_barba', 180, 25, true],
    [1, 'srv_color', 0, 0, false], // no ofrece color

    // --- Sofia: precio de casa, mas cara en barba porque es lo suyo ---
    [2, 'srv_barba', 190, 30, true],
    [2, 'srv_afeitado', 230, 40, true],

    // --- Diego: entra mas barato, y el color es su especialidad ---
    [3, 'srv_corte_clasico', 160, 30, true],
    [3, 'srv_corte_barba', 250, 45, true],
    [3, 'srv_color', 520, 75, true],
    [3, 'srv_afeitado', 0, 0, false], // no hace navaja
  ]

  const propios = [
    // [barbero, nombre, descripcion, precio, duracion]
    [
      1,
      'Ritual del fundador',
      'Corte, afeitado a navaja, masaje capilar y cafe de olla. Una hora entera para ti.',
      650,
      75,
    ],
    [
      2,
      'Diseno de barba a medida',
      'Estudio del rostro, plantilla y perfilado milimetrico. Incluye kit de mantenimiento.',
      420,
      55,
    ],
    [
      3,
      'Mechas y platinado',
      'Decoloracion controlada, matizado y tratamiento reconstructor. Requiere prueba de mecha.',
      890,
      120,
    ],
  ]

  const filas = ajustes.map(([barbero, serviceId, price, duration, active], i) =>
    createBarberServiceModel({
      id: `bsv_aj_${i + 1}`,
      barberId: `usr_barber_${barbero}`,
      serviceId,
      price,
      duration,
      active,
      createdAt: daysAgoTimestamp(60 - i, 10),
    })
  )

  const propiasFilas = propios.map(([barbero, name, description, price, duration], i) =>
    createBarberServiceModel({
      id: `bsv_propio_${i + 1}`,
      barberId: `usr_barber_${barbero}`,
      name,
      description,
      price,
      duration,
      createdAt: daysAgoTimestamp(45 - i, 11),
    })
  )

  return [...filas, ...propiasFilas]
}

/* ================================================================== */
/*  4. Cursos                                                          */
/* ================================================================== */

function buildCourses() {
  return [
    createCourseModel({
      id: 'crs_fundamentos',
      title: 'Fundamentos del corte clasico',
      description:
        'El punto de partida del oficio. Aprende a leer la cabeza del cliente, dominar la tijera y la maquina, y entregar un corte clasico impecable de principio a fin. Incluye practica sobre maniqui y sobre modelo real.',
      syllabus: [
        'Anatomia del craneo y lectura del cabello',
        'Herramientas: tijera, maquina, navaja y su mantenimiento',
        'Sectorizacion y guias de corte',
        'Degradados basicos y difuminado',
        'Corte a tijera sobre peine',
        'Peinado, producto y acabado profesional',
        'Practica supervisada sobre modelo real',
      ],
      requirements: [
        'No se requiere experiencia previa',
        'Kit basico de tijera y peine (se puede adquirir en la escuela)',
        'Mayor de 16 anos',
      ],
      coverURL: IMG.course1,
      instructorId: 'usr_barber_1',
      level: COURSE_LEVELS.PRINCIPIANTE,
      modality: COURSE_MODALITIES.PRESENCIAL,
      price: 2800,
      capacity: 12,
      startDate: nextWeekdayFrom(9, 2), // proximo martes a partir de +9 dias
      endDate: addDays(nextWeekdayFrom(9, 2), 28),
      schedule: { days: [2, 4], startTime: '16:00', endTime: '19:00' },
      location: 'Aula 1 - Insurgentes Sur 1425',
      status: COURSE_STATUS.PUBLICADO,
      createdAt: daysAgoTimestamp(35, 9),
    }),
    createCourseModel({
      id: 'crs_barba_navaja',
      title: 'Barbas y afeitado a navaja',
      description:
        'El ritual completo de la barberia tradicional. Trabajamos perfilado, diseno segun el rostro, afeitado al ras con navaja recta y protocolo de higiene profesional.',
      syllabus: [
        'Tipos de barba y morfologia facial',
        'Preparacion de la piel: vapor, toalla y aceites',
        'Manejo y asentado de la navaja recta',
        'Afeitado a favor y a contrapelo',
        'Perfilado y diseno de contornos',
        'Post-afeitado, balsamos y cuidados en casa',
      ],
      requirements: ['Conocimientos basicos de barberia', 'Navaja recta propia', 'Mayor de 18 anos'],
      coverURL: IMG.course2,
      instructorId: 'usr_barber_2',
      level: COURSE_LEVELS.INTERMEDIO,
      modality: COURSE_MODALITIES.PRESENCIAL,
      price: 3500,
      capacity: 8,
      startDate: offsetDate(-14),
      endDate: addDays(todayISO(), 12),
      schedule: { days: [1, 3], startTime: '17:00', endTime: '20:00' },
      location: 'Aula 2 - Insurgentes Sur 1425',
      status: COURSE_STATUS.EN_CURSO,
      createdAt: daysAgoTimestamp(60, 10),
    }),
    createCourseModel({
      id: 'crs_colorimetria',
      title: 'Colorimetria para barberos',
      description:
        'Curso en linea para dejar de improvisar con el color. Rueda cromatica, diagnostico capilar, formulacion, decoloracion controlada y correccion de errores frecuentes.',
      syllabus: [
        'Rueda cromatica y teoria del color aplicada',
        'Diagnostico capilar y prueba de mecha',
        'Formulacion: volumenes y tiempos',
        'Decoloracion segura y control de daño',
        'Matizado y neutralizacion de reflejos',
        'Correccion de color y casos reales',
      ],
      requirements: [
        'Experiencia previa en barberia o estiliismo',
        'Conexion estable y camara',
        'Kit de color propio para las practicas',
      ],
      coverURL: IMG.course3,
      instructorId: 'usr_barber_3',
      level: COURSE_LEVELS.AVANZADO,
      modality: COURSE_MODALITIES.ONLINE,
      price: 4200,
      capacity: 20,
      startDate: nextWeekdayFrom(20, 6), // proximo sabado a partir de +20 dias
      endDate: addDays(nextWeekdayFrom(20, 6), 35),
      schedule: { days: [6], startTime: '10:00', endTime: '14:00' },
      location: 'Zoom - enlace enviado por correo',
      status: COURSE_STATUS.PUBLICADO,
      createdAt: daysAgoTimestamp(22, 16),
    }),
    createCourseModel({
      id: 'crs_fade_avanzado',
      title: 'Fade perfecto: tecnicas avanzadas',
      description:
        'Intensivo de degradados. Skin fade, taper, burst y drop fade, ademas de diseno con navaja y correccion de errores comunes en piel.',
      syllabus: [
        'Tipos de fade y cuando usar cada uno',
        'Control de guardas y palanca',
        'Skin fade paso a paso',
        'Burst fade y drop fade',
        'Diseno de lineas con navaja',
        'Errores frecuentes y como corregirlos',
      ],
      requirements: ['Al menos 1 ano de experiencia cortando', 'Maquina propia con guardas completas'],
      coverURL: IMG.course4,
      instructorId: 'usr_barber_1',
      level: COURSE_LEVELS.AVANZADO,
      modality: COURSE_MODALITIES.PRESENCIAL,
      price: 5000,
      capacity: 10,
      startDate: offsetDate(-62),
      endDate: offsetDate(-31),
      schedule: { days: [2, 4], startTime: '16:00', endTime: '19:00' },
      location: 'Aula 1 - Insurgentes Sur 1425',
      status: COURSE_STATUS.FINALIZADO,
      createdAt: daysAgoTimestamp(110, 12),
    }),
    createCourseModel({
      id: 'crs_negocio',
      title: 'Monta tu propia barberia',
      description:
        'La parte que nadie ensena: costos, precios, permisos, inventario, contratacion y marketing local para abrir un local rentable y no morir en el intento.',
      syllabus: [
        'Modelo de negocio y punto de equilibrio',
        'Como fijar precios sin regalar tu trabajo',
        'Permisos, tramites y proveedores',
        'Contratacion y reparto de comisiones',
        'Marketing local y redes sociales',
        'Fidelizacion y agenda llena todo el mes',
      ],
      requirements: ['Ser barbero en activo o estar por abrir un local'],
      coverURL: IMG.course5,
      instructorId: 'usr_barber_3',
      level: COURSE_LEVELS.INTERMEDIO,
      modality: COURSE_MODALITIES.ONLINE,
      price: 2400,
      capacity: 25,
      startDate: nextWeekdayFrom(16, 5), // proximo viernes a partir de +16 dias
      endDate: addDays(nextWeekdayFrom(16, 5), 21),
      schedule: { days: [5], startTime: '18:00', endTime: '21:00' },
      location: 'Google Meet - enlace enviado por correo',
      status: COURSE_STATUS.PUBLICADO,
      createdAt: daysAgoTimestamp(12, 18),
    }),
    createCourseModel({
      id: 'crs_tijera_pro',
      title: 'Trabajo de tijera y texturizado',
      description:
        'Curso enfocado 100% en tijera: texturizado, desfilado, capas y control de volumen para cabellos dificiles. Pendiente de revision del administrador.',
      syllabus: [
        'Tipos de tijera y su uso correcto',
        'Tijera sobre peine y sobre dedos',
        'Texturizado y desfilado',
        'Manejo de volumen y densidad',
        'Cabello rizado y ondulado',
      ],
      requirements: ['Experiencia intermedia', 'Tijera de entresacar propia'],
      coverURL: IMG.course6,
      instructorId: 'usr_barber_2',
      level: COURSE_LEVELS.INTERMEDIO,
      modality: COURSE_MODALITIES.PRESENCIAL,
      price: 3100,
      capacity: 10,
      startDate: nextWeekdayFrom(30, 3),
      endDate: addDays(nextWeekdayFrom(30, 3), 28),
      schedule: { days: [3], startTime: '16:00', endTime: '19:00' },
      location: 'Aula 2 - Insurgentes Sur 1425',
      status: COURSE_STATUS.BORRADOR,
      createdAt: daysAgoTimestamp(4, 20),
    }),
  ]
}

/* ================================================================== */
/*  5. Inscripciones                                                   */
/* ================================================================== */

function buildEnrollments(courses) {
  const byId = Object.fromEntries(courses.map((c) => [c.id, c]))

  /** Genera la lista de asistencia de las sesiones ya pasadas de un curso */
  function pastAttendance(courseId, absentDates = []) {
    const course = byId[courseId]
    if (!course) return []
    const today = todayISO()
    return getCourseSessions(course)
      .filter((s) => s.date < today)
      .map((s) => ({ date: s.date, present: !absentDates.includes(s.date) }))
  }

  const rows = [
    // Fundamentos del corte clasico (empieza pronto, sin sesiones pasadas)
    ['enr_1', 'crs_fundamentos', 'usr_client_1', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PAGADO, 20],
    ['enr_2', 'crs_fundamentos', 'usr_client_4', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PAGADO, 18],
    ['enr_3', 'crs_fundamentos', 'usr_client_7', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PENDIENTE, 9],
    ['enr_4', 'crs_fundamentos', 'usr_client_8', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PENDIENTE, 3],
    ['enr_5', 'crs_fundamentos', 'usr_client_2', ENROLLMENT_STATUS.CANCELADO, PAYMENT_STATUS.REEMBOLSADO, 25],

    // Barbas y afeitado a navaja (en curso, con asistencia registrada)
    ['enr_6', 'crs_barba_navaja', 'usr_client_2', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PAGADO, 40],
    ['enr_7', 'crs_barba_navaja', 'usr_client_3', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PAGADO, 38],
    ['enr_8', 'crs_barba_navaja', 'usr_client_5', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PAGADO, 33],
    ['enr_9', 'crs_barba_navaja', 'usr_client_1', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PENDIENTE, 30],
    ['enr_10', 'crs_barba_navaja', 'usr_client_6', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PAGADO, 29],

    // Colorimetria (arranca en semanas)
    ['enr_11', 'crs_colorimetria', 'usr_client_3', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PAGADO, 15],
    ['enr_12', 'crs_colorimetria', 'usr_client_6', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PENDIENTE, 11],
    ['enr_13', 'crs_colorimetria', 'usr_client_4', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PAGADO, 6],

    // Monta tu propia barberia
    ['enr_14', 'crs_negocio', 'usr_client_5', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PAGADO, 8],
    ['enr_15', 'crs_negocio', 'usr_client_7', ENROLLMENT_STATUS.INSCRITO, PAYMENT_STATUS.PENDIENTE, 5],

    // Fade perfecto (curso ya finalizado)
    ['enr_16', 'crs_fade_avanzado', 'usr_client_1', ENROLLMENT_STATUS.COMPLETADO, PAYMENT_STATUS.PAGADO, 100],
    ['enr_17', 'crs_fade_avanzado', 'usr_client_3', ENROLLMENT_STATUS.COMPLETADO, PAYMENT_STATUS.PAGADO, 98],
    ['enr_18', 'crs_fade_avanzado', 'usr_client_8', ENROLLMENT_STATUS.COMPLETADO, PAYMENT_STATUS.PAGADO, 95],
  ]

  const enrollments = rows.map(([id, courseId, clientId, status, paymentStatus, ageDays]) =>
    createEnrollmentModel({
      id,
      courseId,
      clientId,
      status,
      paymentStatus,
      enrolledAt: daysAgoTimestamp(ageDays, 13),
      attendance:
        status === ENROLLMENT_STATUS.CANCELADO
          ? []
          : pastAttendance(courseId, clientId === 'usr_client_5' ? [] : []),
    })
  )

  // enrolledCount coherente: solo cuentan las inscripciones no canceladas
  courses.forEach((course) => {
    course.enrolledCount = enrollments.filter(
      (e) => e.courseId === course.id && e.status !== ENROLLMENT_STATUS.CANCELADO
    ).length
  })

  return enrollments
}

/* ================================================================== */
/*  6. Bloqueos de horario                                             */
/* ================================================================== */

function buildBlocks() {
  return [
    createBlockModel({
      id: 'blk_1',
      barberId: 'usr_barber_1',
      date: todayISO(),
      startTime: '15:00',
      endTime: '16:00',
      reason: 'Comida',
    }),
    createBlockModel({
      id: 'blk_2',
      barberId: 'usr_barber_2',
      date: offsetDate(3),
      startTime: '10:00',
      endTime: '21:00',
      reason: 'Dia libre',
    }),
    createBlockModel({
      id: 'blk_3',
      barberId: 'usr_barber_3',
      date: offsetDate(4),
      startTime: '12:00',
      endTime: '13:30',
      reason: 'Cita medica',
    }),
    createBlockModel({
      id: 'blk_4',
      barberId: 'usr_barber_1',
      date: offsetDate(7),
      startTime: '13:00',
      endTime: '15:00',
      reason: 'Capacitacion',
    }),
  ]
}

/* ================================================================== */
/*  7. Citas                                                           */
/* ================================================================== */

/**
 * Plantilla de citas: [offsetDias, barbero, cliente, servicio, horaDeseada, estado].
 * Reparte 28 citas entre pasado, hoy y las proximas dos semanas, cubriendo
 * los cinco estados posibles.
 */
const APPOINTMENT_PLAN = [
  // --- Pasado ---
  [-18, 1, 1, 'srv_corte_barba', '10:00', APPOINTMENT_STATUS.COMPLETADA],
  [-18, 2, 3, 'srv_corte_clasico', '11:00', APPOINTMENT_STATUS.COMPLETADA],
  [-16, 1, 2, 'srv_barba', '12:30', APPOINTMENT_STATUS.COMPLETADA],
  [-15, 3, 5, 'srv_color', '11:00', APPOINTMENT_STATUS.COMPLETADA],
  [-14, 2, 4, 'srv_corte_clasico', '10:30', APPOINTMENT_STATUS.NO_SHOW],
  [-12, 1, 6, 'srv_afeitado', '13:00', APPOINTMENT_STATUS.COMPLETADA],
  [-11, 3, 7, 'srv_corte_clasico', '12:00', APPOINTMENT_STATUS.COMPLETADA],
  [-10, 2, 8, 'srv_infantil', '11:30', APPOINTMENT_STATUS.CANCELADA],
  [-9, 1, 1, 'srv_corte_clasico', '10:00', APPOINTMENT_STATUS.COMPLETADA],
  [-8, 3, 2, 'srv_corte_barba', '15:00', APPOINTMENT_STATUS.COMPLETADA],
  [-7, 2, 5, 'srv_barba', '12:00', APPOINTMENT_STATUS.COMPLETADA],
  [-6, 3, 3, 'srv_color', '16:30', APPOINTMENT_STATUS.COMPLETADA],
  [-5, 3, 4, 'srv_corte_clasico', '11:00', APPOINTMENT_STATUS.NO_SHOW],
  [-4, 2, 6, 'srv_corte_barba', '13:00', APPOINTMENT_STATUS.COMPLETADA],
  [-3, 1, 7, 'srv_afeitado', '14:00', APPOINTMENT_STATUS.COMPLETADA],
  [-2, 3, 8, 'srv_corte_clasico', '10:30', APPOINTMENT_STATUS.COMPLETADA],
  [-2, 2, 1, 'srv_barba', '12:30', APPOINTMENT_STATUS.COMPLETADA],
  [-1, 1, 5, 'srv_corte_clasico', '11:30', APPOINTMENT_STATUS.COMPLETADA],
  [-1, 3, 3, 'srv_infantil', '13:30', APPOINTMENT_STATUS.COMPLETADA],

  // --- Hoy ---
  [0, 1, 2, 'srv_corte_barba', '10:00', APPOINTMENT_STATUS.CONFIRMADA],
  [0, 1, 4, 'srv_corte_clasico', '12:00', APPOINTMENT_STATUS.PENDIENTE],
  [0, 2, 5, 'srv_afeitado', '13:30', APPOINTMENT_STATUS.CONFIRMADA],
  [0, 3, 6, 'srv_infantil', '11:00', APPOINTMENT_STATUS.CONFIRMADA],
  [0, 2, 8, 'srv_corte_clasico', '16:00', APPOINTMENT_STATUS.PENDIENTE],

  // --- Proximos dias ---
  [1, 1, 8, 'srv_corte_clasico', '11:00', APPOINTMENT_STATUS.CONFIRMADA],
  [2, 2, 3, 'srv_corte_barba', '12:30', APPOINTMENT_STATUS.PENDIENTE],
  [3, 3, 7, 'srv_color', '15:00', APPOINTMENT_STATUS.CONFIRMADA],
  [5, 1, 1, 'srv_barba', '10:30', APPOINTMENT_STATUS.PENDIENTE],
  [6, 2, 2, 'srv_corte_clasico', '11:00', APPOINTMENT_STATUS.PENDIENTE],
  [8, 3, 5, 'srv_corte_barba', '11:30', APPOINTMENT_STATUS.CONFIRMADA],
  [10, 1, 6, 'srv_afeitado', '13:00', APPOINTMENT_STATUS.PENDIENTE],
]

const NOTES_POOL = [
  '',
  'Prefiere maquina del 2 a los lados.',
  'Alergico a productos con alcohol.',
  'Llega 10 minutos antes.',
  '',
  'Pidio no recortar el bigote.',
  '',
  'Quiere el mismo corte de la vez pasada.',
]

/**
 * Genera las citas resolviendo conflictos: si el horario deseado choca con
 * un bloqueo, con una sesion de curso o con otra cita del mismo barbero,
 * busca el siguiente hueco libre de ese dia.
 */
function buildAppointments({ services, barberServices, courses, blocks, business }) {
  const created = []

  APPOINTMENT_PLAN.forEach(([dayOffset, barberIdx, clientIdx, serviceId, desiredTime, status], i) => {
    const barberId = `usr_barber_${barberIdx}`
    const clientId = `usr_client_${clientIdx}`
    const date = offsetDate(dayOffset)

    // Cada barbero tiene su precio y su duracion. Si no ofrece ese
    // servicio, la cita simplemente no se siembra: asi los datos de
    // ejemplo nunca contradicen lo que cada barbero dice que hace.
    const offering = resolveOffering({ services, rows: barberServices, barberId, serviceId })
    if (!offering || !offering.active) return

    const opening = getOpeningForDate(business.openingHours, date)
    if (!opening) return // por seguridad: nunca agendar en dia cerrado

    // Intervalos ya ocupados de ese barbero ese dia
    const busy = buildBusyIntervals({
      date,
      appointments: created.filter((a) => a.barberId === barberId),
      blocks: blocks.filter((b) => b.barberId === barberId),
      courses: courses.filter((c) => c.instructorId === barberId),
    })

    // Rejilla de horarios validos para la duracion del servicio
    const grid = buildTimeGrid(opening.open, opening.close, SLOT_STEP_MINUTES, offering.duration)
    if (!grid.length) return

    // Empezamos por la hora deseada y avanzamos en circulo hasta encontrar hueco
    const desiredMin = timeToMinutes(desiredTime)
    let startIdx = grid.findIndex((t) => timeToMinutes(t) >= desiredMin)
    if (startIdx < 0) startIdx = 0

    let chosen = null
    for (let k = 0; k < grid.length; k += 1) {
      const time = grid[(startIdx + k) % grid.length]
      const end = addMinutes(time, offering.duration)
      if (!findConflict(time, end, busy)) {
        chosen = time
        break
      }
    }
    if (!chosen) return // dia lleno: se descarta esta cita

    created.push(
      createAppointmentModel({
        id: `apt_${String(i + 1).padStart(3, '0')}`,
        clientId,
        barberId,
        serviceId,
        date,
        startTime: chosen,
        endTime: addMinutes(chosen, offering.duration),
        status,
        notes: NOTES_POOL[i % NOTES_POOL.length],
        serviceName: offering.name,
        price: offering.price,
        createdAt: daysAgoTimestamp(Math.max(1, 20 - dayOffset), 9),
      })
    )
  })

  return created
}

/* ================================================================== */
/*  8. Chat de citas                                                   */
/* ================================================================== */

/**
 * Siembra una conversacion de ejemplo en la primera cita confirmada que
 * aun no ha pasado, para que el chat no se vea vacio al abrir la demo.
 */
function buildMessages(appointments) {
  const target = appointments.find(
    (a) => a.status === APPOINTMENT_STATUS.CONFIRMADA && a.date >= offsetDate(0)
  )
  if (!target) return []

  const base = Date.now() - 3 * 60 * 60 * 1000
  const stamp = (min) => new Date(base + min * 60 * 1000).toISOString()

  const partes = { clientId: target.clientId, barberId: target.barberId }

  return [
    createMessageModel({
      id: 'msg_001',
      appointmentId: target.id,
      ...partes,
      senderId: target.clientId,
      senderRole: ROLES.CLIENTE,
      text: 'Hola! Voy a llegar unos 5 minutos tarde, disculpa.',
      readByClient: true,
      readByBarber: true,
      createdAt: stamp(0),
    }),
    createMessageModel({
      id: 'msg_002',
      appointmentId: target.id,
      ...partes,
      senderId: target.barberId,
      senderRole: ROLES.BARBERO,
      text: 'Sin problema, te espero. Nos vemos.',
      readByClient: false,
      readByBarber: true,
      createdAt: stamp(12),
    }),
  ]
}

/* ================================================================== */
/*  Ensamblado final                                                   */
/* ================================================================== */

/**
 * Construye el conjunto completo de datos semilla.
 * Lo consume el almacen del modo mock la primera vez que arranca la app
 * (o cuando el usuario pulsa "Reiniciar datos demo").
 */
export function buildSeedData() {
  const business = buildBusiness()
  const gallery = buildGallery()
  const users = buildUsers()
  const services = buildServices()
  const barberServices = buildBarberServices()
  const courses = buildCourses()
  const enrollments = buildEnrollments(courses) // ajusta enrolledCount de cada curso
  const blocks = buildBlocks()
  const appointments = buildAppointments({ services, barberServices, courses, blocks, business })
  const messages = buildMessages(appointments)

  return {
    // Sello de version: el almacen lo usa para detectar datos caducados
    __seedVersion: SEED_VERSION,
    business,
    gallery,
    users,
    passwords: buildPasswords(users),
    services,
    barberServices,
    appointments,
    messages,
    blocks,
    courses,
    enrollments,
  }
}

export default buildSeedData
