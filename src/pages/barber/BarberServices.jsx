import { useCallback, useMemo, useState } from 'react'
import {
  Check,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import { OFFERING_ORIGIN } from '@/constants'
import { cn, formatMoney } from '@/utils/format'
import { formatDuration } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
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
  StatCard,
  Textarea,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * "Mis servicios" del barbero.
 *
 * Parte del catalogo de la barberia: si el barbero no toca nada, cobra
 * lo que marca la casa. Desde aqui puede subir o bajar su precio, ajustar
 * cuanto tarda, dejar de ofrecer algo, y anadir servicios propios que
 * solo hace el.
 */
export default function BarberServices() {
  const { user } = useAuth()
  const toast = useToast()

  const [editing, setEditing] = useState(null) // oferta del catalogo en edicion
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [working, setWorking] = useState(false)

  const loader = useCallback(
    () => services.barberServices.listOfferings({ barberId: user.uid }),
    [user.uid]
  )
  const { data: ofertas, loading, error, reload } = useAsync(loader, [user.uid], { initialData: [] })

  const { catalogo, propios } = useMemo(() => {
    const filas = ofertas || []
    return {
      catalogo: filas.filter((o) => o.origin === OFFERING_ORIGIN.CATALOGO),
      propios: filas.filter((o) => o.origin === OFFERING_ORIGIN.PROPIO),
    }
  }, [ofertas])

  const resumen = useMemo(() => {
    const activos = (ofertas || []).filter((o) => o.active)
    const precios = activos.map((o) => o.price).filter((p) => p > 0)
    return {
      activos: activos.length,
      total: (ofertas || []).length,
      desde: precios.length ? Math.min(...precios) : 0,
      hasta: precios.length ? Math.max(...precios) : 0,
      ajustados: catalogo.filter((o) => o.customized).length,
    }
  }, [ofertas, catalogo])

  /* ---------------- Acciones ---------------- */

  /** Activa o desactiva un servicio para este barbero */
  async function alternar(oferta) {
    try {
      if (oferta.origin === OFFERING_ORIGIN.PROPIO) {
        await services.barberServices.update(oferta.rowId, { active: !oferta.active })
      } else {
        await services.barberServices.setCatalogOverride({
          barberId: user.uid,
          serviceId: oferta.serviceId,
          active: !oferta.active,
        })
      }
      toast.success(oferta.active ? 'Ya no ofreces este servicio.' : 'Servicio activado.')
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos actualizar el servicio.')
    }
  }

  /** Vuelve al precio y la duracion que marca la barberia */
  async function volverAlCatalogo(oferta) {
    try {
      await services.barberServices.setCatalogOverride({
        barberId: user.uid,
        serviceId: oferta.serviceId,
        price: oferta.basePrice,
        duration: oferta.baseDuration,
        active: true,
      })
      toast.success('Vuelves al precio de la barberia.')
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos restablecer el precio.')
    }
  }

  async function eliminar() {
    setWorking(true)
    try {
      await services.barberServices.remove(deleteTarget.rowId)
      toast.success('Servicio eliminado.')
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos eliminar el servicio.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Mis servicios"
        description="Lo que ofreces y a que precio. Partes del catalogo de la barberia y desde aqui pones tus propias tarifas."
        actions={
          <Button onClick={() => setCreating(true)} icon={Plus}>
            Servicio propio
          </Button>
        }
      />

      {/* ---------- Resumen ---------- */}
      {!loading && !error && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Servicios activos"
            value={resumen.activos}
            icon={Scissors}
            hint={`de ${resumen.total} disponibles`}
          />
          <StatCard
            label="Tu precio mas bajo"
            value={formatMoney(resumen.desde)}
            icon={Check}
            accent="emerald"
          />
          <StatCard
            label="Tu precio mas alto"
            value={formatMoney(resumen.hasta)}
            icon={Sparkles}
            accent="violet"
          />
          <StatCard
            label="Ajustados por ti"
            value={resumen.ajustados}
            icon={Pencil}
            accent="sky"
            hint="difieren del catalogo"
          />
        </div>
      )}

      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="space-y-10">
          {/* ---------- Catalogo de la barberia ---------- */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-ink-100">Catalogo de la barberia</h2>
              <p className="mt-1 text-sm text-ink-400">
                Estos servicios los define el administrador. Tu decides cuanto cobras por cada uno
                y cuales haces.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900">
              {catalogo.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-ink-500">
                  La barberia todavia no tiene servicios en el catalogo.
                </p>
              ) : (
                catalogo.map((oferta, i) => (
                  <FilaServicio
                    key={oferta.id}
                    oferta={oferta}
                    primera={i === 0}
                    onEditar={() => setEditing(oferta)}
                    onAlternar={() => alternar(oferta)}
                    onRestablecer={() => volverAlCatalogo(oferta)}
                  />
                ))
              )}
            </div>
          </section>

          {/* ---------- Servicios propios ---------- */}
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-100">Tus servicios propios</h2>
                <p className="mt-1 text-sm text-ink-400">
                  Los que solo haces tu. Aparecen en la reserva marcados como exclusivos tuyos.
                </p>
              </div>
              <Button size="sm" variant="outline" icon={Plus} onClick={() => setCreating(true)}>
                Anadir
              </Button>
            </div>

            {propios.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Todavia no tienes servicios propios"
                description="Si haces algo que no esta en el catalogo de la casa, dalo de alta aqui con tu precio."
                actionLabel="Crear el primero"
                onAction={() => setCreating(true)}
                compact
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900">
                {propios.map((oferta, i) => (
                  <FilaServicio
                    key={oferta.id}
                    oferta={oferta}
                    primera={i === 0}
                    onEditar={() => setEditing(oferta)}
                    onAlternar={() => alternar(oferta)}
                    onEliminar={() => setDeleteTarget(oferta)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ---------- Editar precio y duracion ---------- */}
      {/* La clave remonta el formulario al cambiar de servicio: si no,
          arrastra el precio y la duracion del anterior. */}
      <EditarOfertaModal
        key={editing?.id || 'cerrado'}
        oferta={editing}
        barberId={user.uid}
        onClose={() => setEditing(null)}
        onDone={async () => {
          setEditing(null)
          await reload()
        }}
      />

      {/* ---------- Crear servicio propio ---------- */}
      <NuevoServicioModal
        open={creating}
        barberId={user.uid}
        onClose={() => setCreating(false)}
        onDone={async () => {
          setCreating(false)
          await reload()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={eliminar}
        loading={working}
        title="Eliminar servicio"
        message={
          deleteTarget
            ? `Vas a eliminar "${deleteTarget.name}". Si ya tiene citas no se podra borrar: en ese caso desactivalo para conservar el historial.`
            : ''
        }
        confirmLabel="Eliminar"
      />
    </>
  )
}

/* ================================================================== */
/*  Fila de servicio                                                   */
/* ================================================================== */

/** Una fila alineada: nombre, precio, duracion y acciones */
function FilaServicio({ oferta, primera, onEditar, onAlternar, onRestablecer, onEliminar }) {
  const propio = oferta.origin === OFFERING_ORIGIN.PROPIO

  return (
    <article
      className={cn(
        'grid gap-x-4 gap-y-3 px-4 py-4 transition-colors sm:px-5',
        'grid-cols-[minmax(0,1fr)_auto]',
        'lg:grid-cols-[minmax(0,1.6fr)_7rem_7rem_minmax(0,auto)] lg:items-center',
        !primera && 'border-t border-ink-800',
        oferta.active ? 'hover:bg-ink-850/60' : 'bg-ink-900/60'
      )}
    >
      {/* --- Nombre --- */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={cn(
              'truncate text-sm font-semibold',
              oferta.active ? 'text-ink-100' : 'text-ink-500 line-through'
            )}
          >
            {oferta.name}
          </h3>

          {propio && (
            <Badge size="xs" className="bg-violet-500/10 text-violet-300 ring-violet-500/25">
              Solo tuyo
            </Badge>
          )}
          {!propio && oferta.customized && (
            <Badge size="xs" className="bg-gold-500/10 text-gold-300 ring-gold-500/25">
              Precio propio
            </Badge>
          )}
          {!oferta.active && <Badge size="xs">No lo ofreces</Badge>}
        </div>

        {oferta.description && (
          <p className="mt-1 line-clamp-1 text-xs text-ink-500">{oferta.description}</p>
        )}

        {/* Referencia del catalogo, para saber cuanto te separas */}
        {!propio && oferta.customized && (
          <p className="mt-1 text-[11px] text-ink-600">
            La barberia marca {formatMoney(oferta.basePrice)} ·{' '}
            {formatDuration(oferta.baseDuration)}
          </p>
        )}
      </div>

      {/* --- Precio --- */}
      <div className="text-right lg:text-left">
        <p className="text-[10px] uppercase tracking-wider text-ink-600 lg:hidden">Tu precio</p>
        <p
          className={cn(
            'font-display text-2xl',
            oferta.active ? 'text-gold-400' : 'text-ink-600'
          )}
        >
          {formatMoney(oferta.price)}
        </p>
      </div>

      {/* --- Duracion --- */}
      <div className="col-start-1 lg:col-start-auto">
        <p className="text-[10px] uppercase tracking-wider text-ink-600 lg:hidden">Duracion</p>
        <p className="text-sm text-ink-300">{formatDuration(oferta.duration)}</p>
      </div>

      {/* --- Acciones --- */}
      <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1 lg:justify-end">
        <Button size="xs" variant="secondary" icon={Pencil} onClick={onEditar}>
          Editar
        </Button>

        {!propio && oferta.customized && onRestablecer && (
          <Button size="xs" variant="ghost" icon={RotateCcw} onClick={onRestablecer}>
            Precio de la casa
          </Button>
        )}

        <Button
          size="xs"
          variant="ghost"
          icon={oferta.active ? EyeOff : Eye}
          onClick={onAlternar}
        >
          {oferta.active ? 'No lo hago' : 'Activar'}
        </Button>

        {propio && onEliminar && (
          <Button size="xs" variant="dangerGhost" icon={Trash2} onClick={onEliminar} aria-label="Eliminar" />
        )}
      </div>
    </article>
  )
}

/* ================================================================== */
/*  Modal: editar precio y duracion                                    */
/* ================================================================== */

function EditarOfertaModal({ oferta, barberId, onClose, onDone }) {
  const toast = useToast()
  const [serverError, setServerError] = useState('')
  const propio = oferta?.origin === OFFERING_ORIGIN.PROPIO

  const form = useForm(
    {
      name: oferta?.name || '',
      description: oferta?.description || '',
      price: oferta ? String(oferta.price) : '',
      duration: oferta ? String(oferta.duration) : '',
    },
    (values) => {
      const errors = {}
      if (propio && !values.name?.trim()) errors.name = 'El nombre es obligatorio'
      const precio = Number(values.price)
      if (Number.isNaN(precio) || precio < 0) errors.price = 'Precio no valido'
      const dur = Number(values.duration)
      if (!dur || dur < 5) errors.duration = 'Minimo 5 minutos'
      else if (dur > 480) errors.duration = 'Maximo 8 horas'
      return errors
    }
  )

  // La clave del remontaje va en el padre, donde se usa este
  // componente: alli esta el dato que decide cuando reiniciarlo.

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError('')
    try {
      if (propio) {
        await services.barberServices.update(oferta.rowId, {
          name: values.name.trim(),
          description: values.description.trim(),
          price: Number(values.price),
          duration: Number(values.duration),
        })
      } else {
        await services.barberServices.setCatalogOverride({
          barberId,
          serviceId: oferta.serviceId,
          price: Number(values.price),
          duration: Number(values.duration),
          active: true,
        })
      }
      toast.success('Servicio actualizado.')
      await onDone()
    } catch (error) {
      setServerError(error?.message || 'No pudimos guardar el servicio.')
    }
  })

  return (
    <Modal
      open={Boolean(oferta)}
      onClose={onClose}
      title={propio ? 'Editar tu servicio' : `Tu precio para ${oferta?.name || ''}`}
      description={
        propio
          ? 'Este servicio solo lo ofreces tu.'
          : 'Solo cambia lo tuyo: el catalogo de la barberia no se toca.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={form.submitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={serverError} />

        {propio && (
          <>
            <Input
              label="Nombre del servicio"
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
              rows={2}
              value={form.values.description}
              onChange={form.handleChange}
            />
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Tu precio"
            name="price"
            type="number"
            min={0}
            step={10}
            value={form.values.price}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.errorOf('price')}
            hint={
              !propio && oferta
                ? `La barberia marca ${formatMoney(oferta.basePrice)}`
                : 'Lo que cobras por este servicio'
            }
            required
          />

          <Input
            label="Cuanto tardas (minutos)"
            name="duration"
            type="number"
            min={5}
            max={480}
            step={5}
            value={form.values.duration}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.errorOf('duration')}
            hint={
              !propio && oferta
                ? `La barberia marca ${formatDuration(oferta.baseDuration)}`
                : 'Define cuanto ocupa tu silla'
            }
            required
          />
        </div>

        <p className="rounded-xl bg-ink-850 px-4 py-3 text-xs leading-relaxed text-ink-400">
          La duracion decide los huecos que ve el cliente al reservar contigo. Si tardas mas que
          otro barbero, tu agenda lo tendra en cuenta automaticamente.
        </p>
      </form>
    </Modal>
  )
}

/* ================================================================== */
/*  Modal: nuevo servicio propio                                       */
/* ================================================================== */

function NuevoServicioModal({ open, barberId, onClose, onDone }) {
  const toast = useToast()
  const [serverError, setServerError] = useState('')

  const form = useForm(
    { name: '', description: '', price: '', duration: '45' },
    (values) => {
      const errors = {}
      if (!values.name?.trim()) errors.name = 'Ponle un nombre'
      const precio = Number(values.price)
      if (Number.isNaN(precio) || precio < 0) errors.price = 'Precio no valido'
      const dur = Number(values.duration)
      if (!dur || dur < 5) errors.duration = 'Minimo 5 minutos'
      return errors
    }
  )

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError('')
    try {
      await services.barberServices.createCustom({
        barberId,
        name: values.name.trim(),
        description: values.description.trim(),
        price: Number(values.price),
        duration: Number(values.duration),
      })
      toast.success('Servicio creado. Ya puedes recibir citas con el.')
      form.reset({ name: '', description: '', price: '', duration: '45' })
      await onDone()
    } catch (error) {
      setServerError(error?.message || 'No pudimos crear el servicio.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo servicio propio"
      description="Algo que haces tu y no esta en el catalogo de la barberia."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={form.submitting} icon={Plus}>
            Crear servicio
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={serverError} />

        <Input
          label="Nombre del servicio"
          name="name"
          placeholder="Ej: Ritual de barba con toalla caliente"
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
          placeholder="Que incluye y en que se diferencia."
          value={form.values.description}
          onChange={form.handleChange}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Tu precio"
            name="price"
            type="number"
            min={0}
            step={10}
            placeholder="450"
            value={form.values.price}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.errorOf('price')}
            required
          />
          <Input
            label="Cuanto tardas (minutos)"
            name="duration"
            type="number"
            min={5}
            max={480}
            step={5}
            value={form.values.duration}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.errorOf('duration')}
            required
          />
        </div>

        <p className="flex gap-2 rounded-xl bg-ink-850 px-4 py-3 text-xs leading-relaxed text-ink-400">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-45 text-gold-500/70" />
          Si el servicio ya existe en el catalogo de la barberia, no lo crees aparte: ajusta ahi tu
          precio y asi los clientes te comparan con el resto del equipo.
        </p>
      </form>
    </Modal>
  )
}
