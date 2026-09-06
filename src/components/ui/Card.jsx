import { cn } from '@/utils/format'

/** Superficie basica del panel */
export function Card({ children, className = '', padded = true, hover = false, ...props }) {
  return (
    <div
      className={cn(
        // "min-w-0" es imprescindible: la tarjeta casi siempre es hija de
        // una rejilla o de un flex, y sin el no puede encoger por debajo
        // de su contenido. Basta un titulo con "truncate" (que lleva
        // white-space: nowrap) para que ese ancho minimo suba hasta la
        // rejilla y saque la columna entera de la pantalla en un movil.
        'min-w-0 rounded-2xl border border-ink-700/70 bg-ink-900',
        padded && 'p-5',
        hover && 'transition hover:border-gold-500/40 hover:shadow-gold',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** Cabecera de tarjeta con titulo, descripcion y acciones a la derecha */
export function CardHeader({ title, subtitle, icon: Icon, action, className = '' }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-500/10 text-gold-400">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/**
 * Tarjeta de metrica para los tableros.
 * Muestra un valor grande, una etiqueta y opcionalmente una tendencia.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  trendLabel,
  accent = 'gold',
  loading = false,
  className = '',
}) {
  const accents = {
    gold: 'bg-gold-500/10 text-gold-400 ring-gold-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    sky: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
    rose: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
    violet: 'bg-violet-500/10 text-violet-400 ring-violet-500/20',
  }

  /*
   * La tarjeta cambia de forma segun el ancho:
   *
   *   movil            icono | etiqueta      | VALOR
   *                          | pista         |
   *
   *   sm en adelante   etiqueta       | icono
   *                    VALOR
   *                    pista
   *
   * En un telefono la version apilada dejaba media tarjeta vacia a la
   * derecha y tres metricas ocupaban toda la pantalla. Puesta en una
   * linea se lee igual de bien y ocupa la mitad de alto.
   *
   * Es la misma marca en los dos casos: solo cambia donde se coloca cada
   * celda de la rejilla, para no duplicar el contenido.
   */
  return (
    <div
      className={cn(
        'grid items-center gap-x-3 rounded-2xl border border-ink-700/70 bg-ink-900 p-4 transition hover:border-ink-600',
        'grid-cols-[auto_minmax(0,1fr)_auto]',
        'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-5',
        className
      )}
    >
      {Icon && (
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
            'col-start-1 row-span-2 row-start-1',
            'sm:col-start-2 sm:row-span-1 sm:row-start-1',
            accents[accent] || accents.gold
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}

      <p
        className={cn(
          'text-xs font-medium uppercase tracking-wider text-ink-400',
          'col-start-2 row-start-1',
          'sm:col-start-1 sm:row-start-1'
        )}
      >
        {label}
      </p>

      <div
        className={cn(
          'col-start-3 row-span-2 row-start-1 text-right',
          'sm:col-span-2 sm:col-start-1 sm:row-span-1 sm:row-start-2 sm:mt-3 sm:text-left'
        )}
      >
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded-md bg-ink-800" />
        ) : (
          <p className="text-2xl font-bold tracking-tight text-ink-100 sm:text-3xl">{value}</p>
        )}
      </div>

      {(hint || trend !== undefined) && (
        <div
          className={cn(
            'flex items-center gap-2 text-xs',
            'col-start-2 row-start-2',
            'sm:col-span-2 sm:col-start-1 sm:row-start-3 sm:mt-2'
          )}
        >
          {trend !== undefined && (
            <span
              className={cn(
                'font-semibold',
                trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-rose-400' : 'text-ink-400'
              )}
            >
              {trend > 0 ? '+' : ''}
              {trend}
              {trendLabel}
            </span>
          )}
          {hint && <span className="min-w-0 truncate text-ink-400">{hint}</span>}
        </div>
      )}
    </div>
  )
}

/** Contenedor de seccion con titulo, usado en las paginas de panel */
export function Section({ title, description, action, children, className = '' }) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold text-ink-100">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export default Card
