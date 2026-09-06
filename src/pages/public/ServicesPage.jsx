import { useCallback } from 'react'
import { CalendarCheck, Clock, MapPin, Sparkles } from 'lucide-react'

import { GALLERY_LOCATIONS, ROLES } from '@/constants'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useBusiness } from '@/context/BusinessContext'
import { Button } from '@/components/ui'
import { PublicHeader } from '@/components/shared/PageHeader'
import { GalleryCarousel } from '@/components/gallery/GalleryCarousel'

/**
 * Pagina de Servicios.
 *
 * Es un escaparate visual: el carrusel de fotos de los cortes que se
 * hacen en la barberia. Las fotos las administra el administrador desde
 * su panel, en la galeria "Pagina de servicios".
 */
export default function ServicesPage() {
  const { isAuthenticated, user } = useAuth()
  const { business } = useBusiness()

  const loader = useCallback(
    () => services.gallery.list({ location: GALLERY_LOCATIONS.SERVICIOS, activeOnly: true }),
    []
  )
  const { data: fotos, loading } = useAsync(loader, [], { initialData: [] })

  const bookingLink = !isAuthenticated
    ? '/registro'
    : user?.role === ROLES.CLIENTE
      ? '/cliente/agendar'
      : '/cliente'

  return (
    <>
      <PublicHeader
        eyebrow="Nuestro trabajo"
        title="Servicios"
        description="Mira lo que sale de nuestras manos cada dia. Elige el estilo que te gusta y reserva tu silla."
      >
        <Button to={bookingLink} size="lg" icon={CalendarCheck}>
          Agendar una cita
        </Button>
      </PublicHeader>

      {/* ---------- Carrusel de trabajos ---------- */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <GalleryCarousel
          items={fotos}
          loading={loading}
          eyebrow="Galeria"
          title="Cortes hechos en casa"
          description="Fotos reales de nuestros clientes. Pulsa cualquiera para verla en grande."
          emptyTitle="Estamos preparando la galeria"
          emptyDescription="En unos dias subiremos las fotos de nuestros mejores trabajos."
        />
      </div>

      {/* ---------- Llamada a la accion ---------- */}
      <section className="border-t border-ink-800 bg-gradient-to-b from-ink-900 to-ink-950">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/10 text-gold-400">
            <Sparkles className="h-7 w-7" />
          </span>

          <h2 className="mt-6 font-display text-4xl tracking-wide text-ink-50">
            Te gusta lo que ves?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-400">
            Ensenale la foto a tu barbero al llegar y saldras exactamente asi. Reserva en menos de
            un minuto y elige con quien quieres sentarte.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button to={bookingLink} size="lg" icon={CalendarCheck}>
              Agendar mi cita
            </Button>
            <Button to="/barberos" size="lg" variant="secondary">
              Conocer al equipo
            </Button>
          </div>

          {/* Datos practicos, para no dejar la pagina coja */}
          <dl className="mx-auto mt-12 grid max-w-2xl gap-6 border-t border-ink-800 pt-8 sm:grid-cols-2">
            <div className="flex items-start gap-3 text-left">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-500/70" />
              <div>
                <dt className="text-sm font-medium text-ink-200">Donde estamos</dt>
                <dd className="mt-0.5 text-sm text-ink-400">{business.address}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gold-500/70" />
              <div>
                <dt className="text-sm font-medium text-ink-200">Horario</dt>
                <dd className="mt-0.5 text-sm text-ink-400">
                  Lunes a viernes de 10:00 a 20:00, sabados de 9:00 a 18:00
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </section>
    </>
  )
}
