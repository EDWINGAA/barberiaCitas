import { useCallback, useMemo, useState } from 'react'
import { CalendarPlus, CalendarX2, History, MessageSquare, RefreshCw } from 'lucide-react'

import { APPOINTMENT_STATUS, CHAT_VISIBLE_STATUS, MIN_HOURS_BEFORE_CANCEL } from '@/constants'
import { formatLongDate, formatTime12, hoursUntil, todayISO } from '@/utils/date'
import { formatDuration } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Modal,
  Skeleton,
  SkeletonList,
  Tabs,
} from '@/components/ui'
import { AppointmentCard } from '@/components/appointments/AppointmentCard'
import { AppointmentChat } from '@/components/chat/AppointmentChat'

/**
 * "Mis citas": proximas e historial, con opcion de cancelar y reagendar.
 */
export default function MyAppointments() {
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('proximas')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [rescheduleTarget, setRescheduleTarget] = useState(null)
  const [chatTarget, setChatTarget] = useState(null)
  const [working, setWorking] = useState(false)

  const loader = useCallback(async () => {
    const [appointments, serviceList, barbers, unread] = await Promise.all([
      services.appointments.list({ clientId: user.uid }),
      services.services.list(),
      services.users.listBarbers({ activeOnly: false }),
      // El chat es accesorio: si falla no debe tumbar la lista de citas
      services.messages.unreadCounts({ userId: user.uid, role: user.role }).catch(() => ({})),
    ])
    return { appointments, serviceList, barbers, unread }
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
  const barberById = useMemo(
    () => Object.fromEntries((data?.barbers || []).map((b) => [b.uid, b])),
    [data]
  )

  const { upcoming, history } = useMemo(() => {
    const rows = data?.appointments || []
    const today = todayISO()
    const isUpcoming = (a) =>
      a.date >= today &&
      [APPOINTMENT_STATUS.PENDIENTE, APPOINTMENT_STATUS.CONFIRMADA].includes(a.status)

    return {
      upcoming: rows.filter(isUpcoming),
      history: rows
        .filter((a) => !isUpcoming(a))
        .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)),
    }
  }, [data])

  const visible = tab === 'proximas' ? upcoming : history

  /* ---------------- Acciones ---------------- */

  async function handleCancel() {
    setWorking(true)
    try {
      await services.appointments.cancel(cancelTarget.id)
      toast.success('Cita cancelada.')
      setCancelTarget(null)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos cancelar la cita.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-50">Mis citas</h1>
          <p className="mt-1.5 text-sm text-ink-400">
            Consulta lo que viene y revisa tu historial en la silla.
          </p>
        </div>
        <Button to="/cliente/agendar" icon={CalendarPlus}>
          Nueva cita
        </Button>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'proximas', label: 'Proximas', count: upcoming.length },
          { value: 'historial', label: 'Historial', count: history.length },
        ]}
        className="mb-6"
      />

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={tab === 'proximas' ? CalendarX2 : History}
          title={tab === 'proximas' ? 'No tienes citas agendadas' : 'Tu historial esta vacio'}
          description={
            tab === 'proximas'
              ? 'Reserva tu proximo corte en menos de un minuto.'
              : 'Aqui apareceran tus citas pasadas, completadas y canceladas.'
          }
          actionLabel={tab === 'proximas' ? 'Agendar una cita' : undefined}
          to={tab === 'proximas' ? '/cliente/agendar' : undefined}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((appointment) => {
            const canModify =
              [APPOINTMENT_STATUS.PENDIENTE, APPOINTMENT_STATUS.CONFIRMADA].includes(
                appointment.status
              ) && hoursUntil(appointment.date, appointment.startTime) >= MIN_HOURS_BEFORE_CANCEL

            const puedeChatear = CHAT_VISIBLE_STATUS.includes(appointment.status)
            const sinLeer = unreadByAppt[appointment.id] || 0
            const tieneAcciones = puedeChatear || canModify || tab === 'proximas'

            return (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                service={serviceById[appointment.serviceId]}
                barber={barberById[appointment.barberId]}
                perspective="cliente"
                actions={
                  !tieneAcciones ? null : (
                  <>
                    {puedeChatear && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={MessageSquare}
                        onClick={() => setChatTarget(appointment)}
                      >
                        Mensajes
                        {sinLeer > 0 && (
                          <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-ink-950">
                            {sinLeer}
                          </span>
                        )}
                      </Button>
                    )}

                    {canModify && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={RefreshCw}
                          onClick={() => setRescheduleTarget(appointment)}
                        >
                          Reagendar
                        </Button>
                        <Button
                          size="sm"
                          variant="dangerGhost"
                          icon={CalendarX2}
                          onClick={() => setCancelTarget(appointment)}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}

                    {!canModify && !puedeChatear && tab === 'proximas' && (
                      <p className="text-xs text-ink-500">
                        Faltan menos de {MIN_HOURS_BEFORE_CANCEL} h: llamanos para cualquier cambio.
                      </p>
                    )}
                  </>
                  )
                }
              />
            )
          })}
        </div>
      )}

      {/* ---------- Cancelar ---------- */}
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={working}
        title="Cancelar cita"
        message={
          cancelTarget
            ? `Vas a cancelar tu cita del ${formatLongDate(cancelTarget.date)} a las ${formatTime12(
                cancelTarget.startTime
              )}. El horario quedara libre para otro cliente.`
            : ''
        }
        confirmLabel="Si, cancelar"
      />

      {/* ---------- Chat con el barbero ---------- */}
      <AppointmentChat
        appointment={chatTarget}
        me={user}
        counterpart={chatTarget ? barberById[chatTarget.barberId] : null}
        onClose={() => setChatTarget(null)}
        onActivity={refreshUnread}
      />

      {/* ---------- Reagendar ---------- */}
      <RescheduleModal
        appointment={rescheduleTarget}
        service={rescheduleTarget ? serviceById[rescheduleTarget.serviceId] : null}
        barber={rescheduleTarget ? barberById[rescheduleTarget.barberId] : null}
        onClose={() => setRescheduleTarget(null)}
        onDone={async () => {
          setRescheduleTarget(null)
          await reload()
        }}
      />
    </>
  )
}

/* ================================================================== */
/*  Modal de reagendado                                                */
/* ================================================================== */

function RescheduleModal({ appointment, service, barber, onClose, onDone }) {
  const toast = useToast()
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [saving, setSaving] = useState(false)

  // Al abrir el modal, se parte de la fecha actual de la cita
  const currentDate = appointment?.date || ''
  const activeDate = date || currentDate

  const slotsLoader = useCallback(async () => {
    if (!appointment || !activeDate) return []
    return services.appointments.getAvailableSlots({
      barberId: appointment.barberId,
      date: activeDate,
      serviceId: appointment.serviceId,
      ignoreAppointmentId: appointment.id,
    })
  }, [appointment, activeDate])

  const { data: slots, loading } = useAsync(slotsLoader, [appointment?.id, activeDate], {
    enabled: Boolean(appointment && activeDate),
    initialData: [],
  })

  async function handleSave() {
    if (!startTime) {
      toast.warning('Elige un horario nuevo.')
      return
    }
    setSaving(true)
    try {
      await services.appointments.reschedule(appointment.id, { date: activeDate, startTime })
      toast.success('Cita reagendada. Te esperamos en el nuevo horario.')
      setDate('')
      setStartTime('')
      await onDone()
    } catch (error) {
      toast.error(error?.message || 'No pudimos reagendar la cita.')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setDate('')
    setStartTime('')
    onClose()
  }

  return (
    <Modal
      open={Boolean(appointment)}
      onClose={handleClose}
      title="Reagendar cita"
      description={service ? `${service.name} con ${barber?.name}` : ''}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!startTime}>
            Guardar cambio
          </Button>
        </>
      }
    >
      {appointment && (
        <div className="space-y-5">
          <Card className="bg-ink-850 p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">Horario actual</p>
            <p className="mt-1 text-sm text-ink-200">
              {formatLongDate(appointment.date)} a las {formatTime12(appointment.startTime)}
            </p>
          </Card>

          <div>
            <label htmlFor="reschedule-date" className="mb-1.5 block text-sm font-medium text-ink-200">
              Nueva fecha
            </label>
            <input
              id="reschedule-date"
              type="date"
              min={todayISO()}
              value={activeDate}
              onChange={(e) => {
                setDate(e.target.value)
                setStartTime('')
              }}
              className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink-200">
              Horarios disponibles
              {service && (
                <span className="ml-2 text-xs font-normal text-ink-500">
                  ({formatDuration(service.duration)})
                </span>
              )}
            </p>

            {loading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-ink-400">
                No hay horarios libres ese dia. Prueba con otra fecha.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => setStartTime(slot.time)}
                    className={`rounded-lg border py-2.5 text-sm font-medium transition ${
                      startTime === slot.time
                        ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                        : 'border-ink-700 bg-ink-850 text-ink-200 hover:border-gold-500/50'
                    }`}
                  >
                    {formatTime12(slot.time)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
