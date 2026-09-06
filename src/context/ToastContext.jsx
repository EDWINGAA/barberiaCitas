import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

/**
 * Sistema de avisos (toasts).
 * Cualquier vista puede llamar a toast.success(...) / toast.error(...)
 * para dar retroalimentacion sin montar su propio estado.
 */

const ToastContext = createContext(null)

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    classes: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    iconClass: 'text-emerald-400',
  },
  error: {
    icon: XCircle,
    classes: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
    iconClass: 'text-rose-400',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    iconClass: 'text-amber-400',
  },
  info: {
    icon: Info,
    classes: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    iconClass: 'text-sky-400',
  },
}

let counter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (variant, message, duration = 4200) => {
      const id = ++counter
      setToasts((prev) => [...prev, { id, variant, message }])
      if (duration > 0) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss]
  )

  const api = useMemo(
    () => ({
      success: (message, duration) => push('success', message, duration),
      error: (message, duration) => push('error', message, duration ?? 5500),
      warning: (message, duration) => push('warning', message, duration),
      info: (message, duration) => push('info', message, duration),
      dismiss,
    }),
    [push, dismiss]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Pila de avisos: abajo en movil, arriba a la derecha en escritorio */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:items-end">
        {toasts.map((toast) => {
          const variant = VARIANTS[toast.variant] || VARIANTS.info
          const Icon = variant.icon
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-panel backdrop-blur-md animate-slide-in-right ${variant.classes}`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${variant.iconClass}`} />
              <p className="flex-1 text-sm leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-md p-0.5 opacity-60 transition hover:opacity-100"
                aria-label="Cerrar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return context
}

export default ToastContext
