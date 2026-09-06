import { useCallback, useState } from 'react'

/**
 * Estado de formulario con validacion.
 *
 * @param {object}   initialValues valores iniciales
 * @param {Function} validate      recibe los valores y devuelve { campo: mensaje }
 */
export function useForm(initialValues = {}, validate) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /** Cambia un campo y limpia su error mientras el usuario escribe */
  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  /** Handler listo para <input onChange> */
  const handleChange = useCallback(
    (event) => {
      const { name, value, type, checked } = event.target
      setValue(name, type === 'checkbox' ? checked : value)
    },
    [setValue]
  )

  const handleBlur = useCallback((event) => {
    const { name } = event.target
    setTouched((prev) => ({ ...prev, [name]: true }))
  }, [])

  /** Cambia varios campos de una vez */
  const setMany = useCallback((patch) => {
    setValues((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(
    (next = initialValues) => {
      setValues(next)
      setErrors({})
      setTouched({})
      setSubmitting(false)
    },
    [initialValues]
  )

  /** Valida sin enviar; devuelve true si todo esta correcto */
  const validateAll = useCallback(() => {
    if (!validate) return true
    const result = validate(values) || {}
    setErrors(result)
    setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])))
    return Object.keys(result).length === 0
  }, [validate, values])

  /**
   * Envuelve el submit: valida, marca "enviando" y traduce los errores de
   * servicio a errores de formulario cuando traen un campo asociado.
   */
  const handleSubmit = useCallback(
    (onValid) => async (event) => {
      event?.preventDefault?.()

      if (validate) {
        const result = validate(values) || {}
        setErrors(result)
        setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])))
        if (Object.keys(result).length > 0) return
      }

      setSubmitting(true)
      try {
        await onValid(values)
      } catch (error) {
        setErrors((prev) => ({ ...prev, _form: error?.message || 'Ocurrio un error inesperado.' }))
      } finally {
        setSubmitting(false)
      }
    },
    [validate, values]
  )

  /** Error visible de un campo (solo tras tocarlo o intentar enviar) */
  const errorOf = useCallback((name) => (touched[name] ? errors[name] : undefined), [errors, touched])

  return {
    values,
    errors,
    touched,
    submitting,
    setValue,
    setMany,
    setValues,
    setErrors,
    handleChange,
    handleBlur,
    handleSubmit,
    validateAll,
    errorOf,
    reset,
  }
}

export default useForm
