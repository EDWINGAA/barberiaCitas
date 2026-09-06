import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, KeyRound, LogIn, Mail, ShieldCheck, Users } from 'lucide-react'

import { ROLE_HOME } from '@/constants'
import { validateLogin } from '@/utils/validation'
import { DEMO_CREDENTIALS } from '@/data/seed'
import { isMockMode } from '@/services'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useForm } from '@/hooks/useForm'
import { Button, Card, FormError, Input, PasswordInput } from '@/components/ui'
import { Logo } from '@/components/layout/Logo'

/**
 * Pantalla unica de inicio de sesion.
 *
 * NO hay selector de rol: el rol se lee del perfil de la cuenta y la
 * redireccion posterior depende de el.
 */
export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [serverError, setServerError] = useState('')

  // Si el usuario llego aqui por una ruta protegida, volvemos ahi
  const from = location.state?.from?.pathname

  const form = useForm({ email: '', password: '' }, validateLogin)

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError('')
    try {
      const profile = await signIn(values.email, values.password)
      toast.success(`Bienvenido de vuelta, ${profile.name.split(' ')[0]}.`)
      navigate(from || ROLE_HOME[profile.role] || '/', { replace: true })
    } catch (error) {
      setServerError(error?.message || 'No pudimos iniciar tu sesion.')
    }
  })

  /** Rellena el formulario con una cuenta de prueba y entra directo */
  async function useDemoAccount(credential) {
    form.setMany({ email: credential.email, password: credential.password })
    setServerError('')
    try {
      const profile = await signIn(credential.email, credential.password)
      toast.success(`Sesion iniciada como ${credential.label.toLowerCase()}.`)
      navigate(ROLE_HOME[profile.role] || '/', { replace: true })
    } catch (error) {
      setServerError(error?.message || 'No pudimos iniciar tu sesion.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-950">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

      <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-ink-400 transition hover:text-gold-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>

          <div className="mb-8 flex justify-center">
            <Logo to={null} size="lg" />
          </div>

          <Card className="p-6 sm:p-8">
            <div className="text-center">
              <h1 className="text-xl font-bold text-ink-50">Inicia sesion</h1>
              <p className="mt-1.5 text-sm text-ink-400">
                Accede a tus citas, tus cursos y tu panel.
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
              <FormError message={serverError} />

              <Input
                label="Correo electronico"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="tucorreo@ejemplo.com"
                icon={Mail}
                value={form.values.email}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.errorOf('email')}
                required
              />

              <PasswordInput
                label="Contrasena"
                name="password"
                autoComplete="current-password"
                placeholder="Tu contrasena"
                value={form.values.password}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.errorOf('password')}
                required
              />

              <Button type="submit" fullWidth size="lg" loading={form.submitting} icon={LogIn}>
                Entrar
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-400">
              No tienes cuenta?{' '}
              <Link to="/registro" className="font-medium text-gold-400 transition hover:text-gold-300">
                Registrate gratis
              </Link>
            </p>
          </Card>

          {/* ---------- Cuentas de prueba (solo en MODO DEMO) ---------- */}
          {isMockMode && <DemoCredentialsBox onPick={useDemoAccount} disabled={form.submitting} />}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Recuadro de credenciales de demostracion                           */
/* ------------------------------------------------------------------ */

const ROLE_ICONS = {
  admin: ShieldCheck,
  barbero: KeyRound,
  cliente: Users,
}

function DemoCredentialsBox({ onPick, disabled }) {
  return (
    <div className="mt-5 rounded-2xl border border-gold-500/25 bg-gold-500/[0.04] p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-400">
          Cuentas de prueba (modo demo)
        </p>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-400">
        Pulsa una cuenta para entrar directo. Cada rol lleva a su propio panel.
      </p>

      <ul className="mt-3 space-y-2">
        {DEMO_CREDENTIALS.map((credential) => {
          const Icon = ROLE_ICONS[credential.role] || Users
          return (
            <li key={credential.email}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(credential)}
                className="flex w-full items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/70 p-3 text-left transition hover:border-gold-500/40 hover:bg-ink-850 disabled:opacity-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-500/10 text-gold-400">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-ink-100">{credential.label}</span>
                  <span className="block truncate font-mono text-[11px] text-ink-400">
                    {credential.email} / {credential.password}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
