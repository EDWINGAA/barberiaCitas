import { Clock, Instagram, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'

import { OPENING_HOURS_KEYS, WEEKDAYS } from '@/constants'
import { capitalize, formatPhone } from '@/utils/format'
import { formatTime12, todayISO, weekdayOf } from '@/utils/date'
import { useBusiness } from '@/context/BusinessContext'
import { Card } from '@/components/ui'
import { PublicHeader } from '@/components/shared/PageHeader'

/** Datos de contacto, horario y ubicacion del negocio. */
export default function ContactPage() {
  const { business } = useBusiness()
  const todayIndex = weekdayOf(todayISO())

  return (
    <>
      <PublicHeader
        eyebrow="Visitanos"
        title="Contacto"
        description="Estamos en el corazon de la ciudad. Pasa a saludar o escribenos antes de venir."
      />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Datos de contacto */}
          <Card className="p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-ink-50">Como localizarnos</h2>

            <ul className="mt-6 space-y-5">
              <li className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-200">Direccion</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-400">{business.address}</p>
                </div>
              </li>

              {business.phone && (
                <li className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
                    <Phone className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink-200">Telefono</p>
                    <a
                      href={`tel:${business.phone}`}
                      className="mt-1 block text-sm text-ink-400 transition hover:text-gold-400"
                    >
                      {formatPhone(business.phone)}
                    </a>
                  </div>
                </li>
              )}

              {business.email && (
                <li className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
                    <Mail className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink-200">Correo</p>
                    <a
                      href={`mailto:${business.email}`}
                      className="mt-1 block text-sm text-ink-400 transition hover:text-gold-400"
                    >
                      {business.email}
                    </a>
                  </div>
                </li>
              )}

              {business.social?.whatsapp && (
                <li className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink-200">WhatsApp</p>
                    <a
                      href={`https://wa.me/52${business.social.whatsapp}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-sm text-ink-400 transition hover:text-gold-400"
                    >
                      Escribenos por WhatsApp
                    </a>
                  </div>
                </li>
              )}

              {business.social?.instagram && (
                <li className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
                    <Instagram className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink-200">Instagram</p>
                    <p className="mt-1 text-sm text-ink-400">{business.social.instagram}</p>
                  </div>
                </li>
              )}
            </ul>
          </Card>

          {/* Horario semanal */}
          <Card className="p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-50">
              <Clock className="h-5 w-5 text-gold-500/80" />
              Horario de atencion
            </h2>

            <ul className="mt-6 divide-y divide-ink-800">
              {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
                const key = OPENING_HOURS_KEYS[dayIndex]
                const hours = business.openingHours?.[key]
                const isToday = dayIndex === todayIndex

                return (
                  <li
                    key={key}
                    className={`flex items-center justify-between gap-4 py-3 ${
                      isToday ? 'rounded-lg bg-gold-500/[0.06] px-3' : ''
                    }`}
                  >
                    <span className={`text-sm ${isToday ? 'font-medium text-gold-300' : 'text-ink-300'}`}>
                      {capitalize(WEEKDAYS[dayIndex])}
                      {isToday && <span className="ml-2 text-[11px] text-gold-500">hoy</span>}
                    </span>
                    <span className={`text-sm ${hours?.closed ? 'text-ink-600' : 'text-ink-200'}`}>
                      {hours?.closed
                        ? 'Cerrado'
                        : `${formatTime12(hours?.open)} - ${formatTime12(hours?.close)}`}
                    </span>
                  </li>
                )
              })}
            </ul>

            <p className="mt-6 rounded-xl bg-ink-850 p-4 text-xs leading-relaxed text-ink-400">
              Atendemos con cita previa para garantizarte tu horario. Si llegas sin cita, te
              acomodamos en el primer hueco libre del dia.
            </p>
          </Card>
        </div>
      </section>
    </>
  )
}
