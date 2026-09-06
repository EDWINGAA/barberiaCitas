import { Loader2 } from 'lucide-react'

import { cn } from '@/utils/format'
import { Button } from './Button'

/* ------------------------------------------------------------------ */
/*  Cargando                                                           */
/* ------------------------------------------------------------------ */

export function Spinner({ className = '', size = 'md' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }
  return (
    <Loader2
      className={cn('animate-spin text-gold-500', sizes[size] || sizes.md, className)}
      aria-hidden="true"
    />
  )
}

/** Pantalla completa de carga, usada mientras se resuelve la sesion */
export function FullPageLoader({ message = 'Cargando...' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-950">
      <div className="relative">
        <div className="h-14 w-14 rounded-full border-2 border-ink-700" />
        <div className="absolute inset-0 h-14 w-14 animate-spin rounded-full border-2 border-transparent border-t-gold-500" />
      </div>
      <p className="text-sm text-ink-400">{message}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Esqueletos de carga                                                */
/* ------------------------------------------------------------------ */

/** Bloque gris con brillo animado */
export function Skeleton({ className = '' }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-ink-800', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-ink-700/60 to-transparent" />
    </div>
  )
}

/** Esqueleto de una fila de lista (avatar + dos lineas) */
export function SkeletonRow({ className = '' }) {
  return (
    <div className={cn('flex items-center gap-4 rounded-2xl border border-ink-700/70 bg-ink-900 p-4', className)}>
      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-7 w-20 rounded-full" />
    </div>
  )
}

/** Varias filas de esqueleto */
export function SkeletonList({ rows = 4, className = '' }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

/**
 * Esqueleto de tarjeta de metrica.
 * "className" permite pasar otra rejilla cuando la pantalla no muestra
 * cuatro tarjetas, para que el esqueleto no salte al cargar.
 */
export function SkeletonStats({ count = 4, className = 'sm:grid-cols-2 xl:grid-cols-4' }) {
  return (
    <div className={cn('grid gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        // Imita la forma de StatCard: en una linea en movil, apilada en sm
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-ink-700/70 bg-ink-900 p-4 sm:block sm:p-5"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg sm:hidden" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-3 w-32 sm:mt-3 sm:w-28" />
          </div>
          <Skeleton className="h-7 w-16 shrink-0 sm:mt-3 sm:h-8 sm:w-20" />
        </div>
      ))}
    </div>
  )
}

/** Esqueleto de tarjeta de curso */
export function SkeletonCourseCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-4 h-2 w-full rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonCourseGrid({ count = 6 }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCourseCard key={i} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Estados vacios                                                     */
/* ------------------------------------------------------------------ */

/**
 * Estado vacio con icono, mensaje y accion opcional.
 * Se usa siempre que una lista no tiene resultados, para que la pantalla
 * nunca quede en blanco.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  to,
  className = '',
  compact = false,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-700 bg-ink-900/50 text-center',
        compact ? 'px-6 py-8' : 'px-6 py-14',
        className
      )}
    >
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-800 text-ink-400">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      )}
      <h3 className="text-base font-semibold text-ink-200">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-400">{description}</p>}

      {/* Accion: o bien un nodo a medida, o bien un boton simple */}
      {action ? (
        <div className="mt-6">{action}</div>
      ) : (
        actionLabel &&
        (onAction || to) && (
          <div className="mt-6">
            <Button onClick={onAction} to={to} variant="outline" size="sm">
              {actionLabel}
            </Button>
          </div>
        )
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Error                                                              */
/* ------------------------------------------------------------------ */

/** Bloque de error con opcion de reintentar */
export function ErrorState({ error, onRetry, title = 'No pudimos cargar la informacion' }) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-rose-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-rose-300/80">
        {error?.message || 'Ocurrio un error inesperado. Intentalo de nuevo.'}
      </p>
      {onRetry && (
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  )
}

/** Mensaje de error en linea, para formularios */
export function FormError({ message }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      {message}
    </div>
  )
}

export default EmptyState
