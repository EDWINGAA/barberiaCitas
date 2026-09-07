import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Scissors,
  Sparkles,
  User,
} from 'lucide-react'

import {
  BARBER_SORT,
  BARBER_SORT_LABELS,
  OFFERING_ORIGIN,
  SLOT_STEP_MINUTES,
} from '@/constants'
import { cn, formatMoney } from '@/utils/format'
import {
  addDays,
  formatDayChip,
  formatDuration,
  formatLongDate,
  formatTime12,
  todayISO,
  weekdayOf,
} from '@/utils/date'
import { getOpeningForDate } from '@/utils/schedule'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useBusiness } from '@/context/BusinessContext'
import { useToast } from '@/context/ToastContext'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Select,
  Skeleton,
  SkeletonList,
  Textarea,
} from '@/components/ui'

/** Numero de dias que se ofrecen para elegir fecha */
const DAYS_AHEAD = 28

const STEPS = [
  { key: 'service', label: 'Servicio', icon: Scissors },
  { key: 'barber', label: 'Barbero', icon: User },
  { key: 'date', label: 'Fecha', icon: CalendarDays },
  { key: 'time', label: 'Horario', icon: Clock },
  { key: 'confirm', label: 'Confirmar', icon: Check },
]

/**
 * Asistente de reserva paso a paso:
 * servicio -> barbero -> fecha -> hora disponible -> confirmar.
 *
 * Los horarios disponibles los calcula el servicio, que ya descuenta
 * citas existentes, bloqueos del barbero y sesiones de curso.
 */
export default function BookAppointment() {
  const { user } = useAuth()
  const { business } = useBusiness()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState(searchParams.get('servicio') || '')
  const [barberId, setBarberId] = useState(searchParams.get('barbero') || '')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  // Como se ordena la lista de barberos del paso 2
  const [sortBy, setSortBy] = useState(BARBER_SORT.NOMBRE)

  /* ---------------- Paso 1: servicios reservables ---------------- */
  // Trae el catalogo de la barberia mas los servicios propios de cada
  // barbero, cada uno con su rango de precios.
  const catalogLoader = useCallback(() => services.barberServices.listBookableServices(), [])

  const { data: catalogo, loading: loadingCatalog } = useAsync(catalogLoader, [], {
    initialData: [],
  })

  const service = useMemo(
    () => (catalogo || []).find((s) => s.id === serviceId) || null,
    [catalogo, serviceId]
  )

  /* ---------------- Paso 2: quien ofrece ese servicio ---------------- */
  // Cada barbero pone su propio precio y su propia duracion, asi que la
  // lista depende del servicio elegido en el paso anterior.
  const barbersLoader = useCallback(async () => {
    if (!serviceId) return []
    return services.barberServices.listBarbersForService({ serviceId })
  }, [serviceId])

  const { data: opciones, loading: loadingBarbers } = useAsync(barbersLoader, [serviceId], {
    enabled: Boolean(serviceId),
    initialData: [],
  })

  const seleccion = useMemo(
    () => (opciones || []).find((o) => o.barber.uid === barberId) || null,
    [opciones, barberId]
  )
  const barber = seleccion?.barber || null

  /* ---------------- Presupuesto, solo al final ---------------- */
  // El precio se pide una sola vez, cuando ya hay barbero y servicio.
  // El cliente nunca ve las tarifas del resto del equipo.
  const quoteLoader = useCallback(async () => {
    if (!barberId || !serviceId) return null
    return services.barberServices.getQuote({ barberId, serviceId })
  }, [barberId, serviceId])

  const { data: offering, loading: loadingQuote } = useAsync(quoteLoader, [barberId, serviceId], {
    enabled: Boolean(barberId && serviceId),
    initialData: null,
  })

  // Si el barbero elegido no ofrece el nuevo servicio, se descarta
  useEffect(() => {
    if (!barberId || loadingBarbers) return
    if (opciones.length && !opciones.some((o) => o.barber.uid === barberId)) {
      setBarberId('')
    }
  }, [opciones, barberId, loadingBarbers])

  /**
   * Orden de la lista de barberos.
   * Los criterios son neutrales a proposito: nada de ordenar por precio,
   * que es justo lo que empuja a elegir siempre al mas barato.
   */
  const ordenados = useMemo(() => {
    const filas = [...(opciones || [])]
    if (sortBy === BARBER_SORT.VETERANIA) {
      return filas.sort((a, b) =>
        String(a.barber.createdAt).localeCompare(String(b.barber.createdAt))
      )
    }
    return filas.sort((a, b) => a.barber.name.localeCompare(b.barber.name, 'es'))
  }, [opciones, sortBy])

  /* ---------------- Horarios del dia elegido ---------------- */
  const slotsLoader = useCallback(async () => {
    if (!barberId || !date || !serviceId) return []
    return services.appointments.getAvailableSlots({ barberId, date, serviceId })
  }, [barberId, date, serviceId])

  const { data: slots, loading: loadingSlots } = useAsync(slotsLoader, [barberId, date, serviceId], {
    enabled: Boolean(barberId && date && serviceId),
    initialData: [],
  })

  // Si cambia la fecha, la hora elegida deja de ser valida
  useEffect(() => {
    setStartTime('')
  }, [date, barberId, serviceId])

  /* ---------------- Dias seleccionables ---------------- */
  const days = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)).map((iso) => ({
      iso,
      closed: !getOpeningForDate(business.openingHours, iso),
      weekday: weekdayOf(iso),
    }))
  }, [business.openingHours])

  /* ---------------- Navegacion entre pasos ---------------- */
  const canContinue = [
    Boolean(serviceId),
    Boolean(barberId),
    Boolean(date),
    Boolean(startTime),
    true,
  ][step]

  function goNext() {
    if (step < STEPS.length - 1) setStep(step + 1)
  }
  function goBack() {
    if (step > 0) setStep(step - 1)
  }

  /* ---------------- Confirmacion ---------------- */
  async function handleConfirm() {
    setSaving(true)
    try {
      await services.appointments.create({
        clientId: user.uid,
        barberId,
        serviceId,
        date,
        startTime,
        notes: notes.trim(),
      })
      toast.success('Cita agendada. Te esperamos.')
      navigate('/cliente/citas')
    } catch (error) {
      toast.error(error?.message || 'No pudimos agendar tu cita.')
      // Un conflicto de horario obliga a volver a elegir hora
      if (String(error?.code || '').includes('conflict')) setStep(3)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink-50">Agendar una cita</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          Cuatro pasos y listo. Solo veras horarios realmente disponibles.
        </p>
      </header>

      {/* ---------- Indicador de pasos ---------- */}
      <ol className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((item, index) => {
          const done = index < step
          const active = index === step
          return (
            <li key={item.key} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                // Solo se puede retroceder a pasos ya completados
                onClick={() => index < step && setStep(index)}
                disabled={index > step}
                className={cn(
                  'flex min-w-max items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition',
                  active && 'bg-gold-500/15 text-gold-300 ring-1 ring-inset ring-gold-500/30',
                  done && 'text-emerald-400 hover:bg-ink-850',
                  !active && !done && 'text-ink-500'
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                    active && 'bg-gold-500 text-ink-950',
                    done && 'bg-emerald-500/20 text-emerald-400',
                    !active && !done && 'bg-ink-800 text-ink-500'
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                {item.label}
              </button>
              {index < STEPS.length - 1 && (
                <span className="hidden h-px flex-1 bg-ink-800 sm:block" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>

      {/* ---------- Paso 1: servicio ---------- */}
      {step === 0 && (
        <Card>
          <h2 className="text-base font-semibold text-ink-100">Que te vas a hacer?</h2>
          <p className="mt-1 text-sm text-ink-400">Elige el servicio que necesitas.</p>

          <div className="mt-5 space-y-3">
            {loadingCatalog ? (
              <SkeletonList rows={4} />
            ) : catalogo.length === 0 ? (
              <EmptyState
                icon={Scissors}
                title="No hay servicios disponibles"
                description="Vuelve a intentarlo mas tarde."
                compact
              />
            ) : (
              catalogo.map((item) => {
                const propio = item.origin === OFFERING_ORIGIN.PROPIO
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setServiceId(item.id)
                      setStep(1)
                    }}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition',
                      serviceId === item.id
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-ink-700 bg-ink-850 hover:border-ink-600'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                        propio ? 'bg-violet-500/10 text-violet-300' : 'bg-gold-500/10 text-gold-400'
                      )}
                    >
                      {propio ? <Sparkles className="h-5 w-5" /> : <Scissors className="h-5 w-5" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink-100">{item.name}</span>
                        {propio && (
                          <Badge
                            size="xs"
                            className="bg-violet-500/10 text-violet-300 ring-violet-500/25"
                          >
                            Exclusivo
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-400">
                        {item.description}
                      </span>
                      <span className="mt-1.5 block text-xs text-ink-500">
                        Alrededor de {formatDuration(item.approxDuration)} ·{' '}
                        {item.barberCount === 1 ? '1 barbero' : `${item.barberCount} barberos`}
                      </span>

                      {/* En movil las fotos van bajo el texto, sin apretar la fila */}
                      <BarberStack barbers={item.barbers} className="mt-2 sm:hidden" />
                    </span>

                    {/* En pantallas anchas, alineadas a la derecha */}
                    <BarberStack
                      barbers={item.barbers}
                      className="hidden shrink-0 self-center pr-1 sm:flex"
                    />

                    <ChevronRight className="h-5 w-5 shrink-0 text-ink-600" />
                  </button>
                )
              })
            )}
          </div>

          {/* El precio llega al final, no aqui */}
          <p className="mt-5 flex gap-2 rounded-xl bg-ink-850 px-4 py-3 text-xs leading-relaxed text-ink-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500/70" />
            El precio depende del barbero que elijas. Lo veras en el ultimo paso, antes de
            confirmar.
          </p>
        </Card>
      )}

      {/* ---------- Paso 2: barbero ---------- */}
      {step === 1 && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-ink-100">Con quien quieres cortarte?</h2>
              <p className="mt-1 text-sm text-ink-400">
                Estos son los barberos que hacen{' '}
                <span className="text-ink-200">{service?.name}</span>. Elige con calma: el precio
                lo veras al final.
              </p>
            </div>

            {/* Orden de la lista: alfabetico o por precio */}
            {ordenados.length > 1 && (
              <div className="w-full sm:w-56">
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Ordenar barberos"
                  options={Object.values(BARBER_SORT).map((value) => ({
                    value,
                    label: BARBER_SORT_LABELS[value],
                  }))}
                />
              </div>
            )}
          </div>

          {/* Lista vertical: se lee de arriba abajo, todo alineado */}
          <div className="mt-5 overflow-hidden rounded-xl border border-ink-700">
            {loadingBarbers ? (
              <div className="space-y-px">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-none" />
                ))}
              </div>
            ) : ordenados.length === 0 ? (
              <EmptyState
                icon={User}
                title="Ningun barbero ofrece este servicio"
                description="Vuelve al paso anterior y elige otro servicio."
                compact
                action={
                  <Button variant="outline" size="sm" onClick={() => setStep(0)}>
                    Cambiar servicio
                  </Button>
                }
              />
            ) : (
              ordenados.map(({ barber: item }, index) => {
                const elegido = barberId === item.uid

                return (
                  <button
                    key={item.uid}
                    type="button"
                    onClick={() => {
                      setBarberId(item.uid)
                      setStep(2)
                    }}
                    className={cn(
                      'grid w-full gap-x-4 gap-y-2 p-4 text-left transition',
                      'grid-cols-[auto_minmax(0,1fr)_auto]',
                      index > 0 && 'border-t border-ink-800',
                      elegido ? 'bg-gold-500/10' : 'hover:bg-ink-850'
                    )}
                  >
                    {/* Avatar */}
                    <span className="row-span-2 self-start">
                      <Avatar src={item.photoURL} name={item.name} size="lg" ring={elegido} />
                    </span>

                    {/* Nombre y datos. Sin precio: se elige a la persona */}
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'block text-sm font-semibold',
                          elegido ? 'text-gold-300' : 'text-ink-100'
                        )}
                      >
                        {item.name}
                      </span>

                      {item.specialties?.length > 0 && (
                        <span className="mt-1 block truncate text-[11px] uppercase tracking-wider text-gold-500/80">
                          {item.specialties.slice(0, 3).join(' · ')}
                        </span>
                      )}

                      <span className="mt-1.5 line-clamp-2 block text-xs leading-relaxed text-ink-400">
                        {item.bio}
                      </span>
                    </span>

                    <span className="row-span-2 shrink-0 self-center">
                      {elegido ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gold-400">
                          <Check className="h-3.5 w-3.5" />
                          Elegido
                        </span>
                      ) : (
                        <ChevronRight className="h-5 w-5 text-ink-600" />
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </Card>
      )}

      {/* ---------- Paso 3: fecha ---------- */}
      {step === 2 && (
        <Card>
          <h2 className="text-base font-semibold text-ink-100">Que dia te viene bien?</h2>
          <p className="mt-1 text-sm text-ink-400">
            Los dias en gris son los que la barberia permanece cerrada.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {days.map((day) => (
              <button
                key={day.iso}
                type="button"
                disabled={day.closed}
                onClick={() => {
                  setDate(day.iso)
                  setStep(3)
                }}
                className={cn(
                  'rounded-xl border px-2 py-3 text-center transition',
                  day.closed && 'cursor-not-allowed border-ink-800 bg-ink-900/40 text-ink-700',
                  !day.closed &&
                    date === day.iso &&
                    'border-gold-500 bg-gold-500/15 text-gold-300',
                  !day.closed &&
                    date !== day.iso &&
                    'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-500 hover:text-ink-100'
                )}
              >
                <span className="block text-[11px] uppercase tracking-wide opacity-70">
                  {formatDayChip(day.iso).split(' ')[0]}
                </span>
                <span className="mt-0.5 block text-lg font-semibold">
                  {formatDayChip(day.iso).split(' ')[1]}
                </span>
                {day.iso === todayISO() && (
                  <span className="mt-0.5 block text-[10px] text-gold-500">hoy</span>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ---------- Paso 4: horario ---------- */}
      {step === 3 && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-100">Elige tu horario</h2>
              <p className="mt-1 text-sm text-ink-400">{formatLongDate(date)}</p>
            </div>
            <span className="rounded-lg bg-ink-850 px-3 py-1.5 text-xs text-ink-400">
              Bloques de {SLOT_STEP_MINUTES} min · dura {formatDuration(offering?.duration || 0)}
            </span>
          </div>

          <div className="mt-5">
            {loadingSlots ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No quedan horarios ese dia"
                description={`${barber?.name} tiene la agenda llena o no trabaja ese dia. Prueba con otra fecha u otro barbero.`}
                compact
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                      Cambiar fecha
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                      Cambiar barbero
                    </Button>
                  </div>
                }
              />
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => {
                      setStartTime(slot.time)
                      setStep(4)
                    }}
                    className={cn(
                      'rounded-xl border py-3 text-sm font-medium transition',
                      startTime === slot.time
                        ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                        : 'border-ink-700 bg-ink-850 text-ink-200 hover:border-gold-500/50 hover:text-gold-300'
                    )}
                  >
                    {formatTime12(slot.time)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ---------- Paso 5: confirmacion ---------- */}
      {step === 4 && (
        <Card>
          <h2 className="text-base font-semibold text-ink-100">Revisa y confirma</h2>

          <dl className="mt-5 divide-y divide-ink-800 rounded-xl border border-ink-700 bg-ink-850">
            <SummaryRow icon={Scissors} label="Servicio" value={service?.name} />
            <SummaryRow
              icon={User}
              label="Barbero"
              value={
                <span className="flex items-center gap-2">
                  <Avatar src={barber?.photoURL} name={barber?.name} size="xs" />
                  {barber?.name}
                </span>
              }
            />
            <SummaryRow icon={CalendarDays} label="Fecha" value={formatLongDate(date)} />
            <SummaryRow
              icon={Clock}
              label="Horario"
              value={`${formatTime12(startTime)} · ${formatDuration(offering?.duration || 0)}`}
            />
          </dl>

          {/* El precio aparece aqui por primera vez, ya con todo elegido */}
          <div className="mt-4 rounded-xl border border-gold-500/30 bg-gold-500/5 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-ink-200">Total a pagar en el local</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Precio de {barber?.name?.split(' ')[0]} para este servicio
                </p>
              </div>

              {loadingQuote ? (
                <Skeleton className="h-9 w-28" />
              ) : (
                <span className="font-display text-3xl text-gold-400">
                  {formatMoney(offering?.price || 0)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-5">
            <Textarea
              label="Alguna indicacion para tu barbero? (opcional)"
              placeholder="Ej: prefiero el numero 2 a los lados, sin recortar el bigote..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={280}
            />
          </div>

          <Button
            fullWidth
            size="lg"
            className="mt-5"
            loading={saving}
            onClick={handleConfirm}
            icon={CheckCircle2}
          >
            Confirmar mi cita
          </Button>

          <p className="mt-3 text-center text-xs text-ink-500">
            Podras cancelarla o reagendarla hasta 2 horas antes.
          </p>
        </Card>
      )}

      {/* ---------- Navegacion inferior ---------- */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={goBack} disabled={step === 0} icon={ChevronLeft}>
          Atras
        </Button>

        {step < STEPS.length - 1 && (
          <Button variant="secondary" onClick={goNext} disabled={!canContinue} iconRight={ChevronRight}>
            Continuar
          </Button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Pila de avatares de los barberos que ofrecen un servicio.
 * Solo caras y nombres (en el title), nunca precios: da una idea rapida
 * de con quien te puedes cortar sin tener que abrir el servicio.
 */
function BarberStack({ barbers = [], className = '' }) {
  if (!barbers.length) return null
  const shown = barbers.slice(0, 4)
  const rest = barbers.length - shown.length

  return (
    <span className={cn('flex items-center', className)}>
      {shown.map((b, i) => (
        <Avatar
          key={b.uid}
          src={b.photoURL}
          name={b.name}
          size="xs"
          className={cn('ring-2 ring-ink-850', i > 0 && '-ml-2.5')}
        />
      ))}
      {rest > 0 && (
        <span className="-ml-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink-700 text-[10px] font-semibold text-ink-300 ring-2 ring-ink-850">
          +{rest}
        </span>
      )}
    </span>
  )
}

function SummaryRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <Icon className="h-4 w-4 shrink-0 text-gold-500/70" aria-hidden="true" />
      <dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-ink-100">{value}</dd>
    </div>
  )
}
