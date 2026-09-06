import { useCallback, useMemo, useState } from 'react'
import { CalendarDays, ClipboardList, Filter, Search, Trash2, X } from 'lucide-react'

import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_LABELS } from '@/constants'
import { formatMoney, formatMoneyShort, normalizeText } from '@/utils/format'
import { formatShortDate, formatTime12, todayISO } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/context/ToastContext'
import {
  AppointmentStatusBadge,
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
  SkeletonList,
  StatCard,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  ...Object.values(APPOINTMENT_STATUS).map((value) => ({
    value,
    label: APPOINTMENT_STATUS_LABELS[value],
  })),
]

/**
 * Gestion global de citas con filtros por fecha, barbero y estado.
 *
 * En pantallas grandes se muestra como tabla; en movil, cada fila se
 * convierte en una tarjeta.
 */
export default function AdminAppointments() {
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [barberId, setBarberId] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [working, setWorking] = useState(false)

  const loader = useCallback(async () => {
    const [appointments, serviceList, barbers, clients] = await Promise.all([
      services.appointments.list(),
      services.services.list(),
      services.users.listBarbers({ activeOnly: false }),
      services.users.listClients(),
    ])
    return { appointments, serviceList, barbers, clients }
  }, [])

  const { data, loading, error, reload } = useAsync(loader, [])

  const serviceById = useMemo(
    () => Object.fromEntries((data?.serviceList || []).map((s) => [s.id, s])),
    [data]
  )
  const barberById = useMemo(
    () => Object.fromEntries((data?.barbers || []).map((b) => [b.uid, b])),
    [data]
  )
  const clientById = useMemo(
    () => Object.fromEntries((data?.clients || []).map((c) => [c.uid, c])),
    [data]
  )

  const filtered = useMemo(() => {
    let rows = data?.appointments || []

    if (barberId) rows = rows.filter((a) => a.barberId === barberId)
    if (status) rows = rows.filter((a) => a.status === status)
    if (from) rows = rows.filter((a) => a.date >= from)
    if (to) rows = rows.filter((a) => a.date <= to)

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

    return rows.slice().sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))
  }, [data, barberId, status, from, to, search, clientById, serviceById])

  const summary = useMemo(() => {
    const completed = filtered.filter((a) => a.status === APPOINTMENT_STATUS.COMPLETADA)
    return {
      total: filtered.length,
      completed: completed.length,
      revenue: completed.reduce((sum, a) => sum + (Number(a.price) || 0), 0),
      noShow: filtered.filter((a) => a.status === APPOINTMENT_STATUS.NO_SHOW).length,
    }
  }, [filtered])

  const hasFilters = search || barberId || status || from || to

  function clearFilters() {
    setSearch('')
    setBarberId('')
    setStatus('')
    setFrom('')
    setTo('')
  }

  async function changeStatus(id, next) {
    try {
      await services.appointments.setStatus(id, next)
      toast.success('Estado actualizado.')
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos actualizar la cita.')
    }
  }

  async function handleDelete() {
    setWorking(true)
    try {
      await services.appointments.remove(deleteTarget.id)
      toast.success('Cita eliminada.')
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos eliminar la cita.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Todas las citas"
        description="Consulta, filtra y gestiona la agenda completa de la barberia."
      />

      {/* ---------- Resumen del filtro actual ---------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Citas listadas" value={summary.total} icon={ClipboardList} />
        <StatCard label="Completadas" value={summary.completed} icon={CalendarDays} accent="emerald" />
        <StatCard label="Inasistencias" value={summary.noShow} icon={X} accent="rose" />
        <StatCard
          label="Ingresos del filtro"
          value={formatMoneyShort(summary.revenue)}
          icon={CalendarDays}
          accent="violet"
        />
      </div>

      {/* ---------- Filtros ---------- */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-200">
          <Filter className="h-4 w-4 text-gold-500/80" />
          Filtros
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Input
            placeholder="Cliente, telefono o servicio..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar"
          />

          <Select
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
            aria-label="Barbero"
            options={[
              { value: '', label: 'Todos los barberos' },
              ...(data?.barbers || []).map((b) => ({ value: b.uid, label: b.name })),
            ]}
          />

          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Estado"
            options={STATUS_OPTIONS}
          />

          <Field label={null} htmlFor="from">
            <input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Desde"
              className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
            />
          </Field>

          <Field label={null} htmlFor="to">
            <input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Hasta"
              className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setFrom(todayISO())
                setTo(todayISO())
              }}
              className="rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs text-ink-300 transition hover:bg-ink-750"
            >
              Solo hoy
            </button>
            <button
              type="button"
              onClick={() => {
                setFrom(todayISO())
                setTo('')
              }}
              className="rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs text-ink-300 transition hover:bg-ink-750"
            >
              De hoy en adelante
            </button>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-xs text-gold-400 transition hover:text-gold-300"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      {/* ---------- Resultados ---------- */}
      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Ninguna cita coincide con los filtros"
          description="Ajusta los criterios de busqueda para ver mas resultados."
          action={
            hasFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* --- Tabla en escritorio --- */}
          <Card padded={false} className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink-800 bg-ink-850/60">
                  <tr className="text-xs uppercase tracking-wider text-ink-400">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Servicio</th>
                    <th className="px-4 py-3 font-medium">Barbero</th>
                    <th className="px-4 py-3 font-medium">Importe</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-ink-800">
                  {filtered.map((appointment) => (
                    <tr key={appointment.id} className="transition hover:bg-ink-850/50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-ink-100">{formatShortDate(appointment.date)}</span>
                        <span className="ml-2 text-xs text-ink-500">
                          {formatTime12(appointment.startTime)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={clientById[appointment.clientId]?.photoURL}
                            name={clientById[appointment.clientId]?.name}
                            size="xs"
                          />
                          <span className="truncate text-ink-200">
                            {clientById[appointment.clientId]?.name || 'Cliente'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-ink-300">
                        {serviceById[appointment.serviceId]?.name || '-'}
                      </td>

                      <td className="px-4 py-3 text-ink-300">
                        {barberById[appointment.barberId]?.name || '-'}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-gold-400">
                        {formatMoney(appointment.price)}
                      </td>

                      <td className="px-4 py-3">
                        <AppointmentStatusBadge status={appointment.status} size="xs" />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={appointment.status}
                            onChange={(e) => changeStatus(appointment.id, e.target.value)}
                            aria-label="Cambiar estado"
                            className="rounded-lg border border-ink-600 bg-ink-850 px-2 py-1.5 text-xs text-ink-200 outline-none transition focus:border-gold-500"
                          >
                            {Object.values(APPOINTMENT_STATUS).map((value) => (
                              <option key={value} value={value}>
                                {APPOINTMENT_STATUS_LABELS[value]}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(appointment)}
                            className="rounded-lg p-1.5 text-ink-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                            aria-label="Eliminar cita"
                            title="Eliminar cita"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* --- Tarjetas en movil --- */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((appointment) => (
              <Card key={appointment.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-100">
                      {clientById[appointment.clientId]?.name || 'Cliente'}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {serviceById[appointment.serviceId]?.name}
                    </p>
                  </div>
                  <AppointmentStatusBadge status={appointment.status} size="xs" />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-500">Fecha</dt>
                    <dd className="text-ink-200">
                      {formatShortDate(appointment.date)} · {formatTime12(appointment.startTime)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Barbero</dt>
                    <dd className="truncate text-ink-200">
                      {barberById[appointment.barberId]?.name || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Importe</dt>
                    <dd className="text-gold-400">{formatMoney(appointment.price)}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center gap-2 border-t border-ink-800 pt-3">
                  <select
                    value={appointment.status}
                    onChange={(e) => changeStatus(appointment.id, e.target.value)}
                    aria-label="Cambiar estado"
                    className="flex-1 rounded-lg border border-ink-600 bg-ink-850 px-2 py-2 text-xs text-ink-200 outline-none focus:border-gold-500"
                  >
                    {Object.values(APPOINTMENT_STATUS).map((value) => (
                      <option key={value} value={value}>
                        {APPOINTMENT_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="dangerGhost"
                    icon={Trash2}
                    onClick={() => setDeleteTarget(appointment)}
                  >
                    Eliminar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={working}
        title="Eliminar cita"
        message="La cita se borrara definitivamente del historial. Si solo quieres liberar el horario, cambia su estado a cancelada."
        confirmLabel="Eliminar"
      />
    </>
  )
}
