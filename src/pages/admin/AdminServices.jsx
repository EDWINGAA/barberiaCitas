import { useCallback, useState } from 'react'
import { Clock, Eye, EyeOff, Pencil, Plus, Scissors, Trash2 } from 'lucide-react'

import { validateService } from '@/utils/validation'
import { formatMoney } from '@/utils/format'
import { formatDuration } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/context/ToastContext'
import { useForm } from '@/hooks/useForm'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormError,
  Input,
  Modal,
  SkeletonList,
  Textarea,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  DataList,
  DataListCell,
  DataListRow,
  DataListSummary,
} from '@/components/shared/DataList'

/** Plantilla de columnas, compartida por la cabecera y las filas */
const COLUMNS = 'lg:grid-cols-[minmax(0,2.5fr)_8rem_8rem_auto]'

/** CRUD completo de servicios. */
export default function AdminServices() {
  const toast = useToast()

  const [editing, setEditing] = useState(null) // null | 'new' | objeto servicio
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [working, setWorking] = useState(false)

  const loader = useCallback(() => services.services.list(), [])
  const { data: rows, loading, error, reload } = useAsync(loader, [], { initialData: [] })

  async function toggleActive(service) {
    try {
      await services.services.setActive(service.id, !service.active)
      toast.success(service.active ? 'Servicio desactivado.' : 'Servicio activado.')
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos cambiar el estado del servicio.')
    }
  }

  async function handleDelete() {
    setWorking(true)
    try {
      await services.services.remove(deleteTarget.id)
      toast.success('Servicio eliminado.')
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos eliminar el servicio.')
      setDeleteTarget(null)
    } finally {
      setWorking(false)
    }
  }

  const activeCount = (rows || []).filter((s) => s.active).length

  return (
    <>
      <PageHeader
        title="Servicios"
        description={`${activeCount} activos de ${rows?.length || 0} en total. El precio que pongas aqui es la tarifa de referencia de la casa: cada barbero puede ajustar la suya desde su panel, y el cliente solo ve la del barbero que elige.`}
        actions={
          <Button onClick={() => setEditing('new')} icon={Plus}>
            Nuevo servicio
          </Button>
        }
      />

      {loading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="Todavia no hay servicios"
          description="Crea tu carta de servicios para que los clientes puedan agendar."
          actionLabel="Crear el primero"
          onAction={() => setEditing('new')}
        />
      ) : (
        <>
          <DataListSummary>
            <span className="text-ink-300">
              <span className="font-semibold text-ink-100">{rows.length}</span> servicio
              {rows.length === 1 ? '' : 's'} en el catalogo
            </span>
            <span className="ml-auto text-xs text-ink-500">
              El precio es la tarifa de referencia de la casa
            </span>
          </DataListSummary>

          <DataList
            columns={COLUMNS}
            headers={[
              'Servicio',
              { label: 'Duracion', align: 'center' },
              { label: 'Precio base', align: 'right' },
              '',
            ]}
          >
            {rows.map((service, index) => (
              <DataListRow
                key={service.id}
                columns={COLUMNS}
                first={index === 0}
                muted={!service.active}
              >
                {/* --- Servicio --- */}
                <DataListCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        service.active
                          ? 'bg-gold-500/10 text-gold-400'
                          : 'bg-ink-800 text-ink-600'
                      }`}
                    >
                      <Scissors className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          className={`truncate text-sm font-semibold ${
                            service.active ? 'text-ink-100' : 'text-ink-500'
                          }`}
                        >
                          {service.name}
                        </h2>
                        {!service.active && <Badge size="xs">Inactivo</Badge>}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                        {service.description}
                      </p>
                    </div>
                  </div>
                </DataListCell>

                {/* --- Duracion --- */}
                <DataListCell label="Duracion" align="center">
                  <p className="inline-flex items-center gap-1.5 text-sm text-ink-300">
                    <Clock className="h-3.5 w-3.5 text-ink-500" />
                    {formatDuration(service.duration)}
                  </p>
                </DataListCell>

                {/* --- Precio --- */}
                <DataListCell label="Precio base" align="right">
                  <p
                    className={`font-display text-xl ${
                      service.active ? 'text-gold-400' : 'text-ink-600'
                    }`}
                  >
                    {formatMoney(service.price)}
                  </p>
                </DataListCell>

                {/* --- Acciones --- */}
                <DataListCell>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      size="xs"
                      variant="secondary"
                      icon={Pencil}
                      onClick={() => setEditing(service)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={service.active ? EyeOff : Eye}
                      onClick={() => toggleActive(service)}
                    >
                      {service.active ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      size="xs"
                      variant="dangerGhost"
                      icon={Trash2}
                      onClick={() => setDeleteTarget(service)}
                      aria-label="Eliminar servicio"
                    />
                  </div>
                </DataListCell>
              </DataListRow>
            ))}
          </DataList>
        </>
      )}

      {/* La clave remonta el formulario al cambiar de servicio: si no,
          arrastra los valores del que se edito antes. */}
      <ServiceFormModal
        key={editing === 'new' ? 'nuevo' : editing?.id || 'cerrado'}
        target={editing}
        onClose={() => setEditing(null)}
        onDone={async () => {
          setEditing(null)
          await reload()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={working}
        title="Eliminar servicio"
        message={
          deleteTarget
            ? `Vas a eliminar "${deleteTarget.name}". Si tiene citas asociadas no se podra borrar: en ese caso desactivalo para conservar el historial.`
            : ''
        }
        confirmLabel="Eliminar"
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Formulario de alta y edicion                                       */
/* ------------------------------------------------------------------ */

function ServiceFormModal({ target, onClose, onDone }) {
  const toast = useToast()
  const [serverError, setServerError] = useState('')
  const isEdit = target && target !== 'new'

  const form = useForm(
    {
      name: isEdit ? target.name : '',
      description: isEdit ? target.description : '',
      duration: isEdit ? String(target.duration) : '30',
      price: isEdit ? String(target.price) : '',
    },
    validateService
  )

  // La clave del remontaje va en el padre, donde se usa este
  // componente: alli esta el dato que decide cuando reiniciarlo.

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError('')
    const payload = {
      name: values.name.trim(),
      description: values.description.trim(),
      duration: Number(values.duration),
      price: Number(values.price),
    }

    try {
      if (isEdit) {
        await services.services.update(target.id, payload)
        toast.success('Servicio actualizado.')
      } else {
        await services.services.create(payload)
        toast.success('Servicio creado.')
      }
      await onDone()
    } catch (error) {
      setServerError(error?.message || 'No pudimos guardar el servicio.')
    }
  })

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={isEdit ? 'Editar servicio' : 'Nuevo servicio'}
      description="Los cambios se aplican de inmediato al agendar nuevas citas."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={form.submitting}>
            {isEdit ? 'Guardar cambios' : 'Crear servicio'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={serverError} />

        <Input
          label="Nombre del servicio"
          name="name"
          placeholder="Ej: Corte clasico"
          value={form.values.name}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.errorOf('name')}
          required
        />

        <Textarea
          label="Descripcion"
          name="description"
          rows={3}
          placeholder="Que incluye el servicio"
          value={form.values.description}
          onChange={form.handleChange}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Duracion (minutos)"
            name="duration"
            type="number"
            min={5}
            max={480}
            step={5}
            value={form.values.duration}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.errorOf('duration')}
            hint="Referencia; cada barbero ajusta la suya"
            required
          />

          <Input
            label="Precio"
            name="price"
            type="number"
            min={0}
            step={10}
            placeholder="180"
            value={form.values.price}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.errorOf('price')}
            hint="Tarifa de referencia de la casa"
            required
          />
        </div>
      </form>
    </Modal>
  )
}
