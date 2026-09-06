import { Link } from 'react-router-dom'
import { Home, Scissors } from 'lucide-react'

import { ROLE_HOME } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui'

/** Pagina 404. */
export default function NotFound() {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />

      <div className="relative text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/10 text-gold-400">
          <Scissors className="h-8 w-8" />
        </span>

        <p className="mt-8 font-display text-8xl tracking-wider text-gradient-gold">404</p>

        <h1 className="mt-2 text-2xl font-bold text-ink-50">Aqui no hay nada que cortar</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-400">
          La pagina que buscas no existe o cambio de sitio. Vuelve al inicio y sigue desde ahi.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button to="/" icon={Home}>
            Ir al inicio
          </Button>
          {isAuthenticated && (
            <Button to={ROLE_HOME[user.role]} variant="outline">
              Ir a mi panel
            </Button>
          )}
        </div>

        <p className="mt-8 text-xs text-ink-600">
          O echa un vistazo a{' '}
          <Link to="/cursos" className="text-gold-500 transition hover:text-gold-400">
            nuestros cursos
          </Link>
        </p>
      </div>
    </div>
  )
}
