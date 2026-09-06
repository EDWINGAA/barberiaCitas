import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  MapPin,
  Phone,
} from 'lucide-react'

import { GALLERY_LOCATIONS, PUBLIC_COURSE_STATUS, ROLES } from '@/constants'
import { cn, formatPhone } from '@/utils/format'
import { formatDuration, formatRelativeDay, formatTime12 } from '@/utils/date'
import { getOpenStatus } from '@/utils/schedule'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useParallax } from '@/hooks/useScrollReveal'
import { useAuth } from '@/context/AuthContext'
import { useBusiness } from '@/context/BusinessContext'
import { Avatar, Button, SkeletonCourseGrid, Skeleton } from '@/components/ui'
import { CourseCard } from '@/components/courses/CourseCard'
import { GalleryCarousel } from '@/components/gallery/GalleryCarousel'
import {
  CountUp,
  GrainOverlay,
  Marquee,
  Reveal,
  RevealWords,
  SectionIndex,
} from '@/components/shared/Motion'

/**
 * Portada publica.
 *
 * El diseno es deliberadamente editorial en lugar de la clasica sucesion
 * de tarjetas centradas: rejilla asimetrica, filetes en vez de cajas,
 * tipografia mezclada (condensada + serif italica), cinta en movimiento,
 * parallax suave y aparicion progresiva al bajar. Todo respeta la
 * preferencia del sistema de reducir animaciones.
 */
export default function Landing() {
  const { business } = useBusiness()
  const { isAuthenticated, user } = useAuth()

  const loader = useCallback(async () => {
    // Una sola llamada trae las tres galerias; se reparten mas abajo
    const [serviceList, barbers, courses, gallery] = await Promise.all([
      services.services.list({ activeOnly: true }),
      services.users.listBarbers({ activeOnly: true }),
      services.courses.list({ publicOnly: true }),
      services.gallery.list({ activeOnly: true }),
    ])
    return { services: serviceList, barbers, courses, gallery }
  }, [])

  // initialData evita que la portada se rompa si una carga falla:
  // simplemente se muestran las secciones vacias.
  const { data, loading } = useAsync(loader, [], {
    initialData: { services: [], barbers: [], courses: [], gallery: [] },
  })

  /** Fotos del carrusel de la portada */
  const fotosCarrusel = useMemo(
    () => (data?.gallery || []).filter((f) => f.location === GALLERY_LOCATIONS.INICIO),
    [data]
  )

  /**
   * Fotos del hero. Si el administrador aun no ha puesto ninguna en esa
   * galeria, se cae con elegancia a las del carrusel para que la portada
   * nunca aparezca con huecos.
   */
  const fotosHero = useMemo(() => {
    const propias = (data?.gallery || []).filter((f) => f.location === GALLERY_LOCATIONS.HERO)
    return propias.length ? propias : fotosCarrusel
  }, [data, fotosCarrusel])

  const featuredCourses = useMemo(
    () => (data?.courses || []).filter((c) => PUBLIC_COURSE_STATUS.includes(c.status)).slice(0, 3),
    [data]
  )

  const barberById = useMemo(
    () => Object.fromEntries((data?.barbers || []).map((b) => [b.uid, b])),
    [data]
  )

  // A donde lleva el boton principal segun quien mire la pagina
  const bookingLink = !isAuthenticated
    ? '/registro'
    : user?.role === ROLES.CLIENTE
      ? '/cliente/agendar'
      : '/cliente'

  return (
    <>
      {/* Grano sobre toda la pagina: quita el aspecto de plantilla plana */}
      <GrainOverlay />

      <Hero
        business={business}
        fotos={fotosHero}
        bookingLink={bookingLink}
        loading={loading}
      />

      <TiraDeTexto />

      <Carta
        servicios={data.services}
        fotos={fotosCarrusel}
        loading={loading}
        bookingLink={bookingLink}
      />

      {/* Galeria de trabajos (carrusel administrable desde el panel) */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <SectionIndex number="02" label="El trabajo" className="mb-10" />
        <GalleryCarousel
          items={fotosCarrusel}
          loading={loading}
          title="Lo ultimo que ha salido de la silla"
          description="Cortes reales de clientes reales. Pulsa una foto para verla en grande."
          emptyTitle="Estamos preparando la galeria"
          emptyDescription="Muy pronto veras aqui nuestros ultimos trabajos."
        />
      </section>

      <Equipo barberos={data.barbers} loading={loading} />

      <Cifras data={data} loading={loading} />

      <Escuela cursos={featuredCourses} barberById={barberById} loading={loading} />

      <Cierre business={business} bookingLink={bookingLink} isAuthenticated={isAuthenticated} />
    </>
  )
}

/* ================================================================== */
/*  HERO                                                               */
/* ================================================================== */

function Hero({ business, fotos, bookingLink, loading }) {
  const isDesktop = useIsDesktop()
  // Dos velocidades distintas: las fotos se separan al bajar
  const parallaxLento = useParallax(isDesktop ? 0.1 : 0, 70)
  const parallaxRapido = useParallax(isDesktop ? -0.06 : 0, 50)

  const estado = getOpenStatus(business.openingHours)

  return (
    <section className="relative overflow-hidden border-b border-ink-800">
      {/* Rejilla de puntos, muy tenue, solo como textura de fondo */}
      <div className="bg-grid absolute inset-0 opacity-30" aria-hidden="true" />

      {/* Filete vertical con el nombre, al estilo de un rotulo de calle */}
      <div
        className="pointer-events-none absolute left-6 top-0 hidden h-full items-center xl:flex"
        aria-hidden="true"
      >
        <span
          className="whitespace-nowrap text-[11px] uppercase tracking-[0.45em] text-ink-600"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {business.name} — CDMX — Est. 1998
        </span>
      </div>

      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 lg:pb-24 lg:pt-20 xl:pl-24">
        {/* Rejilla asimetrica 7/5, no dos mitades iguales */}
        <div className="grid items-end gap-12 lg:grid-cols-12 lg:gap-10">
          {/* ---------------- Columna de texto ---------------- */}
          <div className="lg:col-span-7">
            <Reveal from="none">
              <EstadoLocal estado={estado} />
            </Reveal>

            <h1 className="mt-8 leading-[0.82]">
              <span className="block font-display text-[clamp(3.2rem,11vw,7.5rem)] tracking-tight text-ink-50">
                <RevealWords text="Navaja, tijera" />
              </span>
              <span className="mt-1 block font-serif text-[clamp(2.2rem,7.5vw,5rem)] italic text-gradient-gold">
                <RevealWords text="y buen gusto" delay={220} />
              </span>
            </h1>

            <Reveal delay={420} className="mt-8 max-w-lg">
              <p className="text-base leading-relaxed text-ink-400 sm:text-lg">
                {business.description}
              </p>
            </Reveal>

            <Reveal delay={520} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button to={bookingLink} size="lg" icon={CalendarCheck}>
                Agendar mi cita
              </Button>
              <Button to="/servicios" size="lg" variant="outline" iconRight={ArrowUpRight}>
                Ver el trabajo
              </Button>
            </Reveal>

            {/* Datos concretos separados por filetes, no por tarjetas */}
            <Reveal delay={620} className="mt-12 border-t border-ink-800 pt-6">
              <dl className="flex flex-wrap gap-x-10 gap-y-5">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.28em] text-ink-600">Donde</dt>
                  <dd className="mt-1.5 flex items-center gap-2 text-sm text-ink-300">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
                    Insurgentes Sur 1425
                  </dd>
                </div>
                {business.phone && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.28em] text-ink-600">Reservas</dt>
                    <dd className="mt-1.5">
                      <a
                        href={`tel:${business.phone}`}
                        className="flex items-center gap-2 text-sm text-ink-300 transition hover:text-gold-400"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
                        {formatPhone(business.phone)}
                      </a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.28em] text-ink-600">Desde</dt>
                  <dd className="mt-1.5 font-display text-lg tracking-wider text-gold-400">1998</dd>
                </div>
              </dl>
            </Reveal>
          </div>

          {/* ---------------- Pila de fotos ---------------- */}
          <div className="relative lg:col-span-5">
            <Reveal from="right" delay={300}>
              <div className="relative mx-auto max-w-sm lg:max-w-none">
                {/* Foto principal, ligeramente girada */}
                <div
                  className="relative aspect-[3/4] overflow-hidden border border-ink-700 bg-ink-850"
                  style={{
                    transform: `translateY(${parallaxLento}px) rotate(1.4deg)`,
                    transition: 'transform .1s linear',
                  }}
                >
                  {loading ? (
                    <Skeleton className="h-full w-full rounded-none" />
                  ) : fotos[0] ? (
                    <img
                      src={fotos[0].imageURL}
                      alt={fotos[0].title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-ink-750 to-gold-900/30" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
                </div>

                {/* Segunda foto, desplazada y girada al contrario */}
                <div
                  className="absolute -bottom-10 -left-4 hidden aspect-square w-40 overflow-hidden border border-ink-700 bg-ink-850 shadow-panel sm:block lg:-left-12 lg:w-48"
                  style={{
                    transform: `translateY(${parallaxRapido}px) rotate(-3.5deg)`,
                    transition: 'transform .1s linear',
                  }}
                >
                  {fotos[1] ? (
                    <img
                      src={fotos[1].imageURL}
                      alt={fotos[1].title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-gold-900/40 to-ink-800" />
                  )}
                </div>

                {/* Sello girado, como una pegatina pegada encima */}
                <div
                  className="absolute -right-3 -top-5 flex h-24 w-24 rotate-12 flex-col items-center justify-center rounded-full border border-gold-500/50 bg-ink-950/90 text-center backdrop-blur lg:-right-6 lg:h-28 lg:w-28"
                  aria-hidden="true"
                >
                  <span className="font-display text-2xl leading-none text-gold-400 lg:text-3xl">
                    28
                  </span>
                  <span className="mt-1 px-2 text-[9px] uppercase leading-tight tracking-[0.16em] text-ink-400">
                    anos de oficio
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Invitacion a bajar */}
        <div className="mt-16 hidden justify-center lg:flex">
          <span className="flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-ink-600">
            Sigue bajando
            <ArrowDown className="h-4 w-4 animate-nudge-down text-gold-500/70" />
          </span>
        </div>
      </div>
    </section>
  )
}

/** Pastilla que dice si la barberia esta abierta en este momento */
function EstadoLocal({ estado }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <span
        className={cn(
          'inline-flex items-center gap-2.5 border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em]',
          estado.open
            ? 'border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-300'
            : 'border-ink-700 bg-ink-900 text-ink-400'
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            estado.open ? 'animate-soft-pulse bg-emerald-400' : 'bg-ink-500'
          )}
        />
        {estado.open ? `Abierto hasta las ${formatTime12(estado.closesAt)}` : 'Cerrado ahora'}
      </span>

      {!estado.open && estado.opensAt && (
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-600">
          Abre {formatRelativeDay(estado.opensDay).toLowerCase()} a las{' '}
          {formatTime12(estado.opensAt)}
        </span>
      )}
    </div>
  )
}

/* ================================================================== */
/*  CINTA DE TEXTO                                                     */
/* ================================================================== */

function TiraDeTexto() {
  return (
    <div className="border-y border-ink-800 bg-ink-900/40 py-5">
      <Marquee
        items={[
          'Corte clasico',
          'Afeitado a navaja',
          'Skin fade',
          'Barba a medida',
          'Color sin miedo',
          'Escuela de barberia',
        ]}
        duration={38}
      />
    </div>
  )
}

/* ================================================================== */
/*  01 — LA CARTA                                                      */
/* ================================================================== */

/**
 * Lista de precios con aire de carta de restaurante: filas separadas por
 * filetes y puntos que unen el nombre con el precio. En escritorio, al
 * pasar por una fila aparece una foto que sigue al cursor.
 */
function Carta({ servicios, fotos, loading, bookingLink }) {
  const isDesktop = useIsDesktop()
  const [hover, setHover] = useState(null) // { index, x, y }

  const fotoPreview = hover !== null && fotos.length ? fotos[hover.index % fotos.length] : null

  return (
    <section className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
      <SectionIndex number="01" label="La carta" />

      {/* Cabecera descentrada: titulo a la izquierda, nota a la derecha */}
      <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
        <h2 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.9] tracking-tight text-ink-50 lg:col-span-7">
          Esto es lo
          <span className="block font-serif text-[clamp(1.7rem,4vw,3rem)] italic text-gold-400">
            que hacemos
          </span>
        </h2>

        <p className="text-sm leading-relaxed text-ink-400 lg:col-span-4 lg:col-start-9">
          El tiempo que ves es el que ocupas la silla, ni mas ni menos. Cada barbero tiene su
          tarifa: la veras al reservar, cuando ya hayas elegido con quien.
        </p>
      </div>

      {/* Filas de servicios */}
      <div
        className="mt-14 border-t border-ink-800"
        onMouseLeave={() => setHover(null)}
      >
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border-b border-ink-800 py-7">
                <Skeleton className="h-8 w-2/3" />
              </div>
            ))
          : servicios.map((servicio, index) => (
              <Reveal key={servicio.id} delay={index * 60}>
                <Link
                  to={bookingLink}
                  onMouseMove={(e) =>
                    isDesktop && setHover({ index, x: e.clientX, y: e.clientY })
                  }
                  onMouseEnter={(e) =>
                    isDesktop && setHover({ index, x: e.clientX, y: e.clientY })
                  }
                  className="group relative flex items-baseline gap-4 border-b border-ink-800 py-6 transition-colors duration-500 hover:bg-gold-500/[0.03] sm:gap-6 sm:py-7"
                >
                  {/* Numero de linea */}
                  <span className="w-7 shrink-0 pt-1 font-display text-xs tracking-widest text-ink-600 transition-colors duration-300 group-hover:text-gold-500">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="font-display text-2xl tracking-wide text-ink-100 transition-all duration-500 group-hover:translate-x-1.5 group-hover:text-gold-300 sm:text-3xl">
                        {servicio.name}
                      </span>

                      {/* Puntos que unen el nombre con la duracion */}
                      <span
                        className="hidden h-px flex-1 self-center sm:block"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle, rgb(58 58 68) 1px, transparent 1px)',
                          backgroundSize: '7px 1px',
                          backgroundRepeat: 'repeat-x',
                        }}
                        aria-hidden="true"
                      />

                      <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-ink-500">
                        {formatDuration(servicio.duration)}
                      </span>
                    </span>

                    {/* En movil la descripcion siempre visible; en escritorio se despliega */}
                    <span className="mt-2 block max-w-xl text-sm leading-relaxed text-ink-500 sm:mt-0 sm:max-h-0 sm:overflow-hidden sm:opacity-0 sm:transition-all sm:duration-500 sm:group-hover:mt-2.5 sm:group-hover:max-h-20 sm:group-hover:opacity-100">
                      {servicio.description}
                    </span>
                  </span>

                  {/* Sin precio: cada barbero fija el suyo y el cliente lo
                      ve al reservar, ya con barbero elegido. */}
                  <span className="shrink-0 text-ink-600 transition-all duration-500 group-hover:translate-x-1 group-hover:text-gold-400">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </Link>
              </Reveal>
            ))}
      </div>

      <Reveal className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-md text-xs leading-relaxed text-ink-500">
          El precio depende del barbero con el que te cortes. Lo ves al reservar, antes de
          confirmar. Pago en el local, en efectivo o con tarjeta.
        </p>
        <Button to={bookingLink} variant="ghost" iconRight={ArrowRight}>
          Elegir servicio y agendar
        </Button>
      </Reveal>

      {/* Foto que sigue al cursor sobre la carta */}
      {isDesktop && fotoPreview && (
        <div
          className="pointer-events-none fixed z-50 hidden h-32 w-24 overflow-hidden border border-gold-500/30 shadow-panel lg:block"
          style={{
            left: hover.x + 22,
            top: hover.y - 64,
            transform: 'rotate(3deg)',
          }}
          aria-hidden="true"
        >
          <img src={fotoPreview.imageURL} alt="" className="h-full w-full object-cover" />
        </div>
      )}
    </section>
  )
}

/* ================================================================== */
/*  03 — EL EQUIPO                                                     */
/* ================================================================== */

/**
 * Retratos escalonados en vertical, con un numero enorme de fondo.
 * Es lo contrario a tres tarjetas identicas alineadas.
 */
function Equipo({ barberos, loading }) {
  return (
    <section className="border-y border-ink-800 bg-ink-900/30">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <SectionIndex number="03" label="El equipo" />

        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
          <h2 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.9] tracking-tight text-ink-50 lg:col-span-6">
            Manos que
            <span className="block font-serif text-[clamp(1.7rem,4vw,3rem)] italic text-gold-400">
              conocen el oficio
            </span>
          </h2>
          <p className="text-sm leading-relaxed text-ink-400 lg:col-span-4 lg:col-start-9">
            Cada uno tiene su estilo y su especialidad. Al agendar eliges con quien te sientas: no
            te toca quien caiga.
          </p>
        </div>

        <div className="mt-16 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full rounded-none" />
              ))
            : barberos.map((barbero, index) => (
                <Reveal
                  key={barbero.uid}
                  delay={index * 120}
                  // El del medio baja; el tercero sube. Rompe la linea recta.
                  className={cn(
                    index === 1 && 'lg:translate-y-14',
                    index === 2 && 'lg:-translate-y-6'
                  )}
                >
                  <article className="group relative">
                    {/* Numero fantasma detras del retrato */}
                    <span
                      className="pointer-events-none absolute -left-3 -top-9 font-display text-8xl leading-none text-ink-800/70 transition-colors duration-500 group-hover:text-gold-900/60"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <div className="relative aspect-[3/4] overflow-hidden border border-ink-700 bg-ink-850">
                      {barbero.photoURL ? (
                        <img
                          src={barbero.photoURL}
                          alt={barbero.name}
                          loading="lazy"
                          className="h-full w-full object-cover grayscale transition-all duration-[900ms] ease-out group-hover:scale-105 group-hover:grayscale-0"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-750 to-gold-900/30">
                          <Avatar name={barbero.name} size="2xl" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/20 to-transparent" />

                      {/* Filete dorado que crece al pasar el raton */}
                      <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-gold-500 transition-all duration-700 ease-out group-hover:w-full" />
                    </div>

                    <div className="relative -mt-10 px-4">
                      <h3 className="font-display text-3xl tracking-wide text-ink-50">
                        {barbero.name}
                      </h3>
                      {barbero.specialties?.length > 0 && (
                        <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-gold-500/90">
                          {barbero.specialties.slice(0, 2).join(' · ')}
                        </p>
                      )}
                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-400">
                        {barbero.bio}
                      </p>
                    </div>
                  </article>
                </Reveal>
              ))}
        </div>

        <Reveal className="mt-20 lg:mt-28">
          <Link
            to="/barberos"
            className="group inline-flex items-center gap-3 border-b border-ink-700 pb-2 text-sm uppercase tracking-[0.2em] text-ink-300 transition-colors hover:border-gold-500 hover:text-gold-400"
          >
            Conocer al equipo completo
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  CIFRAS                                                             */
/* ================================================================== */

/** Banda de numeros que cuentan al entrar en pantalla, con una cita al lado */
function Cifras({ data, loading }) {
  const cifras = [
    { valor: data.barbers.length, etiqueta: 'Barberos en la silla' },
    { valor: data.services.length, etiqueta: 'Servicios en carta' },
    { valor: data.courses.length, etiqueta: 'Cursos en la escuela' },
  ]

  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
      <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
        {/* Cita, alineada a la izquierda y en serif */}
        <Reveal from="left" className="lg:col-span-5">
          <p className="font-serif text-2xl italic leading-snug text-ink-200 sm:text-3xl">
            &ldquo;Un buen corte no se nota.
            <span className="text-gold-400"> Se nota la persona.</span>&rdquo;
          </p>
          <p className="mt-5 text-[11px] uppercase tracking-[0.28em] text-ink-600">
            Aurelio Mendoza — fundador
          </p>
        </Reveal>

        {/* Numeros separados por filetes verticales */}
        <div className="grid grid-cols-3 gap-px overflow-hidden bg-ink-800 lg:col-span-6 lg:col-start-7">
          {cifras.map((cifra, i) => (
            <Reveal key={cifra.etiqueta} delay={i * 110} className="bg-ink-950 px-4 py-8 text-center">
              <p className="font-display text-5xl leading-none text-gradient-gold sm:text-6xl">
                {loading ? '—' : <CountUp value={cifra.valor} />}
              </p>
              <p className="mt-3 text-[10px] uppercase leading-tight tracking-[0.2em] text-ink-500">
                {cifra.etiqueta}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  04 — LA ESCUELA                                                    */
/* ================================================================== */

function Escuela({ cursos, barberById, loading }) {
  return (
    <section className="border-t border-ink-800 bg-ink-900/30">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <SectionIndex number="04" label="La escuela" />

        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
          <h2 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.9] tracking-tight text-ink-50 lg:col-span-6">
            Pasa al otro
            <span className="block font-serif text-[clamp(1.7rem,4vw,3rem)] italic text-gold-400">
              lado de la silla
            </span>
          </h2>
          <p className="text-sm leading-relaxed text-ink-400 lg:col-span-4 lg:col-start-9">
            Grupos pequenos, practica sobre modelo real y profesores que siguen cortando cada dia.
            Nada de teoria suelta.
          </p>
        </div>

        <div className="mt-14">
          {loading ? (
            <SkeletonCourseGrid count={3} />
          ) : cursos.length === 0 ? (
            <p className="border-y border-ink-800 py-12 text-center text-ink-500">
              Estamos cerrando las fechas de la proxima generacion. Vuelve en unos dias.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cursos.map((curso, index) => (
                <Reveal key={curso.id} delay={index * 110}>
                  <CourseCard course={curso} instructor={barberById[curso.instructorId]} />
                </Reveal>
              ))}
            </div>
          )}
        </div>

        <Reveal className="mt-12">
          <Link
            to="/cursos"
            className="group inline-flex items-center gap-3 border-b border-ink-700 pb-2 text-sm uppercase tracking-[0.2em] text-ink-300 transition-colors hover:border-gold-500 hover:text-gold-400"
          >
            Ver el catalogo completo
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  CIERRE                                                             */
/* ================================================================== */

function Cierre({ business, bookingLink, isAuthenticated }) {
  return (
    <section className="relative overflow-hidden border-t border-ink-800">
      <div className="bg-grid absolute inset-0 opacity-25" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-8">
            <h2 className="font-display text-[clamp(3rem,10vw,7rem)] leading-[0.85] tracking-tight text-ink-50">
              Tu silla
              <span className="block font-serif text-[clamp(2rem,6vw,4.5rem)] italic text-gradient-gold">
                te esta esperando
              </span>
            </h2>
          </Reveal>

          <Reveal delay={200} className="lg:col-span-4 lg:pb-4">
            <p className="text-base leading-relaxed text-ink-400">
              Reserva en menos de un minuto, elige tu barbero y olvidate de las esperas.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Button to={bookingLink} size="lg" icon={CalendarCheck} fullWidth>
                Reservar ahora
              </Button>
              {business.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="flex items-center justify-center gap-2 border border-ink-700 py-3 text-sm text-ink-300 transition hover:border-gold-500/50 hover:text-gold-400"
                >
                  <Phone className="h-4 w-4" />
                  O llamanos: {formatPhone(business.phone)}
                </a>
              )}
            </div>

            {!isAuthenticated && (
              <p className="mt-5 text-center text-xs text-ink-600">
                Ya tienes cuenta?{' '}
                <Link to="/login" className="text-gold-500 transition hover:text-gold-400">
                  Inicia sesion
                </Link>
              </p>
            )}
          </Reveal>
        </div>
      </div>

      {/* Cinta final, en sentido contrario a la de arriba */}
      <div className="border-t border-ink-800 py-5">
        <Marquee
          items={[`${business.name}`, 'Insurgentes Sur 1425', 'CDMX', 'Est. 1998']}
          duration={44}
          reverse
          separator="—"
        />
      </div>
    </section>
  )
}
