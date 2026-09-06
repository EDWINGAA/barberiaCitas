import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ExternalLink, LogOut, Menu, X } from 'lucide-react'

import { ROLE_LABELS, ROLES } from '@/constants'
import { cn } from '@/utils/format'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { Avatar } from '@/components/ui'
import { Logo } from './Logo'
import { UserMenu } from './UserMenu'
import { NotificationBell } from './NotificationBell'
import { ADMIN_NAV, BARBER_NAV } from './navConfig'

/**
 * Layout de los paneles de BARBERO y ADMINISTRADOR.
 *
 * En escritorio: sidebar fijo a la izquierda + header superior.
 * En movil: el sidebar se convierte en un cajon lateral que abre el
 * boton hamburguesa del header.
 */
export function PanelLayout({ role }) {
  const nav = role === ROLES.ADMIN ? ADMIN_NAV : BARBER_NAV
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Al navegar, cerrar el cajon (importante en movil)
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Bloquear el scroll del fondo mientras el cajon esta abierto
  useEffect(() => {
    if (!drawerOpen) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [drawerOpen])

  // Titulo de la seccion actual, mostrado en el header
  const sectionTitle = findSectionTitle(nav, location.pathname)

  return (
    <div className="min-h-screen bg-ink-950">
      {/* ---------- Sidebar de escritorio ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-800 bg-ink-900 lg:flex">
        <SidebarContent nav={nav} role={role} />
      </aside>

      {/* ---------- Cajon lateral en movil ---------- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-ink-800 bg-ink-900 shadow-panel animate-slide-in-right">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
              aria-label="Cerrar menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent nav={nav} role={role} />
          </aside>
        </div>
      )}

      {/* ---------- Contenido ---------- */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-ink-100 sm:text-lg">{sectionTitle}</h1>
              <p className="hidden text-xs text-ink-500 sm:block">
                Panel de {ROLE_LABELS[role]?.toLowerCase()}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Contenido compartido del sidebar                                   */
/* ------------------------------------------------------------------ */

function SidebarContent({ nav, role }) {
  const { user, signOut } = useAuth()
  const toast = useToast()

  async function handleSignOut() {
    try {
      await signOut()
      toast.info('Sesion cerrada.')
    } catch (error) {
      toast.error(error?.message || 'No se pudo cerrar la sesion.')
    }
  }

  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-ink-800 px-5">
        <Logo size="sm" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {nav.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                        isActive
                          ? 'bg-gold-500/10 text-gold-300 ring-1 ring-inset ring-gold-500/25'
                          : 'text-ink-400 hover:bg-ink-850 hover:text-ink-100'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn('h-4 w-4 shrink-0', isActive ? 'text-gold-400' : 'text-ink-500')}
                        />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pie del sidebar: usuario y accesos rapidos */}
      <div className="shrink-0 border-t border-ink-800 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-ink-850 p-3">
          <Avatar src={user?.photoURL} name={user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-100">{user?.name}</p>
            <p className="truncate text-[11px] text-gold-500/90">{ROLE_LABELS[role]}</p>
          </div>
        </div>

        <div className="mt-2 flex gap-1">
          <NavLink
            to="/"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-ink-400 transition hover:bg-ink-850 hover:text-ink-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver sitio
          </NavLink>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-rose-300 transition hover:bg-rose-500/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </div>
    </>
  )
}

/** Busca la etiqueta del enlace que corresponde a la ruta actual */
function findSectionTitle(nav, pathname) {
  const all = nav.flatMap((group) => group.items)
  // Primero coincidencia exacta, luego el prefijo mas largo
  const exact = all.find((item) => item.to === pathname)
  if (exact) return exact.label

  const partial = all
    .filter((item) => pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]

  return partial?.label || 'Panel'
}

export default PanelLayout
