import { Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/utils/format'

/**
 * Boton reutilizable.
 * Si recibe "to" se renderiza como <Link>, si recibe "href" como <a>,
 * y en cualquier otro caso como <button>.
 */

const VARIANTS = {
  primary:
    'bg-gold-500 text-ink-950 hover:bg-gold-400 active:bg-gold-600 shadow-lg shadow-gold-500/20 font-semibold',
  secondary: 'bg-ink-750 text-ink-100 hover:bg-ink-700 border border-ink-600',
  outline: 'border border-gold-500/60 text-gold-300 hover:bg-gold-500/10 hover:border-gold-400',
  ghost: 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
  danger: 'bg-rose-600/90 text-white hover:bg-rose-600 shadow-lg shadow-rose-900/30',
  dangerGhost: 'text-rose-300 hover:bg-rose-500/10 border border-rose-500/30',
  success: 'bg-emerald-600/90 text-white hover:bg-emerald-600',
}

const SIZES = {
  xs: 'text-xs px-2.5 py-1.5 gap-1.5 rounded-lg',
  sm: 'text-sm px-3 py-2 gap-2 rounded-lg',
  md: 'text-sm px-4 py-2.5 gap-2 rounded-xl',
  lg: 'text-base px-6 py-3 gap-2.5 rounded-xl',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  to,
  href,
  type = 'button',
  fullWidth = false,
  ...props
}) {
  const isDisabled = disabled || loading

  const classes = cn(
    'inline-flex items-center justify-center whitespace-nowrap transition-all duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    fullWidth && 'w-full',
    className
  )

  const content = (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && (
        <IconRight className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
      )}
    </>
  )

  if (to && !isDisabled) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }

  if (href && !isDisabled) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    )
  }

  return (
    <button type={type} className={classes} disabled={isDisabled} {...props}>
      {content}
    </button>
  )
}

/** Boton cuadrado que solo contiene un icono */
export function IconButton({ icon: Icon, label, variant = 'ghost', className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg transition',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant] || VARIANTS.ghost,
        className
      )}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}

export default Button
