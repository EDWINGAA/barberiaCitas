import { Component } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui'

/**
 * Red de seguridad para la carga diferida de pantallas.
 *
 * Cada pantalla se descarga por separado la primera vez que se visita
 * (React.lazy). Si esa descarga falla -por ejemplo porque el telefono
 * perdio la cobertura, o porque en el modo movil de las herramientas de
 * desarrollo esta marcada la casilla "Offline"-, la promesa se rechaza,
 * <Suspense> no puede recuperarse y React desmonta el arbol entero: la
 * pagina se queda EN NEGRO, sin ningun mensaje.
 *
 * Este limite de error atrapa ese fallo y muestra que ha pasado y como
 * salir de ahi.
 */

/** Reconoce el fallo concreto de "no pude descargar el trozo de codigo" */
function esFalloDeDescarga(error) {
  const texto = `${error?.name || ''} ${error?.message || ''}`.toLowerCase()
  return (
    texto.includes('dynamically imported module') ||
    texto.includes('importing a module script failed') ||
    texto.includes('failed to fetch') ||
    texto.includes('chunkloaderror') ||
    texto.includes('loading chunk')
  )
}

export class RouteBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, online: true }
    this.reintentar = this.reintentar.bind(this)
    this.alVolverLaRed = this.alVolverLaRed.bind(this)
  }

  static getDerivedStateFromError(error) {
    return {
      error,
      // navigator.onLine solo es fiable en el momento del fallo
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
    }
  }

  componentDidMount() {
    window.addEventListener('online', this.alVolverLaRed)
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.alVolverLaRed)
  }

  componentDidCatch(error) {
    // Queda en la consola para poder depurarlo
    console.error('[RouteBoundary] no se pudo cargar la pantalla:', error)
  }

  /** Al recuperar la conexion, se recarga sola: es lo que espera el usuario */
  alVolverLaRed() {
    if (this.state.error && esFalloDeDescarga(this.state.error)) {
      window.location.reload()
    }
  }

  /**
   * Recargar la pagina entera, no solo reintentar el import: React.lazy
   * guarda la promesa ya rechazada y volveria a fallar para siempre.
   */
  reintentar() {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const deDescarga = esFalloDeDescarga(error)
    const sinRed = deDescarga && !this.state.online

    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5 py-16">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-850 text-gold-400">
            {sinRed ? <WifiOff className="h-7 w-7" /> : <RefreshCw className="h-7 w-7" />}
          </span>

          <h1 className="font-display text-3xl tracking-wide text-ink-50">
            {sinRed ? 'Te quedaste sin conexion' : 'No pudimos abrir esta pantalla'}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-ink-400">
            {sinRed ? (
              <>
                Esta pantalla se descarga la primera vez que entras en ella y no
                hubo red para hacerlo. Vuelve a intentarlo cuando tengas
                cobertura: en cuanto la recuperes se recargara sola.
              </>
            ) : deDescarga ? (
              <>
                La descarga de esta seccion se quedo a medias. Suele arreglarse
                recargando.
              </>
            ) : (
              <>
                Algo fallo al dibujar esta seccion. Recarga la pagina; si vuelve
                a ocurrir, avisanos.
              </>
            )}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button onClick={this.reintentar} icon={RefreshCw}>
              Recargar
            </Button>
            <Button href="/" variant="secondary">
              Ir al inicio
            </Button>
          </div>

          {!deDescarga && (
            <p className="mt-6 break-words text-xs text-ink-600">{String(error?.message || error)}</p>
          )}
        </div>
      </div>
    )
  }
}

export default RouteBoundary
