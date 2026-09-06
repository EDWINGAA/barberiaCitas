import { cn } from '@/utils/format'

/**
 * Lista de datos en filas alineadas.
 *
 * Es el patron que usan todas las pantallas de gestion del panel: una
 * sola columna que se lee de arriba abajo, con las mismas columnas
 * alineadas en todas las filas. En pantallas anchas parece una tabla;
 * en movil cada fila se apila y cada dato lleva su etiqueta.
 *
 * Se usa una rejilla CSS (y no una <table>) para poder apilar las celdas
 * en movil sin romper el diseno.
 *
 * IMPORTANTE: "columns" es una clase de Tailwind completa, escrita tal
 * cual en la pantalla que la usa, por ejemplo:
 *   columns="lg:grid-cols-[minmax(0,2fr)_8rem_6rem_auto]"
 * Asi Tailwind la encuentra al analizar el archivo y la genera.
 */

/**
 * @param {string} columns  clase lg:grid-cols-[...] con la plantilla
 * @param {Array}  headers  titulos de columna: string o {label, align}
 */
export function DataList({ columns, headers = [], children, className = '' }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900', className)}>
      {/* Cabecera: solo en pantallas anchas, donde hay columnas de verdad */}
      {headers.length > 0 && (
        <div
          className={cn(
            'hidden gap-x-4 border-b border-ink-800 bg-ink-850/60 px-5 py-3 lg:grid',
            columns
          )}
        >
          {headers.map((header, i) => {
            const { label, align } = typeof header === 'string' ? { label: header } : header
            return (
              <span
                key={`${label}-${i}`}
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-wider text-ink-500',
                  align === 'right' && 'text-right',
                  align === 'center' && 'text-center'
                )}
              >
                {label}
              </span>
            )
          })}
        </div>
      )}

      <div>{children}</div>
    </div>
  )
}

/**
 * Una fila. Recibe la misma clase de columnas que la lista, para que
 * todo quede alineado con la cabecera.
 */
export function DataListRow({
  columns,
  children,
  className = '',
  muted = false,
  first = false,
  ...props
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-x-4 gap-y-3 px-4 py-4 transition-colors lg:items-center lg:px-5',
        columns,
        !first && 'border-t border-ink-800',
        muted ? 'bg-ink-900/60' : 'hover:bg-ink-850/60',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Celda de una fila. La etiqueta solo se ve en movil, donde las filas se
 * apilan y hace falta saber que es cada dato.
 */
export function DataListCell({ label, children, className = '', align = 'left' }) {
  return (
    <div
      className={cn(
        'min-w-0',
        align === 'right' && 'lg:text-right',
        align === 'center' && 'lg:text-center',
        className
      )}
    >
      {label && (
        <p className="mb-0.5 text-[10px] uppercase tracking-wider text-ink-600 lg:hidden">
          {label}
        </p>
      )}
      {children}
    </div>
  )
}

/**
 * Franja de resumen que se coloca encima de una lista.
 * Da contexto de cuantos elementos hay y de que se esta viendo.
 */
export function DataListSummary({ children, className = '' }) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-ink-800 px-1 py-3 text-sm',
        className
      )}
    >
      {children}
    </div>
  )
}
