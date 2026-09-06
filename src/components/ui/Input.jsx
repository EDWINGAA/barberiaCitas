import { forwardRef, useId, useState } from 'react'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'

import { cn } from '@/utils/format'

/* ------------------------------------------------------------------ */
/*  Envoltura comun: etiqueta, ayuda y mensaje de error                */
/* ------------------------------------------------------------------ */

export function Field({ label, htmlFor, error, hint, required, children, className = '' }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-200">
          {label}
          {required && <span className="ml-1 text-gold-400">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-400">{hint}</p>
      )}
    </div>
  )
}

const BASE_CONTROL =
  'w-full rounded-xl border bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 ' +
  'transition outline-none disabled:opacity-50 disabled:cursor-not-allowed'

const CONTROL_OK = 'border-ink-600 focus:border-gold-500 focus:ring-1 focus:ring-gold-500/40'
const CONTROL_ERROR = 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'

/* ------------------------------------------------------------------ */
/*  Campo de texto                                                     */
/* ------------------------------------------------------------------ */

export const Input = forwardRef(function Input(
  { label, error, hint, required, className = '', icon: Icon, id, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id || generatedId

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(BASE_CONTROL, error ? CONTROL_ERROR : CONTROL_OK, Icon && 'pl-10')}
          {...props}
        />
      </div>
    </Field>
  )
})

/* ------------------------------------------------------------------ */
/*  Contrasena con boton para mostrar/ocultar                          */
/* ------------------------------------------------------------------ */

export const PasswordInput = forwardRef(function PasswordInput(
  { label, error, hint, required, className = '', id, ...props },
  ref
) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const inputId = id || generatedId

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={cn(BASE_CONTROL, error ? CONTROL_ERROR : CONTROL_OK, 'pr-11')}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-200"
          aria-label={visible ? 'Ocultar contrasena' : 'Mostrar contrasena'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  )
})

/* ------------------------------------------------------------------ */
/*  Area de texto                                                      */
/* ------------------------------------------------------------------ */

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, className = '', rows = 4, id, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id || generatedId

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={cn(BASE_CONTROL, error ? CONTROL_ERROR : CONTROL_OK, 'resize-y')}
        {...props}
      />
    </Field>
  )
})

/* ------------------------------------------------------------------ */
/*  Desplegable                                                        */
/* ------------------------------------------------------------------ */

export const Select = forwardRef(function Select(
  { label, error, hint, required, className = '', options = [], placeholder, children, id, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id || generatedId

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <select
        ref={ref}
        id={inputId}
        className={cn(BASE_CONTROL, error ? CONTROL_ERROR : CONTROL_OK, 'cursor-pointer appearance-none pr-9')}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237A7A88' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          backgroundSize: '1rem',
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
    </Field>
  )
})

/* ------------------------------------------------------------------ */
/*  Casilla de verificacion                                            */
/* ------------------------------------------------------------------ */

export function Checkbox({ label, description, className = '', id, ...props }) {
  const generatedId = useId()
  const inputId = id || generatedId

  return (
    <label
      htmlFor={inputId}
      className={cn('flex cursor-pointer items-start gap-3 select-none', className)}
    >
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ink-600 bg-ink-850 text-gold-500 accent-gold-500"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm text-ink-200">{label}</span>
        {description && <span className="block text-xs text-ink-400">{description}</span>}
      </span>
    </label>
  )
}

/* ------------------------------------------------------------------ */
/*  Grupo de botones tipo "pastilla"                                   */
/* ------------------------------------------------------------------ */

/**
 * Selector visual de una opcion entre varias. Se usa para el nivel y la
 * modalidad de los cursos, y para los filtros rapidos.
 */
export function PillGroup({ label, value, onChange, options = [], error, className = '', multiple = false }) {
  const selected = multiple ? value || [] : value

  function toggle(optionValue) {
    if (!multiple) {
      onChange(optionValue)
      return
    }
    const set = new Set(selected)
    if (set.has(optionValue)) set.delete(optionValue)
    else set.add(optionValue)
    onChange([...set])
  }

  return (
    <Field label={label} error={error} className={className}>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = multiple ? selected.includes(option.value) : selected === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium transition',
                active
                  ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                  : 'border-ink-600 bg-ink-850 text-ink-300 hover:border-ink-500 hover:text-ink-100'
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </Field>
  )
}

export default Input
