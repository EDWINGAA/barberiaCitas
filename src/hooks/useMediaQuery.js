import { useEffect, useState } from 'react'

/**
 * Suscribe el componente a una media query CSS.
 * Se usa para decidir si el sidebar va fijo o como menu hamburguesa.
 */
export function useMediaQuery(queryString) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(queryString).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(queryString)
    const handler = (event) => setMatches(event.matches)

    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [queryString])

  return matches
}

/** Atajo: true en escritorio (>= 1024px, el breakpoint lg de Tailwind) */
export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)')
}

export default useMediaQuery
