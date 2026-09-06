import { useEffect, useRef, useState } from 'react'

/**
 * Detecta cuando un elemento entra en pantalla al hacer scroll.
 *
 * Es la base de las animaciones de aparicion de la portada. Si el
 * navegador no tiene IntersectionObserver (o estamos en un entorno de
 * pruebas sin DOM completo), el contenido se marca como visible de
 * inmediato: la pagina nunca se queda en blanco por culpa del efecto.
 *
 * @param {{threshold?:number, rootMargin?:string, once?:boolean}} options
 * @returns {[React.RefObject, boolean]} referencia a colocar y si es visible
 */
export function useInView({ threshold = 0.15, rootMargin = '0px 0px -12% 0px', once = true } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    // Respaldo: sin soporte, se muestra todo sin animar
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return [ref, inView]
}

/**
 * Posicion vertical del scroll, actualizada con requestAnimationFrame
 * para no disparar un render por cada pixel.
 */
export function useScrollY() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    let frame = null
    function onScroll() {
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        setScrollY(window.scrollY || 0)
        frame = null
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return scrollY
}

/**
 * Desplazamiento de parallax de un elemento respecto al scroll.
 *
 * @param {number} speed  cuanto se mueve; negativo sube, positivo baja
 * @param {number} max    limite en pixeles, para que nunca se descoloque
 */
export function useParallax(speed = 0.15, max = 120) {
  const scrollY = useScrollY()
  const offset = Math.max(-max, Math.min(max, scrollY * speed))
  return offset
}

export default useInView
