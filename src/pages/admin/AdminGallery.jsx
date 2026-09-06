import { useCallback, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Home,
  Images,
  Info,
  LayoutTemplate,
  Pencil,
  Plus,
  Scissors,
  Trash2,
} from 'lucide-react'

import {
  GALLERY_LOCATIONS,
  GALLERY_LOCATION_HINTS,
  GALLERY_LOCATION_LABELS,
  GALLERY_LOCATION_MAX,
} from '@/constants'
import { validateGalleryItem } from '@/utils/validation'
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
  ImageUpload,
  Input,
  Modal,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'

/**
 * Gestion de las galerias de fotos del sitio publico.
 *
 * Hay TRES galerias independientes: la foto principal de la portada, el
 * carrusel de inicio y el carrusel de servicios. Cada una lleva sus
 * propias fotos y el orden de esta pantalla es el que se ve en el sitio.
 */
export default function AdminGallery() {
  const toast = useToast()

  const [tab, setTab] = useState(GALLERY_LOCATIONS.HERO)
  const [editing, setEditing] = useState(null) // null | 'new' | objeto foto
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [working, setWorking] = useState(false)

  const loader = useCallback(() => services.gallery.list(), [])
  const { data: fotos, loading, error, reload } = useAsync(loader, [], { initialData: [] })

  /** Fotos de la galeria activa, ya ordenadas */
  const visibles = useMemo(
    () => (fotos || []).filter((f) => f.location === tab),
    [fotos, tab]
  )

  const conteos = useMemo(
    () =>
      Object.fromEntries(
        Object.values(GALLERY_LOCATIONS).map((loc) => [
          loc,
          (fotos || []).filter((f) => f.location === loc).length,
        ])
      ),
    [fotos]
  )

  // Cuantas fotos admite esta zona (0 = las que hagan falta)
  const maximo = GALLERY_LOCATION_MAX[tab] || 0
  const zonaLlena = maximo > 0 && visibles.length >= maximo

  /**
   * La portada tira del carrusel de inicio mientras no tenga fotos
   * propias. Hay que decirlo: si no, el panel muestra "vacia" y la web
   * sigue enseñando fotos, y eso desconcierta.
   */
  const usandoRespaldo =
    tab === GALLERY_LOCATIONS.HERO &&
    visibles.filter((f) => f.active).length === 0 &&
    (fotos || []).some((f) => f.location === GALLERY_LOCATIONS.INICIO && f.active)

  /* ---------------- Acciones ---------------- */

  /** Mueve una foto una posicion a la izquierda o a la derecha */
  async function mover(index, direccion) {
    const destino = index + direccion
    if (destino < 0 || destino >= visibles.length) return

    const reordenadas = [...visibles]
    ;[reordenadas[index], reordenadas[destino]] = [reordenadas[destino], reordenadas[index]]

    try {
      await services.gallery.reorder(reordenadas.map((f) => f.id))
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos cambiar el orden.')
    }
  }

  async function alternarActiva(foto) {
    try {
      await services.gallery.setActive(foto.id, !foto.active)
      toast.success(foto.active ? 'Foto oculta del carrusel.' : 'Foto visible en el carrusel.')
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos actualizar la foto.')
    }
  }

  async function eliminar() {
    setWorking(true)
    try {
      await services.gallery.remove(deleteTarget.id)
      toast.success('Foto eliminada.')
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos eliminar la foto.')
    } finally {
      setWorking(false)
    }
  }

  const activas = visibles.filter((f) => f.active).length

  return (
    <>
      <PageHeader
        title="Galeria de fotos"
        description="Todas las fotos del sitio publico se cambian desde aqui. Cada zona tiene su propia galeria y las fotos se anaden a la pestana en la que estes."
        actions={
          <Button
            onClick={() => setEditing('new')}
            icon={Plus}
            disabled={zonaLlena}
            title={
              zonaLlena
                ? `${GALLERY_LOCATION_LABELS[tab]} ya tiene sus ${maximo} fotos`
                : undefined
            }
          >
            {zonaLlena ? `Portada completa (${maximo}/${maximo})` : 'Subir foto'}
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          {
            value: GALLERY_LOCATIONS.HERO,
            label: 'Portada principal',
            count: conteos[GALLERY_LOCATIONS.HERO],
          },
          {
            value: GALLERY_LOCATIONS.INICIO,
            label: 'Carrusel de inicio',
            count: conteos[GALLERY_LOCATIONS.INICIO],
          },
          {
            value: GALLERY_LOCATIONS.SERVICIOS,
            label: 'Carrusel de servicios',
            count: conteos[GALLERY_LOCATIONS.SERVICIOS],
          },
        ]}
        className="mb-6"
      />

      {/* Aviso de contexto de la galeria seleccionada */}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 border-gold-500/25 bg-gold-500/[0.04]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
            {tab === GALLERY_LOCATIONS.HERO ? (
              <LayoutTemplate className="h-5 w-5" />
            ) : tab === GALLERY_LOCATIONS.INICIO ? (
              <Home className="h-5 w-5" />
            ) : (
              <Scissors className="h-5 w-5" />
            )}
          </span>
          <div>
            <p className="text-sm font-medium text-ink-100">{GALLERY_LOCATION_LABELS[tab]}</p>
            <p className="text-xs text-ink-400">
              {GALLERY_LOCATION_HINTS[tab]}{' '}
              <span className="text-ink-500">
                {maximo > 0
                  ? `${visibles.length} de ${maximo} fotos. Para cambiarlas, editalas o eliminalas.`
                  : `${activas} de ${visibles.length} fotos visibles, en este mismo orden.`}
              </span>
            </p>

            {usandoRespaldo && (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-300">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Ahora mismo la portada muestra prestadas las 2 primeras del carrusel de inicio. En
                cuanto subas una foto aqui, mandara esta galeria.
              </p>
            )}

            {zonaLlena && (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Esta zona esta completa. Para poner otra foto, edita una de las dos o eliminala
                primero.
              </p>
            )}
          </div>
        </div>

        <Button
          href={tab === GALLERY_LOCATIONS.SERVICIOS ? '/servicios' : '/'}
          target="_blank"
          rel="noreferrer"
          variant="ghost"
          size="sm"
          icon={Eye}
        >
          Ver en el sitio
        </Button>
      </Card>

      {/* ---------- Listado ---------- */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : visibles.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Esta galeria esta vacia"
          description={
            usandoRespaldo
              ? 'Mientras no subas ninguna foto aqui, la portada usa prestadas las 2 primeras del carrusel de inicio. Por eso ves fotos en la web aunque esta galeria este vacia.'
              : `Sube las fotos que quieres que aparezcan en ${GALLERY_LOCATION_LABELS[tab].toLowerCase()}.`
          }
          actionLabel="Subir la primera foto"
          onAction={() => setEditing('new')}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((foto, index) => {
            return (
            <Card key={foto.id} padded={false} className="overflow-hidden">
              {/* Vista previa */}
              <div className="relative aspect-[4/5] bg-ink-850">
                {foto.imageURL ? (
                  <img
                    src={foto.imageURL}
                    alt={foto.title}
                    loading="lazy"
                    className={`h-full w-full object-cover ${foto.active ? '' : 'opacity-40 grayscale'}`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-600">
                    <Images className="h-10 w-10" />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent" />

                <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg bg-ink-950/80 font-display text-xs text-gold-400 backdrop-blur">
                  {String(index + 1).padStart(2, '0')}
                </span>

                {!foto.active && (
                  <Badge
                    size="xs"
                    className="absolute right-3 top-3 bg-ink-950/80 text-ink-300 ring-ink-600"
                  >
                    Oculta
                  </Badge>
                )}


                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="truncate text-sm font-semibold text-ink-50">{foto.title}</p>
                  {foto.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-400">{foto.description}</p>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="space-y-2 border-t border-ink-800 p-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => mover(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover a la izquierda"
                    title="Mover a la izquierda"
                    className="flex h-9 flex-1 items-center justify-center rounded-lg border border-ink-600 text-ink-300 transition hover:bg-ink-800 disabled:opacity-30"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(index, 1)}
                    disabled={index === visibles.length - 1}
                    aria-label="Mover a la derecha"
                    title="Mover a la derecha"
                    className="flex h-9 flex-1 items-center justify-center rounded-lg border border-ink-600 text-ink-300 transition hover:bg-ink-800 disabled:opacity-30"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={Pencil}
                    onClick={() => setEditing(foto)}
                    className="flex-1"
                  >
                    Editar
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={foto.active ? EyeOff : Eye}
                    onClick={() => alternarActiva(foto)}
                    className="flex-1"
                  >
                    {foto.active ? 'Ocultar' : 'Mostrar'}
                  </Button>
                  <Button
                    size="xs"
                    variant="dangerGhost"
                    icon={Trash2}
                    onClick={() => setDeleteTarget(foto)}
                    aria-label="Eliminar foto"
                  />
                </div>
              </div>
            </Card>
            )
          })}
        </div>
      )}

      {/* La clave va AQUI, en el componente, no en el <Modal> de dentro.
          El estado del formulario (imagen, titulo...) vive en este
          componente: si no se remonta al cambiar de foto o de pestana,
          arrastra los valores de la anterior. */}
      <GalleryFormModal
        key={`form-${tab}-${editing === 'new' ? 'nueva' : editing?.id || 'cerrado'}`}
        target={editing}
        defaultLocation={tab}
        onClose={() => setEditing(null)}
        onDone={async () => {
          setEditing(null)
          await reload()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={eliminar}
        loading={working}
        title="Eliminar foto"
        message={
          deleteTarget
            ? `Vas a eliminar "${deleteTarget.title}" de la galeria. Si solo quieres quitarla del carrusel temporalmente, usa "Ocultar".`
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

function GalleryFormModal({ target, defaultLocation, onClose, onDone }) {
  const toast = useToast()
  const [serverError, setServerError] = useState('')
  const isEdit = target && target !== 'new'

  const [imageURL, setImageURL] = useState(isEdit ? target.imageURL : '')

  const form = useForm(
    {
      title: isEdit ? target.title : '',
      description: isEdit ? target.description : '',
      // Al crear manda la pestana; al editar, la zona que ya tenia
      location: isEdit ? target.location : defaultLocation,
    },
    (values) => validateGalleryItem({ ...values, imageURL })
  )

  // La clave del remontaje va en el padre, donde se usa este
  // componente: alli esta el dato que decide cuando reiniciarlo.

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError('')
    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      location: values.location,
      imageURL,
    }

    try {
      if (isEdit) {
        await services.gallery.update(target.id, payload)
        toast.success('Foto actualizada.')
      } else {
        await services.gallery.create(payload)
        toast.success('Foto anadida al carrusel.')
      }
      await onDone()
    } catch (error) {
      setServerError(error?.message || 'No pudimos guardar la foto.')
    }
  })

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={isEdit ? 'Editar foto' : 'Subir foto al carrusel'}
      description="Sube una foto de un corte real. Se vera en el carrusel de la pagina que elijas."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={form.submitting}>
            {isEdit ? 'Guardar cambios' : 'Anadir al carrusel'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={serverError} />

        <ImageUpload
          label="Foto del corte"
          value={imageURL}
          onChange={setImageURL}
          path="gallery"
          aspect="aspect-[4/5]"
          hint="Vertical queda mejor en el carrusel. JPG o PNG, maximo 8 MB."
          className="mx-auto max-w-[16rem]"
        />
        {form.errors.imageURL && (
          <p className="text-center text-xs text-rose-400">{form.errors.imageURL}</p>
        )}

        <Input
          label="Nombre del corte"
          name="title"
          placeholder="Ej: Skin fade con barba"
          value={form.values.title}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.errorOf('title')}
          maxLength={60}
          required
        />

        <Textarea
          label="Descripcion (opcional)"
          name="description"
          rows={2}
          placeholder="Un detalle sobre el trabajo. Se ve al pasar el raton por la foto."
          value={form.values.description}
          onChange={form.handleChange}
          maxLength={160}
        />

        {/* La zona la decide la pestana en la que estas, no un
            desplegable: cada seccion tiene sus propias fotos. */}
        <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-500/10 text-gold-400">
            {form.values.location === GALLERY_LOCATIONS.HERO ? (
              <LayoutTemplate className="h-4 w-4" />
            ) : form.values.location === GALLERY_LOCATIONS.INICIO ? (
              <Home className="h-4 w-4" />
            ) : (
              <Scissors className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-ink-500">Se anadira a</p>
            <p className="text-sm font-medium text-ink-100">
              {GALLERY_LOCATION_LABELS[form.values.location]}
            </p>
          </div>
        </div>
      </form>
    </Modal>
  )
}
