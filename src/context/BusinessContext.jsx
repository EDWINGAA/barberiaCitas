import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { createBusinessModel } from '@/models'
import services from '@/services'

/**
 * Configuracion del negocio (nombre, logo, horarios, contacto).
 * Se carga una sola vez al arrancar y la consumen el header publico,
 * el pie de pagina, la landing y el calculo de horarios.
 */

const BusinessContext = createContext(null)

export function BusinessProvider({ children }) {
  const [business, setBusiness] = useState(() => createBusinessModel({}))
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await services.business.get()
      if (data) setBusiness(data)
    } catch {
      // Si falla (por ejemplo, Firebase mal configurado), la app sigue
      // funcionando con los valores por defecto del modelo.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Guarda cambios y refresca el estado global */
  const update = useCallback(async (data) => {
    const updated = await services.business.update(data)
    setBusiness(updated)
    return updated
  }, [])

  const value = useMemo(() => ({ business, loading, reload: load, update }), [business, loading, load, update])

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}

export function useBusiness() {
  const context = useContext(BusinessContext)
  if (!context) throw new Error('useBusiness debe usarse dentro de <BusinessProvider>')
  return context
}

export default BusinessContext
