import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { ROLES } from '@/constants'
import services from '@/services'

/**
 * Contexto de autenticacion.
 *
 * Expone el usuario actual, su rol y el estado de carga inicial.
 * Habla SOLO con /services, nunca con Firebase directamente, asi que
 * funciona igual en modo demo y en modo real.
 */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // "loading" en true hasta que sabemos si hay sesion o no. Es lo que
  // evita el parpadeo de la pantalla de login al recargar la pagina.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = services.auth.onAuthChanged((profile) => {
      setUser(profile)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  /** Inicia sesion; devuelve el perfil para poder redirigir por rol */
  const signIn = useCallback(async (email, password) => {
    const profile = await services.auth.signIn(email, password)
    setUser(profile)
    return profile
  }, [])

  /** Registro publico: siempre crea un cliente */
  const signUp = useCallback(async (data) => {
    const profile = await services.auth.signUp(data)
    setUser(profile)
    return profile
  }, [])

  const signOut = useCallback(async () => {
    await services.auth.signOut()
    setUser(null)
  }, [])

  /**
   * Vuelve a leer el perfil desde el origen de datos.
   * Se llama tras editar nombre, telefono o foto para que el header y
   * el avatar se actualicen al instante.
   */
  const reloadProfile = useCallback(async () => {
    if (!user?.uid) return null
    const fresh = await services.users.get(user.uid)
    if (fresh) setUser(fresh)
    return fresh
  }, [user?.uid])

  /** Actualiza el perfil y refresca el estado local */
  const updateProfile = useCallback(
    async (data) => {
      if (!user?.uid) return null
      const updated = await services.users.update(user.uid, data)
      setUser(updated)
      services.auth.refresh?.()
      return updated
    },
    [user?.uid]
  )

  const value = useMemo(
    () => ({
      user,
      role: user?.role || null,
      loading,
      isAuthenticated: Boolean(user),
      isClient: user?.role === ROLES.CLIENTE,
      isBarber: user?.role === ROLES.BARBERO,
      isAdmin: user?.role === ROLES.ADMIN,
      signIn,
      signUp,
      signOut,
      reloadProfile,
      updateProfile,
    }),
    [user, loading, signIn, signUp, signOut, reloadProfile, updateProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return context
}

export default AuthContext
