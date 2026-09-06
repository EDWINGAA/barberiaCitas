import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarCheck, GraduationCap, Mail, Phone, UserPlus, User } from 'lucide-react'

import { validateRegister } from '@/utils/validation'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useForm } from '@/hooks/useForm'
import { Button, Card, FormError, Input, PasswordInput } from '@/components/ui'
import { Logo } from '@/components/layout/Logo'

/**
 * Registro publico.
 *
 * IMPORTANTE: siempre crea la cuenta con rol "cliente". Las cuentas de
 * barbero las da de alta el administrador desde su panel, nunca desde
 * aqui, y por eso no hay ningun selector de rol en esta pantalla.
 */
export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [serverError, setServerError] = useState('')

  const form = useForm(
    { name: '', email: '', phone: '', password: '', confirmPassword: '' },
    validateRegister
  )

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError('')
    try {
      await signUp({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        password: values.password,
      })
      toast.success('Cuenta creada. Ya puedes agendar tu primera cita.')
      navigate('/cliente', { replace: true })
    } catch (error) {
      setServerError(error?.message || 'No pudimos crear tu cuenta.')
    }
  })

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
              <h1 className="text-xl font-bold text-ink-50">Crea tu cuenta</h1>
              <p className="mt-1.5 text-sm text-ink-400">
                Es gratis y te toma menos de un minuto.
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
              <FormError message={serverError} />

              <Input
                label="Nombre completo"
                name="name"
                autoComplete="name"
                placeholder="Juan Perez"
                icon={User}
                value={form.values.name}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.errorOf('name')}
                required
              />

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

              <Input
                label="Telefono"
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder="55 1234 5678"
                icon={Phone}
                value={form.values.phone}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.errorOf('phone')}
                hint="Lo usamos para avisarte de cambios en tu cita"
                required
              />

              <PasswordInput
                label="Contrasena"
                name="password"
                autoComplete="new-password"
                placeholder="Minimo 6 caracteres"
                value={form.values.password}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.errorOf('password')}
                required
              />

              <PasswordInput
                label="Confirma tu contrasena"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Repite la contrasena"
                value={form.values.confirmPassword}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.errorOf('confirmPassword')}
                required
              />

              <Button type="submit" fullWidth size="lg" loading={form.submitting} icon={UserPlus}>
                Crear cuenta
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-400">
              Ya tienes cuenta?{' '}
              <Link to="/login" className="font-medium text-gold-400 transition hover:text-gold-300">
                Inicia sesion
              </Link>
            </p>
          </Card>

          {/* Que gana el usuario al registrarse */}
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            <li className="flex items-center gap-2.5 rounded-xl border border-ink-800 bg-ink-900/60 px-3 py-2.5 text-xs text-ink-400">
              <CalendarCheck className="h-4 w-4 shrink-0 text-gold-500/80" />
              Agenda y reagenda cuando quieras
            </li>
            <li className="flex items-center gap-2.5 rounded-xl border border-ink-800 bg-ink-900/60 px-3 py-2.5 text-xs text-ink-400">
              <GraduationCap className="h-4 w-4 shrink-0 text-gold-500/80" />
              Inscribete a los cursos de la escuela
            </li>
          </ul>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-600">
            Las cuentas de barbero las crea el administrador de la barberia. Este registro crea
            siempre una cuenta de cliente.
          </p>
        </div>
      </div>
    </div>
  )
}
