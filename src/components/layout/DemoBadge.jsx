import { useState } from 'react'
import { FlaskConical, RotateCcw, X } from 'lucide-react'

import services, { isMockMode } from '@/services'
import { useToast } from '@/context/ToastContext'
import { ConfirmDialog } from '@/components/ui'

/**
 * Indicador discreto de MODO DEMO.
 *
 * Solo aparece cuando VITE_USE_MOCK esta activo. Ademas de avisar de que
 * los datos son ficticios, permite volver a sembrarlos desde cero, muy
 * util despues de trastear con la app.
 */
export function DemoBadge() {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const toast = useToast()

  if (!isMockMode) return null

  async function handleReset() {
    setResetting(true)
    try {
      await services.demo.reset()
      toast.success('Datos de demostracion reiniciados.')
      // Recarga completa para que todas las vistas partan de cero
      setTimeout(() => window.location.reload(), 500)
    } catch (error) {
      toast.error(error?.message || 'No se pudieron reiniciar los datos.')
      setResetting(false)
      setConfirming(false)
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 left-4 z-50 print:hidden">
        <div className="pointer-events-auto">
          {expanded ? (
            <div className="w-64 rounded-xl border border-gold-500/40 bg-ink-900/95 p-4 shadow-panel backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-gold-400">
                  <FlaskConical className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Modo demo</span>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="rounded p-0.5 text-ink-400 transition hover:text-ink-100"
                  aria-label="Cerrar aviso de modo demo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-ink-400">
                Los datos son ficticios y se guardan en tu navegador. Firebase no esta conectado.
              </p>

              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs font-medium text-ink-200 transition hover:bg-ink-750"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reiniciar datos demo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex items-center gap-2 rounded-full border border-gold-500/40 bg-ink-900/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold-400 shadow-panel backdrop-blur transition hover:border-gold-500 hover:bg-ink-850"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
              </span>
              Modo demo
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleReset}
        loading={resetting}
        title="Reiniciar datos de demostracion"
        message="Se borraran todos los cambios que hayas hecho (citas, cursos, usuarios...) y se volveran a generar los datos de ejemplo. Tambien se cerrara tu sesion."
        confirmLabel="Si, reiniciar"
      />
    </>
  )
}

export default DemoBadge
