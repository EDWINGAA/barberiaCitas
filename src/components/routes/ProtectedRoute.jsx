import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { ROLE_HOME } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { FullPageLoader } from '@/components/ui'

/**
 * Exige sesion iniciada.
 * Si no hay usuario, manda al login recordando a donde queria ir
 * para volver ahi despues de autenticarse.
 */
export function RequireAuth() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader message="Verificando tu sesion..." />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

/**
 * Exige uno o varios roles concretos.
 * Si el usuario tiene sesion pero no el rol adecuado, se le redirige a
 * SU panel en lugar de mostrarle un error.
 *
 * @param {{allow: string[]}} props roles permitidos
 */
export function RequireRole({ allow = [] }) {
  const { user, isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader message="Comprobando permisos..." />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/'} replace />
  }

  return <Outlet />
}

/**
 * Rutas solo para visitantes (login y registro).
 * Un usuario ya autenticado va directo a su panel.
 */
export function RequireGuest() {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) return <FullPageLoader message="Cargando..." />

  if (isAuthenticated) {
    return <Navigate to={ROLE_HOME[user.role] || '/'} replace />
  }

  return <Outlet />
}

export default RequireAuth
