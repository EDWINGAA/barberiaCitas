import { useCallback, useState } from 'react'
import { Ban, CalendarOff, Plus, Trash2 } from 'lucide-react'

import { BLOCK_REASONS } from '@/constants'
import { validateBlock } from '@/utils/validation'
import { formatLongDate, formatTimeRange, isPastDate, todayISO } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useForm } from '@/hooks/useForm'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  Input,
  Modal,
  Select,
  SkeletonList,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * Bloqueo de horarios del barbero: descansos, comidas, dias libres.
 * Un bloqueo impide que los clientes reserven en esa franja.
 */
export default function BarberBlocks() {
  const { user } = useAuth()
  const toast = useToast()

  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [working, setWorking] = useState(false)

  const loader = useCallback(
    () => services.blocks.list({ barberId: user.uid }),
    [user.uid]
  )
  const { data: blocks, loading, error, reload } = useAsync(loader, [user.uid], { initialData: [] })

  const upcoming = (blocks || []).filter((b) => !isPastDate(b.date))
  const past = (blocks || []).filter((b) => isPastDate(b.date))

  async function handleDelete() {
    setWorking(true)
    try {
      await services.blocks.remove(deleteTarget.id)
      toast.success('Bloqueo eliminado. El horario vuelve a estar disponible.')
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos eliminar el bloqueo.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Bloquear horarios"
        description="Reserva tu tiempo para comidas, descansos o dias libres. Nadie podra agendar en esas franjas."
        actions={
          <Button onClick={() => setCreating(true)} icon={Plus}>
            Nuevo bloqueo
          </Button>
        }
      />

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : blocks.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="No tienes horarios bloqueados"
          description="Bloquea tu hora de comida o un dia libre para que nadie reserve encima."
          actionLabel="Crear el primero"
          onAction={() => setCreating(true)}
        />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">
              Proximos ({upcoming.length})
            </h2>

            {upcoming.length === 0 ? (
              <Card className="py-6 text-center text-sm text-ink-400">
                No tienes bloqueos programados.
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map((block) => (
                  <BlockRow key={block.id} block={block} onDelete={() => setDeleteTarget(block)} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">
                Pasados ({past.length})
              </h2>
              <div className="space-y-3 opacity-60">
                {past.slice(0, 5).map((block) => (
                  <BlockRow key={block.id} block={block} onDelete={() => setDeleteTarget(block)} past />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <BlockFormModal
        open={creating}
        onClose={() => setCreating(false)}
        barberId={user.uid}
        onDone={async () => {
          setCreating(false)
          await reload()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={working}
        title="Eliminar bloqueo"
        message={
          deleteTarget
            ? `Vas a liberar la franja de ${formatTimeRange(deleteTarget.startTime, deleteTarget.endTime)} del ${formatLongDate(deleteTarget.date)}. Los clientes podran volver a reservar en ese horario.`
            : ''
        }
        confirmLabel="Eliminar"
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function BlockRow({ block, onDelete, past = false }) {
  return (
    <Card className="flex flex-wrap items-center gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-ink-400">
        <Ban className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-100">{block.reason}</p>
        <p className="mt-0.5 text-xs text-ink-400">{formatLongDate(block.date)}</p>
      </div>

      <span className="shrink-0 rounded-lg bg-ink-850 px-3 py-1.5 text-sm text-ink-300">
        {formatTimeRange(block.startTime, block.endTime)}
      </span>

      {!past && (
        <Button size="sm" variant="dangerGhost" icon={Trash2} onClick={onDelete}>
          Eliminar
        </Button>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Formulario de creacion                                             */
/* ------------------------------------------------------------------ */

function BlockFormModal({ open, onClose, barberId, onDone }) {
  const toast = useToast()
  const [serverError, setServerError] = useState('')
  // Texto libre cuando el motivo elegido es "Otro"
  const [customReason, setCustomReason] = useState('')

  const form = useForm(
    { date: todayISO(), startTime: '14:00', endTime: '15:00', reason: 'Descanso' },
    validateBlock
  )

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError('')
    const reason =
      values.reason === 'Otro' ? customReason.trim() || 'Otro motivo' : values.reason

    try {
      await services.blocks.create({ ...values, reason, barberId })
      toast.success('Horario bloqueado.')
      form.reset({ date: todayISO(), startTime: '14:00', endTime: '15:00', reason: 'Descanso' })
      setCustomReason('')
      await onDone()
    } catch (error) {
      setServerError(error?.message || 'No pudimos crear el bloqueo.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bloquear un horario"
      description="Marca el tiempo en el que no estaras disponible."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={form.submitting}>
            Bloquear
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={serverError} />

        <Field label="Fecha" htmlFor="block-date" error={form.errorOf('date')} required>
          <input
            id="block-date"
            type="date"
            name="date"
            min={todayISO()}
            value={form.values.date}
            onChange={form.handleChange}
            className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Desde" htmlFor="block-start" error={form.errorOf('startTime')} required>
            <input
              id="block-start"
              type="time"
              name="startTime"
              step={900}
              value={form.values.startTime}
              onChange={form.handleChange}
              className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
            />
          </Field>

          <Field label="Hasta" htmlFor="block-end" error={form.errorOf('endTime')} required>
            <input
              id="block-end"
              type="time"
              name="endTime"
              step={900}
              value={form.values.endTime}
              onChange={form.handleChange}
              className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
            />
          </Field>
        </div>

        <Select
          label="Motivo"
          name="reason"
          value={form.values.reason}
          onChange={form.handleChange}
          error={form.errorOf('reason')}
          options={BLOCK_REASONS.map((reason) => ({ value: reason, label: reason }))}
          required
        />

        {/* Al elegir "Otro" se pide el motivo concreto */}
        {form.values.reason === 'Otro' && (
          <Input
            label="Describe el motivo"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Ej: mudanza, tramite personal..."
            autoFocus
          />
        )}
      </form>
    </Modal>
  )
}
