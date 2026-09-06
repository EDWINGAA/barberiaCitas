import { useCallback } from 'react'
import { CalendarCheck, GraduationCap, Users } from 'lucide-react'

import { PUBLIC_COURSE_STATUS, ROLES } from '@/constants'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/context/AuthContext'
import { Avatar, Badge, Button, Card, EmptyState, ErrorState } from '@/components/ui'
import { PublicHeader } from '@/components/shared/PageHeader'

/** Equipo de barberos, con sus especialidades y los cursos que imparten. */
export default function BarbersPage() {
  const { isAuthenticated, user } = useAuth()

  const loader = useCallback(async () => {
    const [barbers, courses] = await Promise.all([
      services.users.listBarbers({ activeOnly: true }),
      services.courses.list({ publicOnly: true }),
    ])
    return { barbers, courses }
  }, [])

  const { data, loading, error, reload } = useAsync(loader, [])

  const bookingLink = !isAuthenticated
    ? '/registro'
    : user?.role === ROLES.CLIENTE
      ? '/cliente/agendar'
      : '/cliente'

  return (
    <>
      <PublicHeader
        eyebrow="El equipo"
        title="Nuestros barberos"
        description="Cada uno con su estilo y su especialidad. Elige con quien quieres sentarte."
      />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl bg-ink-850" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : data.barbers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Todavia no hay barberos publicados"
            description="El equipo se esta armando. Vuelve pronto."
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.barbers.map((barber) => {
              const ownCourses = data.courses.filter(
                (c) => c.instructorId === barber.uid && PUBLIC_COURSE_STATUS.includes(c.status)
              )

              return (
                <Card key={barber.uid} hover className="flex flex-col text-center">
                  <Avatar src={barber.photoURL} name={barber.name} size="2xl" className="mx-auto" ring />

                  <h2 className="mt-5 text-lg font-semibold text-ink-50">{barber.name}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-400">{barber.bio}</p>

                  {barber.specialties?.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                      {barber.specialties.map((specialty) => (
                        <Badge
                          key={specialty}
                          size="xs"
                          className="bg-gold-500/10 text-gold-300 ring-gold-500/20"
                        >
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {ownCourses.length > 0 && (
                    <div className="mt-5 rounded-xl bg-ink-850 p-3 text-left">
                      <p className="flex items-center gap-2 text-xs font-medium text-gold-400">
                        <GraduationCap className="h-3.5 w-3.5" />
                        Imparte {ownCourses.length} curso{ownCourses.length > 1 ? 's' : ''}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {ownCourses.slice(0, 2).map((course) => (
                          <li key={course.id} className="truncate text-xs text-ink-400">
                            {course.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button to={bookingLink} variant="outline" size="sm" className="mt-5" icon={CalendarCheck}>
                    Agendar con {barber.name.split(' ')[0]}
                  </Button>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
