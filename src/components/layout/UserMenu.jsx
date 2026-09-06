import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, LayoutDashboard, LogOut, User } from 'lucide-react'

import { ROLE_HOME, ROLE_LABELS, ROLES } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { Avatar } from '@/components/ui'

/** Ruta del perfil segun el rol */
const PROFILE_PATH = {
  [ROLES.CLIENTE]: '/cliente/perfil',
  [ROLES.BARBERO]: '/barbero/perfil',
  [ROLES.ADMIN]: '/admin/perfil',
}

/**
 * Menu desplegable del usuario: avatar, nombre, rol y acciones.
 * Se cierra al pulsar fuera o con Escape.
 */
export function UserMenu({ compact = false }) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    if (!open) return undefined

    function onPointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) return null

  async function handleSignOut() {
    setOpen(false)
    try {
      await signOut()
      toast.info('Sesion cerrada. Hasta la proxima.')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(error?.message || 'No se pudo cerrar la sesion.')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-ink-800"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar src={user.photoURL} name={user.name} size="sm" />
        {!compact && (
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block max-w-[10rem] truncate text-sm font-medium text-ink-100">{user.name}</span>
            <span className="block text-[11px] text-gold-500/90">{ROLE_LABELS[user.role]}</span>
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-400 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right animate-slide-up overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-panel"
        >
          <div className="border-b border-ink-700/70 px-4 py-3">
            <p className="truncate text-sm font-medium text-ink-100">{user.name}</p>
            <p className="truncate text-xs text-ink-400">{user.email}</p>
            <span className="mt-2 inline-block rounded-full bg-gold-500/10 px-2 py-0.5 text-[11px] font-medium text-gold-400 ring-1 ring-inset ring-gold-500/25">
              {ROLE_LABELS[user.role]}
            </span>
          </div>

          <div className="p-1.5">
            <Link
              to={ROLE_HOME[user.role]}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
              role="menuitem"
            >
              <LayoutDashboard className="h-4 w-4" />
              Mi panel
            </Link>
            <Link
              to={PROFILE_PATH[user.role]}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
              role="menuitem"
            >
              <User className="h-4 w-4" />
              Editar perfil
            </Link>
          </div>

          <div className="border-t border-ink-700/70 p-1.5">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesion
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserMenu
