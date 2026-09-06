import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  GraduationCap,
  Mail,
  Phone,
  Scissors,
  Search,
  Users,
  X,
} from 'lucide-react'

import { APPOINTMENT_STATUS, ENROLLMENT_STATUS } from '@/constants'
import { formatMoneyShort, formatPhone, normalizeText } from '@/utils/format'
import { formatShortDate, formatTimestamp } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SkeletonList,
  StatCard,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  DataList,
  DataListCell,
  DataListRow,
  DataListSummary,
} from '@/components/shared/DataList'

/** Plantilla de columnas, compartida por la cabecera y las filas */
const COLUMNS = 'lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_6rem_5rem_7rem_auto]'

const SORT_OPTIONS = [
  { value: 'nombre', label: 'Nombre (A-Z)' },
  { value: 'recientes', label: 'Mas recientes primero' },
  { value: 'citas', label: 'Mas citas' },
  { value: 'gasto', label: 'Mas han gastado' },
]

/** Directorio de clientes con su actividad resumida. */
export default function AdminClients() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('nombre')

  const loader = useCallback(async () => {
    const [clients, appointments, enrollments] = await Promise.all([
      services.users.listClients(),
      services.appointments.list(),
      services.enrollments.list(),
    ])
    return { clients, appointments, enrollments }
  }, [])

  const { data, loading, error, reload } = useAsync(loader, [])

  /** Une cada cliente con sus cifras de actividad */
  const rows = useMemo(() => {
    if (!data) return []

    return data.clients.map((client) => {
      const own = data.appointments.filter((a) => a.clientId === client.uid)
      const completed = own.filter((a) => a.status === APPOINTMENT_STATUS.COMPLETADA)
      const courses = data.enrollments.filter(
        (e) => e.clientId === client.uid && e.status !== ENROLLMENT_STATUS.CANCELADO
      )

      return {
        ...client,
        appointmentCount: own.length,
        completedCount: completed.length,
        noShowCount: own.filter((a) => a.status === APPOINTMENT_STATUS.NO_SHOW).length,
        spent: completed.reduce((sum, a) => sum + (Number(a.price) || 0), 0),
        courseCount: courses.length,
        lastVisit: completed.map((a) => a.date).sort().pop() || null,
      }
    })
  }, [data])

  const filtered = useMemo(() => {
    let list = rows

    if (search.trim()) {
      const q = normalizeText(search)
      list = list.filter(
        (client) =>
          normalizeText(client.name).includes(q) ||
          normalizeText(client.email).includes(q) ||
          (client.phone || '').includes(q)
      )
    }

    // El orden lo elige el administrador: alfabetico por defecto
    return [...list].sort((a, b) => {
      if (sortBy === 'citas') return b.appointmentCount - a.appointmentCount
      if (sortBy === 'gasto') return b.spent - a.spent
      if (sortBy === 'recientes') return String(b.createdAt).localeCompare(String(a.createdAt))
      return a.name.localeCompare(b.name, 'es')
    })
  }, [rows, search, sortBy])

  const totals = useMemo(
    () => ({
      clients: rows.length,
      withCourses: rows.filter((c) => c.courseCount > 0).length,
      revenue: rows.reduce((sum, c) => sum + c.spent, 0),
      appointments: rows.reduce((sum, c) => sum + c.appointmentCount, 0),
    }),
    [rows]
  )

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Todos los clientes registrados, con su historial de citas y cursos."
      />

      {/* ---------- Resumen ---------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes registrados" value={totals.clients} icon={Users} />
        <StatCard label="Citas totales" value={totals.appointments} icon={Scissors} accent="sky" />
        <StatCard
          label="Tambien alumnos"
          value={totals.withCourses}
          icon={GraduationCap}
          accent="violet"
          hint="con al menos un curso"
        />
        <StatCard
          label="Facturado historico"
          value={formatMoneyShort(totals.revenue)}
          icon={Scissors}
          accent="emerald"
          hint="servicios completados"
        />
      </div>

      {/* ---------- Buscador y orden ---------- */}
      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Buscar por nombre, correo o telefono..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar clientes"
          />
          <Select
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Ordenar clientes"
          />
        </div>

        {(search || sortBy !== 'nombre') && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSortBy('nombre')
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
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'Ningun cliente coincide' : 'Todavia no hay clientes'}
          description={
            search
              ? 'Prueba con otro nombre, correo o telefono.'
              : 'Cuando alguien se registre en la web, aparecera aqui.'
          }
        />
      ) : (
        <>
          <DataListSummary>
            <span className="text-ink-300">
              <span className="font-semibold text-ink-100">{filtered.length}</span> cliente
              {filtered.length === 1 ? '' : 's'}
              {search && ` de ${rows.length}`}
            </span>
            <span className="ml-auto text-xs text-ink-500">
              Ordenados por {SORT_OPTIONS.find((o) => o.value === sortBy)?.label.toLowerCase()}
            </span>
          </DataListSummary>

          <DataList
            columns={COLUMNS}
            headers={[
              'Cliente',
              'Contacto',
              { label: 'Citas', align: 'center' },
              { label: 'Cursos', align: 'center' },
              { label: 'Gastado', align: 'right' },
              '',
            ]}
          >
            {filtered.map((client, index) => (
              <DataListRow key={client.uid} columns={COLUMNS} first={index === 0}>
                {/* --- Cliente --- */}
                <DataListCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={client.photoURL} name={client.name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink-100">{client.name}</p>
                        {client.courseCount > 0 && (
                          <Badge
                            size="xs"
                            className="bg-violet-500/10 text-violet-300 ring-violet-500/25"
                          >
                            Alumno
                          </Badge>
                        )}
                        {client.noShowCount >= 2 && (
                          <Badge
                            size="xs"
                            className="bg-rose-500/10 text-rose-300 ring-rose-500/25"
                          >
                            {client.noShowCount} no-shows
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-ink-600">
                        {client.lastVisit
                          ? `Ultima visita: ${formatShortDate(client.lastVisit)}`
                          : `Alta: ${formatTimestamp(client.createdAt).split(' ')[0]}`}
                      </p>
                    </div>
                  </div>
                </DataListCell>

                {/* --- Contacto --- */}
                <DataListCell label="Contacto">
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-1.5 text-xs text-ink-400 transition hover:text-gold-400"
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </a>
                  {client.phone && (
                    <a
                      href={`tel:${client.phone}`}
                      className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500 transition hover:text-gold-400"
                    >
                      <Phone className="h-3 w-3 shrink-0" />
                      {formatPhone(client.phone)}
                    </a>
                  )}
                </DataListCell>

                {/* --- Citas --- */}
                <DataListCell label="Citas" align="center">
                  <p className="text-sm font-semibold text-ink-100">{client.appointmentCount}</p>
                  <p className="text-[11px] text-emerald-400">{client.completedCount} hechas</p>
                </DataListCell>

                {/* --- Cursos --- */}
                <DataListCell label="Cursos" align="center">
                  <p className="text-sm font-semibold text-violet-300">{client.courseCount}</p>
                </DataListCell>

                {/* --- Gastado --- */}
                <DataListCell label="Gastado" align="right">
                  <p className="font-display text-xl text-gold-400">
                    {formatMoneyShort(client.spent)}
                  </p>
                </DataListCell>

                {/* --- Accion --- */}
                <DataListCell align="right">
                  <Button
                    to={`/admin/clientes/${client.uid}`}
                    size="xs"
                    variant="secondary"
                    iconRight={ArrowRight}
                  >
                    Ver ficha
                  </Button>
                </DataListCell>
              </DataListRow>
            ))}
          </DataList>
        </>
      )}
    </>
  )
}
