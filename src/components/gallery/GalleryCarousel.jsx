import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Images, Maximize2, Pause, Play, X } from 'lucide-react'

import { CAROUSEL_AUTOPLAY_MS } from '@/constants'
import { cn } from '@/utils/format'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { EmptyState, Skeleton } from '@/components/ui'

/**
 * Carrusel de fotos de trabajos.
 *
 * Se mueve solo, se pausa al pasar el raton por encima, se puede
 * arrastrar con el dedo en movil y al pulsar una foto se abre a pantalla
 * completa. Muestra 1, 2 o 3 tarjetas segun el ancho de la pantalla.
 */
export function GalleryCarousel({
  items = [],
  loading = false,
  eyebrow,
  title,
  description,
  emptyTitle = 'Todavia no hay fotos publicadas',
  emptyDescription = 'Muy pronto subiremos nuestros ultimos trabajos.',
  className = '',
}) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isTablet = useMediaQuery('(min-width: 640px)')
  const perPage = isDesktop ? 3 : isTablet ? 2 : 1

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [lightbox, setLightbox] = useState(null) // indice de la foto ampliada
  const touchStartX = useRef(null)

  // El usuario puede haber pedido al sistema que reduzca las animaciones
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const maxIndex = Math.max(0, items.length - perPage)
  const canSlide = items.length > perPage

  /* ---------------- Navegacion ---------------- */

  const goTo = useCallback(
    (next) => {
      if (maxIndex === 0) {
        setIndex(0)
        return
      }
      // Circular: al pasarse por un extremo se salta al otro
      if (next > maxIndex) setIndex(0)
      else if (next < 0) setIndex(maxIndex)
      else setIndex(next)
    },
    [maxIndex]
  )

  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const prev = useCallback(() => goTo(index - 1), [goTo, index])

  // Al cambiar el numero de tarjetas visibles hay que recolocar el indice
  useEffect(() => {
    setIndex((current) => Math.min(current, maxIndex))
  }, [maxIndex])

  /* ---------------- Avance automatico ---------------- */

  useEffect(() => {
    if (!canSlide || paused || reducedMotion || lightbox !== null) return undefined
    const timer = setTimeout(next, CAROUSEL_AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [canSlide, paused, reducedMotion, lightbox, next, index])

  /* ---------------- Arrastre con el dedo ---------------- */

  function onTouchStart(event) {
    touchStartX.current = event.touches[0].clientX
  }

  function onTouchEnd(event) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - event.changedTouches[0].clientX
    if (Math.abs(delta) > 50) {
      if (delta > 0) next()
      else prev()
    }
    touchStartX.current = null
  }

  /* ---------------- Estados sin contenido ---------------- */

  if (loading) {
    return (
      <section className={className}>
        <GalleryHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
          ))}
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className={className}>
        <GalleryHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-10">
          <EmptyState icon={Images} title={emptyTitle} description={emptyDescription} />
        </div>
      </section>
    )
  }

  return (
    <section className={className}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <GalleryHeading eyebrow={eyebrow} title={title} description={description} />

        {/* Controles de escritorio */}
        {canSlide && (
          <div className="hidden items-center gap-2 sm:flex">
            <CarouselButton label="Foto anterior" onClick={prev} icon={ChevronLeft} />
            <CarouselButton
              label={paused ? 'Reanudar' : 'Pausar'}
              onClick={() => setPaused((p) => !p)}
              icon={paused ? Play : Pause}
            />
            <CarouselButton label="Foto siguiente" onClick={next} icon={ChevronRight} />
          </div>
        )}
      </div>

      {/* ---------- Carrusel ---------- */}
      <div
        className="relative mt-10"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div
          className="overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="region"
          aria-roledescription="carrusel"
          aria-label={title || 'Galeria de trabajos'}
        >
          <div
            className={cn(
              'flex',
              reducedMotion ? '' : 'transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]'
            )}
            style={{ transform: `translateX(-${index * (100 / perPage)}%)` }}
          >
            {items.map((item, i) => (
              <div
                key={item.id}
                className="shrink-0 px-2.5 first:pl-0 last:pr-0"
                style={{ flexBasis: `${100 / perPage}%` }}
                aria-hidden={i < index || i >= index + perPage}
              >
                <GalleryCard
                  item={item}
                  position={i + 1}
                  onOpen={() => setLightbox(i)}
                  visible={i >= index && i < index + perPage}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Flechas flotantes en movil */}
        {canSlide && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Foto anterior"
              className="absolute left-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink-600 bg-ink-950/80 text-ink-100 backdrop-blur transition hover:border-gold-500 hover:text-gold-400 sm:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Foto siguiente"
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink-600 bg-ink-950/80 text-ink-100 backdrop-blur transition hover:border-gold-500 hover:text-gold-400 sm:hidden"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* ---------- Barra de avance y puntos ---------- */}
      {canSlide && (
        <div className="mt-7 space-y-4">
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              // La clave fuerza a reiniciar la animacion en cada foto
              key={`${index}-${paused}-${reducedMotion}`}
              className={cn(
                'h-full origin-left rounded-full bg-gradient-to-r from-gold-600 to-gold-400',
                paused || reducedMotion ? 'scale-x-100' : 'animate-progress'
              )}
              style={
                paused || reducedMotion
                  ? undefined
                  : { animationDuration: `${CAROUSEL_AUTOPLAY_MS}ms` }
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {Array.from({ length: maxIndex + 1 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir a la posicion ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index ? 'w-8 bg-gold-500' : 'w-1.5 bg-ink-600 hover:bg-ink-500'
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---------- Visor a pantalla completa ---------- */}
      <Lightbox
        items={items}
        index={lightbox}
        onClose={() => setLightbox(null)}
        onIndexChange={setLightbox}
      />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Encabezado de la seccion                                           */
/* ------------------------------------------------------------------ */

function GalleryHeading({ eyebrow, title, description }) {
  if (!eyebrow && !title && !description) return null
  return (
    <div className="max-w-2xl">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-500">{eyebrow}</p>
      )}
      {title && (
        <h2 className="mt-2 font-display text-4xl tracking-wide text-ink-50">{title}</h2>
      )}
      {description && <p className="mt-3 leading-relaxed text-ink-400">{description}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tarjeta de foto                                                    */
/* ------------------------------------------------------------------ */

function GalleryCard({ item, position, onOpen, visible }) {
  const [failed, setFailed] = useState(false)

  return (
    <button
      type="button"
      onClick={onOpen}
      tabIndex={visible ? 0 : -1}
      className={cn(
        'group relative block w-full overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900 text-left',
        'aspect-[4/5] transition-all duration-500 ease-out',
        'hover:-translate-y-1.5 hover:border-gold-500/50 hover:shadow-gold',
        visible && 'animate-rise-in'
      )}
      style={visible ? { animationDelay: `${(position % 3) * 90}ms` } : undefined}
      aria-label={`Ampliar foto: ${item.title}`}
    >
      {/* Imagen, con respaldo si no carga */}
      {item.imageURL && !failed ? (
        <img
          src={item.imageURL}
          alt={item.title}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-750 via-ink-800 to-gold-900/40">
          <span className="font-display text-6xl tracking-wider text-gold-500/40">
            {item.title.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}

      {/* Velo oscuro que hace legible el texto y se aclara al pasar el raton */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/45 to-transparent transition-opacity duration-500 group-hover:opacity-85" />

      {/* Numero de la foto */}
      <span className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950/70 font-display text-sm text-gold-400 backdrop-blur transition-transform duration-500 group-hover:scale-110">
        {String(position).padStart(2, '0')}
      </span>

      {/* Icono de ampliar, aparece al pasar el raton */}
      <span className="absolute right-4 top-4 flex h-8 w-8 translate-y-2 items-center justify-center rounded-lg bg-gold-500 text-ink-950 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <Maximize2 className="h-4 w-4" />
      </span>

      {/* Texto inferior: el titulo sube y la descripcion se despliega */}
      <div className="absolute inset-x-0 bottom-0 p-5">
        <span className="block h-0.5 w-10 origin-left rounded-full bg-gold-500 transition-all duration-500 group-hover:w-16" />
        <h3 className="mt-3 font-semibold leading-tight text-ink-50 transition-transform duration-500 group-hover:-translate-y-0.5">
          {item.title}
        </h3>
        {item.description && (
          <p className="mt-1 max-h-0 overflow-hidden text-sm leading-snug text-ink-300 opacity-0 transition-all duration-500 group-hover:max-h-24 group-hover:opacity-100">
            {item.description}
          </p>
        )}
      </div>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Visor a pantalla completa                                          */
/* ------------------------------------------------------------------ */

function Lightbox({ items, index, onClose, onIndexChange }) {
  const abierto = index !== null && index >= 0 && index < items.length

  // Navegacion con teclado y bloqueo del scroll de fondo
  useEffect(() => {
    if (!abierto) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onIndexChange((index + 1) % items.length)
      if (event.key === 'ArrowLeft') onIndexChange((index - 1 + items.length) % items.length)
    }

    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = anterior
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [abierto, index, items.length, onClose, onIndexChange])

  if (!abierto) return null
  const item = items[index]

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col bg-ink-950/95 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-4 p-4 sm:p-6">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-50">{item.title}</p>
          <p className="text-xs text-ink-400">
            {index + 1} de {items.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink-700 text-ink-300 transition hover:border-gold-500 hover:text-gold-400"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Foto */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4 sm:px-16"
        onClick={onClose}
      >
        <img
          key={item.id}
          src={item.imageURL}
          alt={item.title}
          className="max-h-full max-w-full rounded-2xl object-contain shadow-panel animate-zoom-in"
          onClick={(e) => e.stopPropagation()}
        />

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onIndexChange((index - 1 + items.length) % items.length)
              }}
              aria-label="Foto anterior"
              className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full border border-ink-700 bg-ink-900/80 text-ink-200 backdrop-blur transition hover:border-gold-500 hover:text-gold-400 sm:left-4"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onIndexChange((index + 1) % items.length)
              }}
              aria-label="Foto siguiente"
              className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full border border-ink-700 bg-ink-900/80 text-ink-200 backdrop-blur transition hover:border-gold-500 hover:text-gold-400 sm:right-4"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Descripcion */}
      {item.description && (
        <div className="border-t border-ink-800 p-4 text-center sm:p-6">
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-ink-300">{item.description}</p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function CarouselButton({ label, onClick, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-600 text-ink-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-500 hover:text-gold-400 active:translate-y-0"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

export default GalleryCarousel
