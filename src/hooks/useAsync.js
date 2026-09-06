import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Carga datos asincronos exponiendo data / loading / error / reload.
 *
 * @param {Function} asyncFn  funcion que devuelve una promesa
 * @param {Array}    deps     dependencias que disparan una recarga
 * @param {object}   options  { initialData, enabled }
 */
export function useAsync(asyncFn, deps = [], options = {}) {
  const { initialData = null, enabled = true } = options

  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  // Evita actualizar el estado de un componente ya desmontado
  const mounted = useRef(true)
  // Descarta respuestas de peticiones antiguas que llegan tarde
  const requestId = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const execute = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return undefined
    }

    const id = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await asyncFn()
      if (mounted.current && id === requestId.current) {
        setData(result)
        setLoading(false)
      }
      return result
    } catch (err) {
      if (mounted.current && id === requestId.current) {
        setError(err)
        setLoading(false)
      }
      return undefined
    }
    // asyncFn se recrea en cada render; las deps explicitas mandan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  useEffect(() => {
    execute()
  }, [execute])

  return { data, loading, error, reload: execute, setData }
}

/**
 * Version para acciones que dispara el usuario (guardar, cancelar...).
 * No se ejecuta sola: devuelve run() y el estado de la operacion.
 */
export function useAsyncAction(actionFn) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(
    async (...args) => {
      setLoading(true)
      setError(null)
      try {
        const result = await actionFn(...args)
        setLoading(false)
        return { ok: true, data: result }
      } catch (err) {
        setError(err)
        setLoading(false)
        return { ok: false, error: err }
      }
    },
    [actionFn]
  )

  return { run, loading, error, setError }
}

export default useAsync
