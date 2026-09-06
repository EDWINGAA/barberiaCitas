import { useEffect, useState } from 'react'
import { Clock, Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, Save, Store } from 'lucide-react'

import { OPENING_HOURS_KEYS, WEEKDAYS } from '@/constants'
import { capitalize } from '@/utils/format'
import { validateBusiness } from '@/utils/validation'
import { useBusiness } from '@/context/BusinessContext'
import { useToast } from '@/context/ToastContext'
import { useForm } from '@/hooks/useForm'
import {
  Button,
  Card,
  Checkbox,
  FormError,
  ImageUpload,
  Input,
  Textarea,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * Configuracion del negocio: identidad, contacto y horarios.
 *
 * El horario de apertura es la base del calculo de disponibilidad:
 * si un dia se marca como cerrado, deja de ofrecerse al agendar.
 */
export default function AdminBusiness() {
  const { business, update, loading: loadingBusiness } = useBusiness()
  const toast = useToast()

  const [serverError, setServerError] = useState('')
  const [logoURL, setLogoURL] = useState('')
  const [openingHours, setOpeningHours] = useState(business.openingHours)

  const form = useForm(
    {
      name: business.name || '',
      description: business.description || '',
      phone: business.phone || '',
      email: business.email || '',
      address: business.address || '',
      instagram: business.social?.instagram || '',
      facebook: business.social?.facebook || '',
      whatsapp: business.social?.whatsapp || '',
    },
    validateBusiness
  )

  // Cuando termina de cargar la configuracion, se vuelca en el formulario
  useEffect(() => {
    if (loadingBusiness) return
    form.reset({
      name: business.name || '',
      description: business.description || '',
      phone: business.phone || '',
      email: business.email || '',
      address: business.address || '',
      instagram: business.social?.instagram || '',
      facebook: business.social?.facebook || '',
      whatsapp: business.social?.whatsapp || '',
    })
    setLogoURL(business.logoURL || '')
    setOpeningHours(business.openingHours)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingBusiness, business])

  /** Cambia un campo del horario de un dia concreto */
  function setDayHours(key, patch) {
    setOpeningHours((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError('')
    try {
      await update({
        name: values.name.trim(),
        description: values.description.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        address: values.address.trim(),
        logoURL,
        openingHours,
        social: {
          instagram: values.instagram.trim(),
          facebook: values.facebook.trim(),
          whatsapp: values.whatsapp.trim(),
        },
      })
      toast.success('Configuracion guardada.')
    } catch (error) {
      setServerError(error?.message || 'No pudimos guardar la configuracion.')
    }
  })

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Mi negocio"
        description="Datos que se muestran en la web publica y horarios que rigen la disponibilidad."
      />

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <FormError message={serverError} />

        {/* ---------- Identidad ---------- */}
        <Card>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-100">
            <Store className="h-5 w-5 text-gold-500/80" />
            Identidad
          </h2>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_12rem]">
            <div className="space-y-4">
              <Input
                label="Nombre del negocio"
                name="name"
                value={form.values.name}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.errorOf('name')}
                required
              />

              <Textarea
                label="Descripcion"
                name="description"
                rows={4}
                placeholder="Que hace especial a tu barberia."
                value={form.values.description}
                onChange={form.handleChange}
                hint="Aparece en la portada y en el pie de pagina."
              />
            </div>

            <ImageUpload
              label="Logotipo"
              value={logoURL}
              onChange={setLogoURL}
              path="business"
              aspect="aspect-square"
              rounded="rounded-2xl"
              hint="Cuadrado, fondo transparente si es posible"
            />
          </div>
        </Card>

        {/* ---------- Contacto ---------- */}
        <Card>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-100">
            <MapPin className="h-5 w-5 text-gold-500/80" />
            Contacto y ubicacion
          </h2>

          <div className="mt-5 space-y-4">
            <Input
              label="Direccion"
              name="address"
              icon={MapPin}
              placeholder="Calle, numero, colonia, ciudad"
              value={form.values.address}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.errorOf('address')}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Telefono"
                name="phone"
                type="tel"
                icon={Phone}
                placeholder="55 4421 9087"
                value={form.values.phone}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.errorOf('phone')}
              />

              <Input
                label="Correo de contacto"
                name="email"
                type="email"
                icon={Mail}
                placeholder="hola@tubarberia.com"
                value={form.values.email}
                onChange={form.handleChange}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Instagram"
                name="instagram"
                icon={Instagram}
                placeholder="@tubarberia"
                value={form.values.instagram}
                onChange={form.handleChange}
              />
              <Input
                label="Facebook"
                name="facebook"
                icon={Facebook}
                placeholder="TuBarberia"
                value={form.values.facebook}
                onChange={form.handleChange}
              />
              <Input
                label="WhatsApp"
                name="whatsapp"
                icon={MessageCircle}
                placeholder="5544219087"
                value={form.values.whatsapp}
                onChange={form.handleChange}
              />
            </div>
          </div>
        </Card>

        {/* ---------- Horarios ---------- */}
        <Card>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-100">
            <Clock className="h-5 w-5 text-gold-500/80" />
            Horario de atencion
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            Determina los horarios que se ofrecen al agendar. Un dia cerrado no admite citas.
          </p>

          <div className="mt-5 space-y-2">
            {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
              const key = OPENING_HOURS_KEYS[dayIndex]
              const hours = openingHours?.[key] || { open: '10:00', close: '20:00', closed: true }

              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-ink-700 bg-ink-850 p-3"
                >
                  <span className="w-28 shrink-0 text-sm font-medium text-ink-200">
                    {capitalize(WEEKDAYS[dayIndex])}
                  </span>

                  <Checkbox
                    label="Abierto"
                    checked={!hours.closed}
                    onChange={(e) => setDayHours(key, { closed: !e.target.checked })}
                    className="shrink-0"
                  />

                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="time"
                      step={900}
                      value={hours.open}
                      disabled={hours.closed}
                      onChange={(e) => setDayHours(key, { open: e.target.value })}
                      aria-label={`Hora de apertura del ${WEEKDAYS[dayIndex]}`}
                      className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100 outline-none transition focus:border-gold-500 disabled:opacity-40"
                    />
                    <span className="text-ink-500">a</span>
                    <input
                      type="time"
                      step={900}
                      value={hours.close}
                      disabled={hours.closed}
                      onChange={(e) => setDayHours(key, { close: e.target.value })}
                      aria-label={`Hora de cierre del ${WEEKDAYS[dayIndex]}`}
                      className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100 outline-none transition focus:border-gold-500 disabled:opacity-40"
                    />
                  </div>

                  {hours.closed && (
                    <span className="rounded-lg bg-ink-800 px-2.5 py-1 text-xs text-ink-500">
                      Cerrado
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={form.submitting} icon={Save}>
            Guardar configuracion
          </Button>
        </div>
      </form>
    </div>
  )
}
