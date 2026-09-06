import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/utils/format'
import { CLIENT_NAV } from './navConfig'
import { PublicLayout } from './PublicLayout'

/**
 * Layout del area de CLIENTE.
 *
 * Reutiliza la barra y el pie del sitio publico (el cliente sigue siendo
 * un visitante que ademas tiene cuenta) y anade una subnavegacion propia,
 * desplazable en horizontal en pantallas pequenas.
 */
export function ClientLayout() {
  return (
    <PublicLayout>
      <div className="border-b border-ink-800 bg-ink-900/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
            {CLIENT_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-4 text-sm font-medium transition',
                    isActive ? 'text-gold-400' : 'text-ink-400 hover:text-ink-100'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {isActive && (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gold-500" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </div>
    </PublicLayout>
  )
}

export default ClientLayout
