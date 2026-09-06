import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

import { cn } from '@/utils/format'

/**
 * Cabecera de pagina de panel: titulo, descripcion, migas de vuelta
 * y zona de acciones a la derecha.
 */
export function PageHeader({ title, description, back, backLabel = 'Volver', actions, className = '' }) {
  return (
    <div className={cn('mb-6', className)}>
      {back && (
        <Link
          to={back}
          className="mb-3 inline-flex items-center gap-1 text-sm text-ink-400 transition hover:text-gold-400"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink-50 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/**
 * Cabecera del sitio publico, mas espectacular: titulo grande centrado
 * sobre el patron de rejilla dorada.
 */
export function PublicHeader({ eyebrow, title, description, children }) {
  return (
    <section className="relative overflow-hidden border-b border-ink-800 bg-ink-900">
      <div className="bg-grid absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-500">{eyebrow}</p>
        )}
        <h1 className="mt-3 font-display text-4xl tracking-wide text-ink-50 sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {description && (
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-400">{description}</p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  )
}

export default PageHeader
