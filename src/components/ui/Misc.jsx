import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'

import { cn, occupancyRatio } from '@/utils/format'
import services from '@/services'
import { useToast } from '@/context/ToastContext'

/* ------------------------------------------------------------------ */
/*  Barra de progreso / cupo                                           */
/* ------------------------------------------------------------------ */

/**
 * Barra de ocupacion de cupo de un curso.
 * Cambia de color segun lo lleno que este: verde, ambar y rojo.
 */
export function CapacityBar({ enrolled = 0, capacity = 0, showLabel = true, className = '' }) {
  const ratio = occupancyRatio(enrolled, capacity)
  const percent = Math.round(ratio * 100)
  const left = Math.max(0, capacity - enrolled)

  const color = ratio >= 1 ? 'bg-rose-500' : ratio >= 0.75 ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className={cn('space-y-1.5', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-400">
            {enrolled} / {capacity} inscritos
          </span>
          <span
            className={cn(
              'font-medium',
              left === 0 ? 'text-rose-400' : left <= 2 ? 'text-amber-400' : 'text-emerald-400'
            )}
          >
            {left === 0 ? 'Cupo lleno' : left === 1 ? 'Ultimo lugar' : `${left} lugares`}
          </span>
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink-750"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Ocupacion del curso"
      >
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

/** Barra de progreso generica con etiqueta */
export function ProgressBar({ value = 0, max = 100, color = 'bg-gold-500', className = '' }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-ink-750', className)}>
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${percent}%` }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Pestanas                                                           */
/* ------------------------------------------------------------------ */

/**
 * Pestanas horizontales, desplazables en movil.
 * @param {Array<{value:string,label:string,count?:number}>} tabs
 */
export function Tabs({ tabs = [], value, onChange, className = '' }) {
  return (
    <div className={cn('no-scrollbar overflow-x-auto border-b border-ink-700/70', className)}>
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const active = tab.value === value
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={cn(
                'relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition',
                active ? 'text-gold-400' : 'text-ink-400 hover:text-ink-200'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                    active ? 'bg-gold-500/20 text-gold-300' : 'bg-ink-800 text-ink-400'
                  )}
                >
                  {tab.count}
                </span>
              )}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold-500" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Subida de imagenes                                                 */
/* ------------------------------------------------------------------ */

/**
 * Selector y subida de imagen.
 * Delega en services.storage, asi que en modo demo guarda una data URL
 * comprimida y en modo real sube a Firebase Storage. La vista es la misma.
 *
 * @param {string}   value     URL actual
 * @param {Function} onChange  recibe la URL nueva (o '' al quitarla)
 * @param {string}   path      ruta destino en Storage
 */
export function ImageUpload({
  value,
  onChange,
  path = 'uploads',
  label = 'Imagen',
  hint = 'JPG o PNG, maximo 8 MB',
  aspect = 'aspect-video',
  rounded = 'rounded-xl',
  className = '',
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const toast = useToast()

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const url = await services.storage.uploadImage(`${path}/${Date.now()}-${file.name}`, file)
      onChange(url)
      toast.success('Imagen subida correctamente.')
    } catch (error) {
      toast.error(error?.message || 'No se pudo subir la imagen.')
    } finally {
      setUploading(false)
      // Permite volver a elegir el mismo archivo
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <span className="block text-sm font-medium text-ink-200">{label}</span>}

      <div
        className={cn(
          'relative w-full overflow-hidden border border-dashed border-ink-600 bg-ink-850',
          aspect,
          rounded
        )}
      >
        {value ? (
          <img src={value} alt="Vista previa" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-500">
            <ImagePlus className="h-8 w-8" aria-hidden="true" />
            <span className="text-xs">Sin imagen</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70">
            <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-750 px-3 py-2 text-sm text-ink-100 transition hover:bg-ink-700 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {value ? 'Cambiar imagen' : 'Subir imagen'}
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Quitar
          </button>
        )}
      </div>

      {hint && <p className="text-xs text-ink-400">{hint}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        aria-label="Seleccionar imagen"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Fila de dato                                                       */
/* ------------------------------------------------------------------ */

/** Par etiqueta / valor, usado en fichas de detalle */
export function DataRow({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-500/70" aria-hidden="true" />}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
        <div className="mt-0.5 text-sm text-ink-200">{value || '-'}</div>
      </div>
    </div>
  )
}

/** Separador con texto centrado */
export function Divider({ children, className = '' }) {
  if (!children) return <hr className={cn('border-ink-700/70', className)} />
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="h-px flex-1 bg-ink-700/70" />
      <span className="text-xs uppercase tracking-wider text-ink-500">{children}</span>
      <span className="h-px flex-1 bg-ink-700/70" />
    </div>
  )
}

export default Tabs
