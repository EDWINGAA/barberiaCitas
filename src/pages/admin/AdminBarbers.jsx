import { useCallback, useMemo, useState } from 'react'
import {
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserX,
  X,
} from 'lucide-react'

import { ROLES, ROLE_LABELS } from '@/constants'
import { validateBarber } from '@/utils/validation'
import { formatPhone, normalizeText } from '@/utils/format'
import { formatTimestamp } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/context/ToastContext'
import { useForm } from '@/hooks/useForm'
import {
  Avatar,
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
  PasswordInput,
  Select,
  SkeletonList,
  StatCard,
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
const COLUMNS = 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_7rem_auto]'

const FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Solo activos' },
  { value: 'inactivos', label: 'Solo desactivados' },
]

/**
 * Alta, edicion y desactivacion de barberos.
 *
 * El alta crea la cuenta de acceso (correo + contrasena) y el perfil con
 * su rol. Es la UNICA via para que exista una cuenta de barbero: el
 * registro publico siempre crea clientes.
 */
export default function AdminBarbers() {
  const toast = useToast()

  const [editing, setEditing] = useState(null) // null | 'new' | objeto usuario
  const [toggleTarget, setToggleTarget] = useState(null)
  const [working, setWorking] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos')

  const loader = useCallback(() => services.users.listBarbers({ activeOnly: false }), [])
  const { data: barbers, loading, error, reload } = useAsync(loader, [], { initialData: [] })

  const filtered = useMemo(() => {
    let list = barbers || []

    if (filter === 'activos') list = list.filter((b) => b.active)
    else if (filter === 'inactivos') list = list.filter((b) => !b.active)

    if (search.trim()) {
      const q = normalizeText(search)
      list = list.filter(
        (b) =>
          normalizeText(b.name).includes(q) ||
          normalizeText(b.email).includes(q) ||
          (b.phone || '').includes(q) ||
          (b.specialties || []).some((s) => normalizeText(s).includes(q))
      )
    }

    // Los activos primero y, dentro de cada grupo, por orden alfabetico
    return [...list].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return a.name.localeCompare(b.name, 'es')
    })
  }, [barbers, search, filter])

  const totals = useMemo(() => {
    const list = barbers || []
    return {
      total: list.length,
      activos: list.filter((b) => b.active).length,
      inactivos: list.filter((b) => !b.active).length,
      admins: list.filter((b) => b.role === ROLES.ADMIN).length,
    }
  }, [barbers])

  async function handleToggleActive() {
    setWorking(true)
    try {
      await services.users.setActive(toggleTarget.uid, !toggleTarget.active)
      toast.success(
        toggleTarget.active
          ? 'Barbero desactivado. Ya no aparecera al agendar.'
          : 'Barbero reactivado.'
      )
      setToggleTarget(null)
      await reload()
    } catch (err) {
      toast.error(err?.message || 'No pudimos actualizar la cuenta.')
    } finally {
      setWorking(false)
    }
  }

  const hayFiltros = search || filter !== 'todos'

  return (
    <>
      <PageHeader
        title="Barberos"
        description="Solo tu puedes crear cuentas de barbero. Cada uno gestiona despues su agenda, sus precios y sus cursos."
        actions={
          <Button onClick={() => setEditing('new')} icon={Plus}>
            Nuevo barbero
          </Button>
        }
      />

      {/* ---------- Resumen ---------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="En el equipo" value={totals.total} icon={UserCog} />
        <StatCard label="Activos" value={totals.activos} icon={UserCheck} accent="emerald" />
        <StatCard
          label="Desactivados"
          value={totals.inactivos}
          icon={UserX}
          accent={totals.inactivos > 0 ? 'rose' : 'sky'}
        />
        <StatCard
          label="Con rol admin"
          value={totals.admins}
          icon={ShieldCheck}
          accent="violet"
          hint="acceso completo"
        />
      </div>

      {/* ---------- Buscador y filtro ---------- */}
      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Buscar por nombre, correo o especialidad..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar barberos"
          />
          <Select
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filtrar por estado"
          />
        </div>

        {hayFiltros && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setFilter('todos')
              }}
              className="inline-flex items-center gap-1.5 text-xs text-gold-400 transition hover:text-gold-300"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>
        )}
      </Card>

      {/* ---------- Listado ---------- */}
      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title={hayFiltros ? 'Ningun barbero coincide' : 'Aun no hay barberos dados de alta'}
          description={
            hayFiltros
              ? 'Prueba a cambiar la busqueda o el filtro.'
              : 'Crea la primera cuenta de barbero para que pueda gestionar su agenda y sus cursos.'
          }
          actionLabel={hayFiltros ? undefined : 'Crear barbero'}
          onAction={hayFiltros ? undefined : () => setEditing('new')}
        />
      ) : (
        <>
          <DataListSummary>
            <span className="text-ink-300">
              <span className="font-semibold text-ink-100">{filtered.length}</span> barbero
              {filtered.length === 1 ? '' : 's'}
              {hayFiltros && ` de ${totals.total}`}
            </span>
            <span className="ml-auto text-xs text-ink-500">Activos primero, luego por nombre</span>
          </DataListSummary>

          <DataList
            columns={COLUMNS}
            headers={['Barbero', 'Contacto', 'Especialidades', 'Estado', '']}
          >
            {filtered.map((barber, index) => (
              <DataListRow
                key={barber.uid}
                columns={COLUMNS}
                first={index === 0}
                muted={!barber.active}
              >
                {/* --- Barbero --- */}
                <DataListCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={barber.photoURL} name={barber.name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`truncate text-sm font-semibold ${
                            barber.active ? 'text-ink-100' : 'text-ink-500'
                          }`}
                        >
                          {barber.name}
                        </p>
                        {barber.role === ROLES.ADMIN && (
                          <Badge
                            size="xs"
                            icon={ShieldCheck}
                            className="bg-gold-500/10 text-gold-300 ring-gold-500/25"
                          >
                            {ROLE_LABELS[ROLES.ADMIN]}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-ink-600">
                        Alta: {formatTimestamp(barber.createdAt).split(' ')[0]}
                      </p>
                    </div>
                  </div>
                </DataListCell>

                {/* --- Contacto --- */}
                <DataListCell label="Contacto">
                  <a
                    href={`mailto:${barber.email}`}
                    className="flex items-center gap-1.5 text-xs text-ink-400 transition hover:text-gold-400"
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{barber.email}</span>
                  </a>
                  {barber.phone && (
                    <a
                      href={`tel:${barber.phone}`}
                      className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500 transition hover:text-gold-400"
                    >
                      <Phone className="h-3 w-3 shrink-0" />
                      {formatPhone(barber.phone)}
                    </a>
                  )}
                </DataListCell>

                {/* --- Especialidades --- */}
                <DataListCell label="Especialidades">
                  {barber.specialties?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {barber.specialties.slice(0, 3).map((specialty) => (
                        <span
                          key={specialty}
                          className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-ink-300"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-ink-600">Sin especificar</span>
                  )}
                </DataListCell>

                {/* --- Estado --- */}
                <DataListCell label="Estado">
                  <Badge
                    size="xs"
                    className={
                      barber.active
                        ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25'
                        : 'bg-rose-500/10 text-rose-300 ring-rose-500/25'
                    }
                  >
                    {barber.active ? 'Activo' : 'Desactivado'}
                  </Badge>
                </DataListCell>

                {/* --- Acciones --- */}
                <DataListCell>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      size="xs"
                      variant="secondary"
                      icon={Pencil}
                      onClick={() => setEditing(barber)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="xs"
                      variant={barber.active ? 'dangerGhost' : 'outline'}
                      icon={barber.active ? UserX : UserCheck}
                      onClick={() => setToggleTarget(barber)}
                    >
                      {barber.active ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  </div>
                </DataListCell>
              </DataListRow>
            ))}
          </DataList>
        </>
      )}

      {/* La clave remonta el formulario al cambiar de barbero: si no,
          arrastra la foto y los datos del que se edito antes. */}
      <BarberFormModal
        key={editing === 'new' ? 'nuevo' : editing?.uid || 'cerrado'}
        target={editing}
        onClose={() => setEditing(null)}
        onDone={async () => {
          setEditing(null)
          await reload()
        }}
      />

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleActive}
        loading={working}
        variant={toggleTarget?.active ? 'danger' : 'primary'}
        title={toggleTarget?.active ? 'Desactivar barbero' : 'Reactivar barbero'}
        message={
          toggleTarget
            ? toggleTarget.active
              ? `${toggleTarget.name} dejara de aparecer al agendar y no podra iniciar sesion. Sus citas ya agendadas se conservan.`
              : `${toggleTarget.name} volvera a aparecer al agendar y podra acceder a su panel.`
            : ''
        }
        confirmLabel={toggleTarget?.active ? 'Desactivar' : 'Reactivar'}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Formulario de alta y edicion                                       */
/* ------------------------------------------------------------------ */

function BarberFormModal({ target, onClose, onDone }) {
  const toast = useToast()
  const [serverError, setServerError] = useState('')
  const isEdit = target && target !== 'new'

  const [photoURL, setPhotoURL] = useState(isEdit ? target.photoURL || '' : '')
  const [specialties, setSpecialties] = useState(
    isEdit ? (target.specialties || []).join(', ') : ''
  )

  const form = useForm(
    {
      name: isEdit ? target.name : '',
      email: isEdit ? target.email : '',
      phone: isEdit ? target.phone : '',
      password: '',
      bio: isEdit ? target.bio || '' : '',
      role: isEdit ? target.role : ROLES.BARBERO,
    },
    (values) => validateBarber({ ...values, isEdit })
  )

  // La clave del remontaje va en el padre, donde se usa este
  // componente: alli esta el dato que decide cuando reiniciarlo.

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError('')
    const specialtyList = specialties
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      if (isEdit) {
        await services.users.update(target.uid, {
          name: values.name.trim(),
          phone: values.phone.trim(),
          bio: values.bio.trim(),
          role: values.role,
          photoURL,
          specialties: specialtyList,
        })
        toast.success('Barbero actualizado.')
      } else {
        await services.auth.createAccount({
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          password: values.password,
          role: values.role,
          bio: values.bio.trim(),
          specialties: specialtyList,
          photoURL,
        })
        toast.success('Cuenta creada. El barbero ya puede iniciar sesion.')
      }
      await onDone()
    } catch (error) {
      setServerError(error?.message || 'No pudimos guardar la cuenta.')
    }
  })

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={isEdit ? 'Editar barbero' : 'Nuevo barbero'}
      description={
        isEdit
          ? 'Actualiza el perfil publico y los datos de contacto.'
          : 'Se creara la cuenta de acceso y su perfil con el rol asignado.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={form.submitting}>
            {isEdit ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={serverError} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre completo"
            name="name"
            placeholder="Aurelio Mendoza"
            value={form.values.name}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.errorOf('name')}
            required
          />

          <Input
            label="Telefono"
            name="phone"
            type="tel"
            placeholder="55 1234 5678"
            value={form.values.phone}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.errorOf('phone')}
          />
        </div>

        <Input
          label="Correo electronico"
          name="email"
          type="email"
          placeholder="barbero@barberia.com"
          value={form.values.email}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.errorOf('email')}
          disabled={isEdit}
          hint={isEdit ? 'El correo no se puede cambiar despues del alta.' : 'Sera su usuario de acceso.'}
          required
        />

        {!isEdit && (
          <PasswordInput
            label="Contrasena temporal"
            name="password"
            placeholder="Minimo 6 caracteres"
            value={form.values.password}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.errorOf('password')}
            hint="Comunicasela al barbero para su primer acceso."
            required
          />
        )}

        <Select
          label="Rol de la cuenta"
          name="role"
          value={form.values.role}
          onChange={form.handleChange}
          options={[
            { value: ROLES.BARBERO, label: ROLE_LABELS[ROLES.BARBERO] },
            { value: ROLES.ADMIN, label: ROLE_LABELS[ROLES.ADMIN] },
          ]}
          hint="Un administrador tiene acceso completo al negocio."
        />

        <Textarea
          label="Biografia publica"
          name="bio"
          rows={3}
          placeholder="Trayectoria, estilo y en que destaca."
          value={form.values.bio}
          onChange={form.handleChange}
          maxLength={400}
        />

        <Input
          label="Especialidades"
          value={specialties}
          onChange={(e) => setSpecialties(e.target.value)}
          placeholder="Corte clasico, Afeitado a navaja, Fade"
          hint="Separalas con comas."
        />

        <div className="max-w-[12rem]">
          <ImageUpload
            label="Foto de perfil"
            value={photoURL}
            onChange={setPhotoURL}
            path={`users/${isEdit ? target.uid : 'nuevos'}`}
            aspect="aspect-square"
            rounded="rounded-2xl"
            hint="Se muestra en la pagina publica"
          />
        </div>

        {!isEdit && (
          <p className="rounded-xl bg-ink-850 px-4 py-3 text-xs leading-relaxed text-ink-400">
            Al crearlo hereda todo el catalogo de servicios a los precios de la casa. Podra
            ajustar sus propias tarifas desde su panel, en "Mis servicios".
          </p>
        )}
      </form>
    </Modal>
  )
}
