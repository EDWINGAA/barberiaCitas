import { useEffect, useRef, useState } from 'react'

import { cn } from '@/utils/format'
import { useInView } from '@/hooks/useScrollReveal'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/* ================================================================== */
/*  Aparicion al hacer scroll                                          */
/* ================================================================== */

/**
 * Desplazamiento inicial de cada direccion.
 *
 * Las dos horizontales solo se aplican a partir de "sm": en un telefono
 * un desplazamiento lateral de 3rem deja el bloque fuera de la pantalla
 * mientras no ha entrado en escena, y la pagina se puede arrastrar de
 * lado. En movil entran desde abajo, que no ensancha nada.
 */
const DIRECTIONS = {
  up: 'translate-y-10',
  down: '-translate-y-10',
  left: 'translate-y-10 sm:translate-y-0 sm:translate-x-12',
  right: 'translate-y-10 sm:translate-y-0 sm:-translate-x-12',
  none: '',
}

/**
 * Envuelve contenido para que entre en escena al llegar a el.
 *
 * @param {string} from   direccion desde la que aparece
 * @param {number} delay  retardo en ms, para escalonar varios elementos
 */
export function Reveal({
  children,
  from = 'up',
  delay = 0,
  className = '',
  as: Tag = 'div',
  ...props
}) {
  const [ref, inView] = useInView()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')

  // Con animaciones reducidas se muestra directamente, sin transicion
  if (reduced) {
    return (
      <Tag className={className} {...props}>
        {children}
      </Tag>
    )
  }

  return (
    <Tag
      ref={ref}
      className={cn(
        'transition-all duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
        inView ? 'translate-x-0 translate-y-0 opacity-100 blur-0' : `opacity-0 blur-[2px] ${DIRECTIONS[from]}`,
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
      {...props}
    >
      {children}
    </Tag>
  )
}

/* ================================================================== */
/*  Titular que aparece palabra por palabra                            */
/* ================================================================== */

/**
 * Divide un texto en palabras y las levanta una tras otra.
 * Da al titular una entrada mucho mas viva que un simple fundido.
 */
export function RevealWords({ text, className = '', wordClassName = '', delay = 0, stagger = 70 }) {
  const [ref, inView] = useInView({ threshold: 0.3 })
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const words = String(text).split(' ')

  return (
    <span ref={ref} className={cn('inline-block', className)}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
          <span
            className={cn(
              'inline-block',
              !reduced && 'transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)]',
              !reduced && !inView && 'translate-y-full',
              wordClassName
            )}
            style={reduced ? undefined : { transitionDelay: `${delay + i * stagger}ms` }}
          >
            {word}
          </span>
          {i < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </span>
  )
}

/* ================================================================== */
/*  Cinta de texto en movimiento continuo                              */
/* ================================================================== */

/**
 * Tira horizontal que corre sin fin, como los rotulos de una barberia.
 * El contenido se duplica para que el bucle no tenga costura.
 *
 * @param {string[]} items     textos a repetir
 * @param {number}   duration  segundos que tarda en dar una vuelta
 */
export function Marquee({
  items = [],
  duration = 34,
  reverse = false,
  className = '',
  separator = '✦',
}) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  // Se pinta dos veces la misma secuencia: al llegar al -50% reinicia
  const secuencia = [...items, ...items]

  return (
    <div
      className={cn('group relative flex overflow-hidden', className)}
      role="presentation"
      aria-hidden="true"
    >
      <div
        className={cn(
          'flex w-max shrink-0 items-center',
          !reduced && 'animate-marquee group-hover:[animation-play-state:paused]'
        )}
        style={
          reduced
            ? undefined
            : { animationDuration: `${duration}s`, animationDirection: reverse ? 'reverse' : 'normal' }
        }
      >
        {secuencia.map((item, i) => (
          <span key={i} className="flex items-center whitespace-nowrap">
            <span className="px-6 font-display text-2xl tracking-[0.18em] text-ink-400 transition-colors duration-500 sm:px-8 sm:text-3xl">
              {item}
            </span>
            <span className="text-sm text-gold-500/70">{separator}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Numero que cuenta hacia arriba                                     */
/* ================================================================== */

/**
 * Cuenta de 0 al valor indicado cuando el bloque entra en pantalla.
 * Usa requestAnimationFrame y una curva de desaceleracion.
 */
export function CountUp({ value = 0, duration = 1400, suffix = '', prefix = '', className = '' }) {
  const [ref, inView] = useInView({ threshold: 0.4 })
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [shown, setShown] = useState(0)
  const frame = useRef(null)

  useEffect(() => {
    if (!inView) return undefined
    const target = Number(value) || 0

    if (reduced || target === 0) {
      setShown(target)
      return undefined
    }

    // Reloj propio: algunos entornos llaman al callback sin marca de
    // tiempo, y con "undefined" el calculo se iria a NaN.
    const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const start = ahora()

    function step(marca) {
      const t = Math.min(1, Math.max(0, ((marca ?? ahora()) - start) / duration))
      // easeOutExpo: arranca rapido y frena al final
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setShown(Math.round(target * eased))
      if (t < 1) frame.current = requestAnimationFrame(step)
      else setShown(target) // remate exacto, sin quedarse a uno de distancia
    }

    frame.current = requestAnimationFrame(step)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [inView, value, duration, reduced])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {shown}
      {suffix}
    </span>
  )
}

/* ================================================================== */
/*  Textura de grano                                                   */
/* ================================================================== */

/**
 * Velo de ruido muy tenue sobre toda la pagina.
 *
 * Es el detalle que mas separa una pantalla "de plantilla" de una
 * impresa: rompe los degradados planos y da sensacion de papel.
 */
export function GrainOverlay({ opacity = 0.04 }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] mix-blend-overlay"
      style={{
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat',
      }}
    />
  )
}

/* ================================================================== */
/*  Etiqueta de seccion estilo revista                                 */
/* ================================================================== */

/**
 * Rotulo numerado con filete, del tipo "01 — LA CARTA".
 * Sustituye a los tipicos titulos centrados y ordena la lectura.
 */
export function SectionIndex({ number, label, className = '', align = 'left' }) {
  const [ref, inView] = useInView()

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-4',
        align === 'right' && 'flex-row-reverse text-right',
        className
      )}
    >
      <span className="font-display text-sm tracking-[0.3em] text-gold-500">{number}</span>
      <span
        className={cn(
          'h-px flex-1 origin-left bg-gradient-to-r from-gold-600/70 to-transparent transition-transform duration-1000 ease-out',
          align === 'right' && 'origin-right bg-gradient-to-l',
          inView ? 'scale-x-100' : 'scale-x-0'
        )}
      />
      <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-ink-400">
        {label}
      </span>
    </div>
  )
}
