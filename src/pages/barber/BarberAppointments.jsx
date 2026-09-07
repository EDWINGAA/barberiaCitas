import { useCallback, useMemo, useState } from 'react'
import {
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Filter,
  MessageSquare,
  Phone,
  Scissors,
  Search,
  UserX,
  X,
} from 'lucide-react'

import {
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_STYLES,
  CHAT_VISIBLE_STATUS,
} from '@/constants'
import { cn, formatMoney, formatMoneyShort, normalizeText } from '@/utils/format'
import {
  addDays,
  formatDuration,
  formatRelativeDay,
  formatTime12,
  formatWeekdayDate,
  isToday,
  todayISO,
} from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  AppointmentStatusBadge,
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SkeletonList,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { AppointmentChat } from '@/components/chat/AppointmentChat'

/** Rangos rapidos de fecha */
const RANGE_OPTIONS = [
  { value: 'proximas', label: 'Proximas' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Proximos 7 dias' },
  { value: 'pasadas', label: 'Pasadas' },
  { value: 'todas', label: 'Todas' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  ...Object.values(APPOINTMENT_STATUS).map((value) => ({
    value,
    label: APPOINTMENT_STATUS_LABELS[value],
  })),
]

/**
 * Listado de citas del barbero.
 *
 * Se presenta como una agenda: las citas se agrupan por dia, con una
 * cabecera fija por jornada, y dentro de cada dia van en una sola
 * columna ordenadas por hora. Asi se lee de arriba abajo como un horario
 * real, en lugar de como una rejilla de tarjetas sueltas.
 */
export default function BarberAppointments() {
  const { user } = useAuth()
  const toast = useToast()

  const [range, setRange] = useState('proximas')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState(null)
  const [chatTarget, setChatTarget] = useState(null)

  const loader = useCallback(async () => {
    const [appointments, serviceList, clients, unread] = await Promise.all([
      services.appointments.list({ barberId: user.uid }),
      services.services.list(),
      services.users.listClients(),
      // El chat es accesorio: si falla no debe tumbar la lista de citas
      services.messages.unreadCounts({ userId: user.uid, role: user.role }).catch(() => ({})),
    ])
    return { appointments, serviceList, clients, unread }
  }, [user.uid, user.role])

  const { data, loading, error, reload, setData } = useAsync(loader, [user.uid])

  const unreadByAppt = data?.unread || {}

  /** Refresca solo los contadores de mensajes sin leer */
  const refreshUnread = useCallback(async () => {
    try {
      const unread = await services.messages.unreadCounts({ userId: user.uid, role: user.role })
      setData((prev) => (prev ? { ...prev, unread } : prev))
    } catch {
      /* los contadores son accesorios */
    }
  }, [user.uid, user.role, setData])

  const serviceById = useMemo(
    () => Object.fromEntries((data?.serviceList || []).map((s) => [s.id, s])),
    [data]
  )
  const clientById = useMemo(
    () => Object.fromEntries((data?.clients || []).map((c) => [c.uid, c])),
    [data]
  )

  /* ---------------- Filtrado ---------------- */

  const filtered = useMemo(() => {
    const today = todayISO()
    let rows = data?.appointments || []

    if (range === 'hoy') rows = rows.filter((a) => a.date === today)
    else if (range === 'proximas') rows = rows.filter((a) => a.date >= today)
    else if (range === 'semana')
      rows = rows.filter((a) => a.date >= today && a.date <= addDays(today, 7))
    else if (range === 'pasadas') rows = rows.filter((a) => a.date < today)

    if (status) rows = rows.filter((a) => a.status === status)

    if (search.trim()) {
      const q = normalizeText(search)
      rows = rows.filter((a) => {
        const client = clientById[a.clientId]
        const service = serviceById[a.serviceId]
        return (
          normalizeText(client?.name || '').includes(q) ||
          normalizeText(service?.name || '').includes(q) ||
          (client?.phone || '').includes(q)
        )
      })
    }

    // El historial se lee del dia mas reciente hacia atras; el resto,
    // hacia adelante. Dentro de cada dia siempre por hora ascendente.
    const haciaAtras = range === 'pasadas'
    return [...rows].sort((a, b) => {
      if (a.date !== b.date) {
        return haciaAtras ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
      }
      return a.startTime.localeCompare(b.startTime)
    })
  }, [data, range, status, search, clientById, serviceById])

  /** Citas agrupadas por jornada, conservando el orden ya calculado */
  const jornadas = useMemo(() => {
    const mapa = new Map()
    filtered.forEach((cita) => {
      if (!mapa.has(cita.date)) mapa.set(cita.date, [])
      mapa.get(cita.date).push(cita)
    })
    return [...mapa.entries()].map(([date, citas]) => ({
      date,
      citas,
      // Solo cuenta el dinero de lo que no esta cancelado ni perdido
      ingresos: citas
        .filter((c) => c.status !== APPOINTMENT_STATUS.CANCELADA && c.status !== APPOINTMENT_STATUS.NO_SHOW)
        .reduce((sum, c) => sum + (Number(c.price) || 0), 0),
    }))
  }, [filtered])

  const resumen = useMemo(
    () => ({
      total: filtered.length,
      pendientes: filtered.filter((a) => a.status === APPOINTMENT_STATUS.PENDIENTE).length,
      ingresos: filtered
        .filter((a) => a.status === APPOINTMENT_STATUS.COMPLETADA)
        .reduce((sum, a) => sum + (Number(a.price) || 0), 0),
    }),
    [filtered]
  )

  const hasFilters = status || search || range !== 'proximas'

  function limpiar() {
    setRange('proximas')
    setStatus('')
    setSearch('')
  }

  /** Cambia el estado de una cita */
  async function changeStatus(id, nextStatus) {
    setUpdating(id)
    try {
      await services.appointments.setStatus(id, nextStatus)
      toast.success(`Cita marcada como ${APPOINTMENT_STATUS_LABELS[nextStatus].toLowerCase()}.`)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos actualizar la cita.')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Citas"
        description="Tu agenda ordenada por dia y hora. Confirma, completa o marca inasistencias."
      />

      {/* ---------- Filtros ---------- */}
      <Card className="mb-5">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-200">
          <Filter className="h-4 w-4 text-gold-500/80" />
          Filtros
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="Buscar cliente, telefono o servicio..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar citas"
          />
          <Select
            options={RANGE_OPTIONS}
            value={range}
            onChange={(e) => setRange(e.target.value)}
            aria-label="Rango de fechas"
          />
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Estado"
          />
        </div>

        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={limpiar}
              className="inline-flex items-center gap-1.5 text-xs text-gold-400 transition hover:text-gold-300"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          </div>
        )}
      </Card>

      {/* ---------- Resumen del filtro ---------- */}
      {!loading && !error && filtered.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-ink-800 px-1 py-3 text-sm">
          <span className="text-ink-300">
            <span className="font-semibold text-ink-100">{resumen.total}</span> cita
            {resumen.total === 1 ? '' : 's'} en{' '}
            <span className="font-semibold text-ink-100">{jornadas.length}</span> dia
            {jornadas.length === 1 ? '' : 's'}
          </span>

          {resumen.pendientes > 0 && (
            <span className="text-amber-300">
              {resumen.pendientes} sin confirmar
            </span>
          )}

          {resumen.ingresos > 0 && (
            <span className="ml-auto text-ink-400">
              Completadas:{' '}
              <span className="font-semibold text-gold-400">
                {formatMoneyShort(resumen.ingresos)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* ---------- Agenda ---------- */}
      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No hay citas que mostrar"
          description={
            hasFilters
              ? 'Prueba a cambiar los filtros para ver mas resultados.'
              : 'Cuando tus clientes reserven, apareceran aqui ordenadas por dia.'
          }
          action={
            hasFilters ? (
              <Button variant="outline" size="sm" onClick={limpiar}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {jornadas.map((jornada) => (
            <section key={jornada.date}>
              <CabeceraDia jornada={jornada} />

              {/* Una sola columna: se lee de arriba abajo como un horario */}
              <div className="overflow-hidden rounded-b-2xl border-x border-b border-ink-700/70 bg-ink-900">
                {jornada.citas.map((cita, i) => (
                  <FilaCita
                    key={cita.id}
                    cita={cita}
                    servicio={serviceById[cita.serviceId]}
                    cliente={clientById[cita.clientId]}
                    primera={i === 0}
                    ocupada={updating === cita.id}
                    mensajesSinLeer={unreadByAppt[cita.id] || 0}
                    onAbrirChat={() => setChatTarget(cita)}
                    onCambiarEstado={(next) => changeStatus(cita.id, next)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <AppointmentChat
        appointment={chatTarget}
        me={user}
        counterpart={chatTarget ? clientById[chatTarget.clientId] : null}
        onClose={() => setChatTarget(null)}
        onActivity={refreshUnread}
      />
    </>
  )
}

/* ================================================================== */
/*  Cabecera de jornada                                                */
/* ================================================================== */

/** Franja fija con el dia, el numero de citas y el importe de la jornada */
function CabeceraDia({ jornada }) {
  const hoy = isToday(jornada.date)
  const titulo = formatRelativeDay(jornada.date)
  const fecha = formatWeekdayDate(jornada.date)

  // Fuera de "Hoy", "Manana" y "Ayer", formatRelativeDay ya devuelve la
  // fecha completa: ponerla otra vez al lado la escribia dos veces.
  const repetida = titulo.toLowerCase() === fecha.toLowerCase()

  return (
    <div
      className={cn(
        'sticky top-16 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-1',
        'rounded-t-2xl border border-ink-700/70 px-4 py-3 backdrop-blur sm:px-5',
        hoy ? 'border-gold-500/40 bg-gold-500/[0.07]' : 'bg-ink-850/95'
      )}
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <h2
          className={cn(
            'truncate font-display text-xl tracking-wide',
            hoy ? 'text-gold-300' : 'text-ink-100'
          )}
        >
          {titulo}
        </h2>
        {!repetida && <span className="shrink-0 text-xs text-ink-500">{fecha}</span>}
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span className="text-ink-400">
          {jornada.citas.length} cita{jornada.citas.length === 1 ? '' : 's'}
        </span>
        {jornada.ingresos > 0 && (
          <span className="font-semibold text-gold-400">{formatMoney(jornada.ingresos)}</span>
        )}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Fila de cita                                                       */
/* ================================================================== */

/**
 * Una cita en formato fila.
 *
 * En movil se lee como una ficha: arriba la hora y el estado, debajo el
 * cliente y el servicio a todo lo ancho, y al final los botones
 * repartidos en dos columnas iguales. Cada dato ocupa su propia linea,
 * asi que nada se aprieta ni se sale de la pantalla.
 *
 * A partir de "lg" todo se coloca en una sola linea con columnas fijas,
 * de modo que las horas, los nombres y los precios quedan alineados
 * entre todas las filas. La posicion de cada celda se declara con
 * col-start/row-start para poder cambiar el orden entre movil y
 * escritorio sin duplicar el contenido.
 */
function FilaCita({
  cita,
  servicio,
  cliente,
  primera,
  ocupada,
  mensajesSinLeer = 0,
  onAbrirChat,
  onCambiarEstado,
}) {
  const estilo = APPOINTMENT_STATUS_STYLES[cita.status]
  const cerrada = [APPOINTMENT_STATUS.CANCELADA, APPOINTMENT_STATUS.COMPLETADA].includes(cita.status)
  const tieneChat = CHAT_VISIBLE_STATUS.includes(cita.status)

  return (
    <article
      className={cn(
        'grid gap-x-4 gap-y-3 border-l-4 px-4 py-4 transition-colors sm:px-5',
        'grid-cols-[auto_minmax(0,1fr)]',
        'lg:grid-cols-[5rem_minmax(0,1.15fr)_minmax(0,1fr)_7.5rem_minmax(0,auto)] lg:items-center',
        estilo?.border,
        !primera && 'border-t border-t-ink-800',
        cerrada ? 'bg-ink-900' : 'bg-ink-900 hover:bg-ink-850/60'
      )}
    >
      {/* --- Hora --- */}
      <div className="lg:col-start-1 lg:row-start-1">
        <p className="font-display text-2xl leading-none tracking-wide text-ink-100">
          {cita.startTime}
        </p>
        <p className="mt-1 text-[11px] text-ink-500">a {cita.endTime}</p>
      </div>

      {/* --- Estado: en movil acompana a la hora, arriba a la derecha --- */}
      <div className="justify-self-end self-center lg:col-start-4 lg:row-start-1 lg:justify-self-start">
        <AppointmentStatusBadge status={cita.status} />
      </div>

      {/* --- Cliente --- */}
      <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1 lg:col-start-2 lg:row-start-1">
        <Avatar src={cliente?.photoURL} name={cliente?.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-100">
            {cliente?.name || 'Cliente'}
          </p>
          {cliente?.phone && (
            <a
              href={`tel:${cliente.phone}`}
              className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-500 transition hover:text-gold-400"
            >
              <Phone className="h-3 w-3 shrink-0" />
              {cliente.phone}
            </a>
          )}
        </div>
      </div>

      {/* --- Servicio --- */}
      <div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1">
        <p className="flex items-center gap-2 text-sm text-ink-200">
          <Scissors className="h-3.5 w-3.5 shrink-0 text-gold-500/70" />
          <span className="truncate">{servicio?.name || 'Servicio'}</span>
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          {formatDuration(servicio?.duration || 0)} · {formatMoney(cita.price)}
        </p>
      </div>

      {/* --- Acciones --- */}
      <div className="col-span-2 flex flex-col gap-2 lg:col-span-1 lg:col-start-5 lg:row-start-1 lg:items-end">
        {tieneChat && (
          <Button size="xs" variant="secondary" icon={MessageSquare} onClick={onAbrirChat}>
            Mensajes
            {mensajesSinLeer > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-ink-950">
                {mensajesSinLeer}
              </span>
            )}
          </Button>
        )}
        <AccionesEstado cita={cita} ocupada={ocupada} onCambiar={onCambiarEstado} />
      </div>

      {/* --- Nota del cliente, ocupa toda la fila --- */}
      {cita.notes && (
        <p className="col-span-2 flex gap-2 rounded-lg bg-ink-850/70 px-3 py-2 text-xs leading-relaxed text-ink-400 lg:col-span-4 lg:col-start-2 lg:row-start-2">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-600" />
          {cita.notes}
        </p>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/*  Botones de cambio de estado segun el estado actual                 */
/* ------------------------------------------------------------------ */

/**
 * En movil los botones van en dos columnas iguales y a todo lo ancho:
 * son mas faciles de acertar con el dedo y ninguno se corta. A partir de
 * "sm" vuelven a su tamano natural, alineados a la derecha en escritorio.
 */
function AccionesEstado({ cita, ocupada, onCambiar }) {
  const pasada = cita.date <= todayISO()

  // Una cita cerrada ya no admite cambios
  if ([APPOINTMENT_STATUS.CANCELADA, APPOINTMENT_STATUS.COMPLETADA].includes(cita.status)) {
    return <p className="text-xs text-ink-600 lg:text-right">Cerrada</p>
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
      {cita.status === APPOINTMENT_STATUS.PENDIENTE && (
        <Button
          size="xs"
          variant="outline"
          loading={ocupada}
          icon={CheckCircle2}
          onClick={() => onCambiar(APPOINTMENT_STATUS.CONFIRMADA)}
        >
          Confirmar
        </Button>
      )}

      {pasada && (
        <>
          <Button
            size="xs"
            variant="success"
            loading={ocupada}
            onClick={() => onCambiar(APPOINTMENT_STATUS.COMPLETADA)}
          >
            Completada
          </Button>
          <Button
            size="xs"
            variant="dangerGhost"
            icon={UserX}
            loading={ocupada}
            onClick={() => onCambiar(APPOINTMENT_STATUS.NO_SHOW)}
          >
            No asistio
          </Button>
        </>
      )}

      <Button
        size="xs"
        variant="ghost"
        icon={CalendarX2}
        loading={ocupada}
        onClick={() => onCambiar(APPOINTMENT_STATUS.CANCELADA)}
      >
        Cancelar
      </Button>
    </div>
  )
}
