import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

import { cn } from '@/utils/format'
import { Button } from './Button'

/**
 * Ventana modal accesible.
 * Se renderiza en un portal, bloquea el scroll del fondo y se cierra
 * con la tecla Escape o pulsando fuera.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
}) {
  // Cerrar con Escape y bloquear el scroll mientras esta abierta
  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      {/* Fondo oscurecido */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full animate-slide-up border border-ink-700 bg-ink-900 shadow-panel',
          'rounded-t-2xl sm:rounded-2xl',
          'max-h-[92vh] sm:max-h-[88vh] flex flex-col',
          sizes[size] || sizes.md
        )}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-700/70 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-100">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido con scroll propio */}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-ink-700/70 px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/**
 * Dialogo de confirmacion para acciones destructivas.
 * Se usa antes de cancelar citas, desactivar barberos, borrar cursos...
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirmar accion',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-4">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            variant === 'danger' ? 'bg-rose-500/10 text-rose-400' : 'bg-gold-500/10 text-gold-400'
          )}
        >
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="pt-1.5 text-sm leading-relaxed text-ink-300">{message}</p>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export default Modal
