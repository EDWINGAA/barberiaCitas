import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import { ROLES } from '@/constants'
import { FullPageLoader } from '@/components/ui'
import { DemoBadge } from '@/components/layout/DemoBadge'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { ClientLayout } from '@/components/layout/ClientLayout'
import { PanelLayout } from '@/components/layout/PanelLayout'
import { RequireGuest, RequireRole } from '@/components/routes/ProtectedRoute'
import { RouteBoundary } from '@/components/routes/RouteBoundary'

/* ------------------------------------------------------------------ */
/*  Paginas (carga diferida por panel)                                 */
/* ------------------------------------------------------------------ */

// Publicas
const Landing = lazy(() => import('@/pages/public/Landing'))
const ServicesPage = lazy(() => import('@/pages/public/ServicesPage'))
const BarbersPage = lazy(() => import('@/pages/public/BarbersPage'))
const CoursesCatalog = lazy(() => import('@/pages/public/CoursesCatalog'))
const CourseDetail = lazy(() => import('@/pages/public/CourseDetail'))
const ContactPage = lazy(() => import('@/pages/public/ContactPage'))
const Login = lazy(() => import('@/pages/public/Login'))
const Register = lazy(() => import('@/pages/public/Register'))
const NotFound = lazy(() => import('@/pages/public/NotFound'))

// Cliente
const ClientDashboard = lazy(() => import('@/pages/client/ClientDashboard'))
const BookAppointment = lazy(() => import('@/pages/client/BookAppointment'))
const MyAppointments = lazy(() => import('@/pages/client/MyAppointments'))
const ClientMessages = lazy(() => import('@/pages/client/ClientMessages'))
const MyCourses = lazy(() => import('@/pages/client/MyCourses'))

// Barbero
const BarberDashboard = lazy(() => import('@/pages/barber/BarberDashboard'))
const BarberAgenda = lazy(() => import('@/pages/barber/BarberAgenda'))
const BarberAppointments = lazy(() => import('@/pages/barber/BarberAppointments'))
const BarberBlocks = lazy(() => import('@/pages/barber/BarberBlocks'))
const BarberServices = lazy(() => import('@/pages/barber/BarberServices'))
const BarberCourses = lazy(() => import('@/pages/barber/BarberCourses'))
const CourseEditor = lazy(() => import('@/pages/barber/CourseEditor'))
const CourseStudents = lazy(() => import('@/pages/barber/CourseStudents'))
const BarberStats = lazy(() => import('@/pages/barber/BarberStats'))

// Administrador
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminAppointments = lazy(() => import('@/pages/admin/AdminAppointments'))
const AdminServices = lazy(() => import('@/pages/admin/AdminServices'))
const AdminBarbers = lazy(() => import('@/pages/admin/AdminBarbers'))
const AdminClients = lazy(() => import('@/pages/admin/AdminClients'))
const AdminClientDetail = lazy(() => import('@/pages/admin/AdminClientDetail'))
const AdminCourses = lazy(() => import('@/pages/admin/AdminCourses'))
const AdminGallery = lazy(() => import('@/pages/admin/AdminGallery'))
const AdminBusiness = lazy(() => import('@/pages/admin/AdminBusiness'))

// Compartida entre los tres roles
const Profile = lazy(() => import('@/pages/Profile'))

/* ------------------------------------------------------------------ */
/*  Utilidad: volver arriba al cambiar de ruta                         */
/* ------------------------------------------------------------------ */

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

/* ------------------------------------------------------------------ */
/*  Arbol de rutas                                                     */
/* ------------------------------------------------------------------ */

export default function App() {
  return (
    <>
      <ScrollToTop />

      {/* El limite va POR FUERA de Suspense: si falla la descarga de una
          pantalla, la promesa se rechaza y Suspense no puede recuperarse
          por si solo. Sin esto la pagina se queda en negro. */}
      <RouteBoundary>
        <Suspense fallback={<FullPageLoader />}>
          <Routes>
            {/* ---------------- Publico ---------------- */}
            <Route element={<PublicLayout />}>
              <Route index element={<Landing />} />
              <Route path="servicios" element={<ServicesPage />} />
              <Route path="barberos" element={<BarbersPage />} />
              <Route path="cursos" element={<CoursesCatalog />} />
              <Route path="cursos/:id" element={<CourseDetail />} />
              <Route path="contacto" element={<ContactPage />} />
            </Route>

            {/* Login y registro: solo para quien no tiene sesion */}
            <Route element={<RequireGuest />}>
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Register />} />
            </Route>

            {/* ---------------- Cliente ---------------- */}
            <Route element={<RequireRole allow={[ROLES.CLIENTE]} />}>
              <Route path="/cliente" element={<ClientLayout />}>
                <Route index element={<ClientDashboard />} />
                <Route path="agendar" element={<BookAppointment />} />
                <Route path="citas" element={<MyAppointments />} />
                <Route path="mensajes" element={<ClientMessages />} />
                <Route path="cursos" element={<MyCourses />} />
                <Route path="perfil" element={<Profile />} />
              </Route>
            </Route>

            {/* ---------------- Barbero ---------------- */}
            <Route element={<RequireRole allow={[ROLES.BARBERO]} />}>
              <Route path="/barbero" element={<PanelLayout role={ROLES.BARBERO} />}>
                <Route index element={<BarberDashboard />} />
                <Route path="agenda" element={<BarberAgenda />} />
                <Route path="citas" element={<BarberAppointments />} />
                <Route path="bloqueos" element={<BarberBlocks />} />
                <Route path="servicios" element={<BarberServices />} />
                <Route path="cursos" element={<BarberCourses />} />
                <Route path="cursos/nuevo" element={<CourseEditor />} />
                <Route path="cursos/:id/editar" element={<CourseEditor />} />
                <Route path="cursos/:id/inscritos" element={<CourseStudents />} />
                <Route path="estadisticas" element={<BarberStats />} />
                <Route path="perfil" element={<Profile />} />
              </Route>
            </Route>

            {/* ---------------- Administrador ---------------- */}
            <Route element={<RequireRole allow={[ROLES.ADMIN]} />}>
              <Route path="/admin" element={<PanelLayout role={ROLES.ADMIN} />}>
                <Route index element={<AdminDashboard />} />
                <Route path="citas" element={<AdminAppointments />} />
                <Route path="servicios" element={<AdminServices />} />
                <Route path="galeria" element={<AdminGallery />} />
                <Route path="barberos" element={<AdminBarbers />} />
                <Route path="clientes" element={<AdminClients />} />
                <Route path="clientes/:id" element={<AdminClientDetail />} />
                <Route path="cursos" element={<AdminCourses />} />
                <Route path="cursos/:id/inscritos" element={<CourseStudents />} />
                <Route path="negocio" element={<AdminBusiness />} />
                <Route path="perfil" element={<Profile />} />
              </Route>
            </Route>

            {/* ---------------- 404 ---------------- */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </RouteBoundary>

      {/* Indicador de MODO DEMO (solo si VITE_USE_MOCK=true) */}
      <DemoBadge />
    </>
  )
}
