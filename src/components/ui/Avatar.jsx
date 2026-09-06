import { useState } from 'react'

import { cn, getInitials } from '@/utils/format'

const SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
  '2xl': 'h-28 w-28 text-3xl',
}

/**
 * Avatar de usuario.
 * Si la foto no carga (o no hay), cae con elegancia a las iniciales
 * sobre un fondo con degradado dorado.
 */
export function Avatar({ src, name = '', size = 'md', className = '', ring = false }) {
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-gradient-to-br from-gold-600/40 to-ink-800 font-semibold text-gold-200',
        ring && 'ring-2 ring-gold-500/40 ring-offset-2 ring-offset-ink-950',
        SIZES[size] || SIZES.md,
        className
      )}
      title={name}
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  )
}

/** Avatar acompanado de nombre y linea secundaria */
export function AvatarWithName({ src, name, subtitle, size = 'md', className = '' }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar src={src} name={name} size={size} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-100">{name}</p>
        {subtitle && <p className="truncate text-xs text-ink-400">{subtitle}</p>}
      </div>
    </div>
  )
}

/**
 * Portada de curso con respaldo.
 * Si la imagen no carga, muestra un degradado con la inicial del titulo,
 * de modo que las tarjetas nunca se ven rotas.
 */
export function CourseCover({ src, title = '', className = '', children }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className={cn('relative overflow-hidden bg-ink-800', className)}>
      {src && !failed ? (
        <img
          src={src}
          alt={`Portada del curso ${title}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-750 via-ink-800 to-gold-900/40">
          <span className="font-display text-5xl tracking-wider text-gold-500/50">
            {title.slice(0, 2).toUpperCase() || 'BC'}
          </span>
        </div>
      )}
      {/* Degradado inferior para que las etiquetas se lean siempre */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent" />
      {children}
    </div>
  )
}

export default Avatar
