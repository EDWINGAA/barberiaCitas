import { Link } from 'react-router-dom'
import { Scissors } from 'lucide-react'

import { cn } from '@/utils/format'
import { useBusiness } from '@/context/BusinessContext'

/**
 * Logotipo del negocio.
 * Usa el logo subido por el administrador si existe; si no, dibuja el
 * icono de tijeras sobre un cuadro dorado.
 */
export function Logo({ to = '/', size = 'md', showName = true, className = '' }) {
  const { business } = useBusiness()

  const sizes = {
    sm: { box: 'h-8 w-8', icon: 'h-4 w-4', text: 'text-base' },
    md: { box: 'h-10 w-10', icon: 'h-5 w-5', text: 'text-lg' },
    lg: { box: 'h-12 w-12', icon: 'h-6 w-6', text: 'text-2xl' },
  }
  const s = sizes[size] || sizes.md

  const content = (
    <>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-xl',
          'bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 shadow-lg shadow-gold-600/20',
          s.box
        )}
      >
        {business.logoURL ? (
          <img src={business.logoURL} alt={business.name} className="h-full w-full object-cover" />
        ) : (
          <Scissors className={s.icon} aria-hidden="true" />
        )}
      </span>

      {showName && (
        <span className="min-w-0">
          <span className={cn('block truncate font-display tracking-wide text-ink-50', s.text)}>
            {business.name}
          </span>
          {size !== 'sm' && (
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gold-500/80">
              Barberia y escuela
            </span>
          )}
        </span>
      )}
    </>
  )

  if (!to) {
    return <div className={cn('flex items-center gap-3', className)}>{content}</div>
  }

  return (
    <Link to={to} className={cn('flex items-center gap-3 transition hover:opacity-90', className)}>
      {content}
    </Link>
  )
}

export default Logo
