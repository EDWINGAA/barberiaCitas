import { useState } from 'react'
import { AtSign, Mail, Phone, Save, ShieldCheck, User } from 'lucide-react'

import { ROLES, ROLE_LABELS } from '@/constants'
import { formatTimestamp } from '@/utils/date'
import { validateProfile } from '@/utils/validation'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useForm } from '@/hooks/useForm'
import {
  Avatar,
  Badge,
  Button,
  Card,
  FormError,
  ImageUpload,
  Input,
  Textarea,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * Edicion del perfil.
 * La comparten los tres roles: el bloque de biografia y especialidades
 * solo aparece para barberos, que son quienes lo muestran al publico.
 */
export default function Profile() {
  const { user, updateProfile } = useAuth()
  const toast = useToast()
  const [serverError, setServerError] = useState('')
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '')
  const [specialties, setSpecialties] = useState((user?.specialties || []).join(', '))

  const isBarber = user?.role === ROLES.BARBERO

  const form = useForm(
    {
      name: user?.name || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
    },
    validateProfile
  )

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError('')
    try {
      await updateProfile({
        name: values.name.trim(),
        phone: values.phone.trim(),
        bio: values.bio.trim(),
        photoURL,
        ...(isBarber
          ? {
              specialties: specialties
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
      })
      toast.success('Perfil actualizado.')
    } catch (error) {
      setServerError(error?.message || 'No pudimos guardar los cambios.')
    }
  })

  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Mi perfil"
        description="Actualiza tus datos personales y tu foto."
      />

      <div className="space-y-6">
        {/* ---------- Resumen de la cuenta ---------- */}
        <Card className="flex flex-wrap items-center gap-5">
          <Avatar src={photoURL} name={user.name} size="xl" ring />

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-ink-50">{user.name}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-400">
              <AtSign className="h-3.5 w-3.5" />
              {user.email}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                icon={ShieldCheck}
                className="bg-gold-500/10 text-gold-300 ring-gold-500/25"
              >
                {ROLE_LABELS[user.role]}
              </Badge>
              <Badge className={user.active ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25' : ''}>
                {user.active ? 'Cuenta activa' : 'Cuenta desactivada'}
              </Badge>
            </div>
          </div>

          <div className="text-right text-xs text-ink-500">
            <p>Miembro desde</p>
            <p className="mt-0.5 text-ink-400">{formatTimestamp(user.createdAt).split(' ')[0]}</p>
          </div>
        </Card>

        {/* ---------- Formulario ---------- */}
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <Card>
            <h3 className="text-base font-semibold text-ink-100">Datos personales</h3>

            <div className="mt-5 space-y-4">
              <FormError message={serverError} />

              <Input
                label="Nombre completo"
                name="name"
                icon={User}
                value={form.values.name}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.errorOf('name')}
                required
              />

              <Input
                label="Telefono"
                name="phone"
                type="tel"
                icon={Phone}
                placeholder="55 1234 5678"
                value={form.values.phone}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.errorOf('phone')}
              />

              <Input
                label="Correo electronico"
                icon={Mail}
                value={user.email}
                disabled
                hint="El correo es tu identificador y no se puede cambiar."
              />
            </div>
          </Card>

          {/* Foto de perfil */}
          <Card>
            <h3 className="text-base font-semibold text-ink-100">Foto de perfil</h3>
            <p className="mt-1 text-sm text-ink-400">
              {isBarber
                ? 'Esta foto se muestra en la pagina publica de barberos.'
                : 'Ayuda a tu barbero a reconocerte al llegar.'}
            </p>

            <div className="mt-5 max-w-xs">
              <ImageUpload
                label={null}
                value={photoURL}
                onChange={setPhotoURL}
                path={`users/${user.uid}`}
                aspect="aspect-square"
                rounded="rounded-2xl"
                hint="Cuadrada, JPG o PNG"
              />
            </div>
          </Card>

          {/* Datos publicos del barbero */}
          {isBarber && (
            <Card>
              <h3 className="text-base font-semibold text-ink-100">Tu perfil publico</h3>
              <p className="mt-1 text-sm text-ink-400">
                Lo que los clientes leen antes de elegirte.
              </p>

              <div className="mt-5 space-y-4">
                <Textarea
                  label="Biografia"
                  name="bio"
                  rows={4}
                  placeholder="Cuenta tu trayectoria, tu estilo y en que eres el mejor."
                  value={form.values.bio}
                  onChange={form.handleChange}
                  maxLength={400}
                  hint={`${form.values.bio.length} / 400 caracteres`}
                />

                <Input
                  label="Especialidades"
                  value={specialties}
                  onChange={(e) => setSpecialties(e.target.value)}
                  placeholder="Corte clasico, Afeitado a navaja, Fade"
                  hint="Separalas con comas. Se muestran como etiquetas."
                />
              </div>
            </Card>
          )}

          <div className="flex justify-end">
            <Button type="submit" loading={form.submitting} icon={Save} size="lg">
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
