import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Facebook, Instagram, Mail, MapPin, Menu, Phone, X } from 'lucide-react'

import { OPENING_HOURS_KEYS, ROLE_HOME, WEEKDAYS } from '@/constants'
import { cn, capitalize, formatPhone } from '@/utils/format'
import { formatTime12 } from '@/utils/date'
import { useAuth } from '@/context/AuthContext'
import { useBusiness } from '@/context/BusinessContext'
import { Button } from '@/components/ui'
import { Logo } from './Logo'
import { UserMenu } from './UserMenu'
import { NotificationBell } from './NotificationBell'
import { PUBLIC_NAV } from './navConfig'

/**
 * Layout del sitio publico: barra superior, contenido y pie de pagina.
 * Tambien lo usan las paginas del cliente, que anaden su propia
 * subnavegacion.
 */
export function PublicLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen flex-col bg-ink-950">
      {/* ---------- Barra superior ---------- */}
      <header className="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />

          <nav className="ml-6 hidden flex-1 items-center gap-1 lg:flex">
            {PUBLIC_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'text-gold-400' : 'text-ink-300 hover:bg-ink-850 hover:text-ink-100'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* shrink-0: en pantallas muy estrechas quien cede espacio es
              el logotipo, no los botones de sesion */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {isAuthenticated ? (
              <>
                <Button to={ROLE_HOME[user.role]} variant="outline" size="sm" className="hidden sm:inline-flex">
                  Mi panel
                </Button>
                <NotificationBell />
                <UserMenu />
              </>
            ) : (
              <>
                <Button to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                  Iniciar sesion
                </Button>
                <Button to="/registro" variant="primary" size="sm">
                  Crear cuenta
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 lg:hidden"
              aria-label={menuOpen ? 'Cerrar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Menu desplegable en movil */}
        {menuOpen && (
          <div className="border-t border-ink-800 bg-ink-900 lg:hidden">
            <nav className="mx-auto max-w-7xl px-4 py-3">
              <ul className="space-y-1">
                {PUBLIC_NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-lg px-3 py-2.5 text-sm font-medium transition',
                          isActive
                            ? 'bg-gold-500/10 text-gold-300'
                            : 'text-ink-300 hover:bg-ink-850 hover:text-ink-100'
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
                {!isAuthenticated && (
                  <li className="pt-2">
                    <Link
                      to="/login"
                      className="block rounded-lg border border-ink-600 px-3 py-2.5 text-center text-sm font-medium text-ink-100"
                    >
                      Iniciar sesion
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          </div>
        )}
      </header>

      {/* ---------- Contenido ---------- */}
      <main className="flex-1">{children || <Outlet />}</main>

      <Footer />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Pie de pagina                                                      */
/* ------------------------------------------------------------------ */

export function Footer() {
  const { business } = useBusiness()

  return (
    <footer className="border-t border-ink-800 bg-ink-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Marca */}
          <div className="lg:col-span-1">
            <Logo to={null} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-400">{business.description}</p>
            <div className="mt-4 flex gap-2">
              {business.social?.instagram && (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-850 text-ink-300">
                  <Instagram className="h-4 w-4" />
                </span>
              )}
              {business.social?.facebook && (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-850 text-ink-300">
                  <Facebook className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>

          {/* Enlaces */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-200">Navegacion</h3>
            <ul className="mt-4 space-y-2.5">
              {PUBLIC_NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-sm text-ink-400 transition hover:text-gold-400">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-200">Contacto</h3>
            <ul className="mt-4 space-y-3 text-sm text-ink-400">
              {business.address && (
                <li className="flex gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500/70" />
                  <span>{business.address}</span>
                </li>
              )}
              {business.phone && (
                <li className="flex gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-500/70" />
                  <a href={`tel:${business.phone}`} className="transition hover:text-gold-400">
                    {formatPhone(business.phone)}
                  </a>
                </li>
              )}
              {business.email && (
                <li className="flex gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-500/70" />
                  <a href={`mailto:${business.email}`} className="transition hover:text-gold-400">
                    {business.email}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Horario */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-200">Horario</h3>
            <ul className="mt-4 space-y-1.5 text-sm">
              {/* Se muestra de lunes a domingo, no en el orden interno */}
              {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
                const key = OPENING_HOURS_KEYS[dayIndex]
                const hours = business.openingHours?.[key]
                return (
                  <li key={key} className="flex justify-between gap-4">
                    <span className="text-ink-400">{capitalize(WEEKDAYS[dayIndex])}</span>
                    <span className={hours?.closed ? 'text-ink-600' : 'text-ink-200'}>
                      {hours?.closed
                        ? 'Cerrado'
                        : `${formatTime12(hours?.open)} - ${formatTime12(hours?.close)}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-ink-800 pt-6 sm:flex-row">
          <p className="text-xs text-ink-500">
            &copy; {new Date().getFullYear()} {business.name}. Todos los derechos reservados.
          </p>
          <p className="text-xs text-ink-600">Hecho con oficio, tijera y navaja.</p>
        </div>
      </div>
    </footer>
  )
}

export default PublicLayout
