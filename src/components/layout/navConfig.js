/**
 * Definicion de la navegacion de cada panel.
 * Centralizarla aqui evita duplicar los enlaces entre el sidebar de
 * escritorio y el menu hamburguesa de movil.
 */

import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  GraduationCap,
  Images,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Scissors,
  Settings,
  ShieldCheck,
  Store,
  User,
  UserCog,
  Users,
} from 'lucide-react'

/** Navegacion del panel del BARBERO */
export const BARBER_NAV = [
  {
    section: 'Agenda',
    items: [
      { to: '/barbero', label: 'Resumen', icon: LayoutDashboard, end: true },
      { to: '/barbero/agenda', label: 'Mi agenda', icon: CalendarRange },
      { to: '/barbero/citas', label: 'Citas', icon: ClipboardList },
      { to: '/barbero/bloqueos', label: 'Bloquear horarios', icon: CalendarDays },
    ],
  },
  {
    section: 'Mi oferta',
    items: [
      { to: '/barbero/servicios', label: 'Mis servicios', icon: Scissors },
    ],
  },
  {
    section: 'Escuela',
    items: [
      { to: '/barbero/cursos', label: 'Mis cursos', icon: GraduationCap },
    ],
  },
  {
    section: 'Cuenta',
    items: [
      { to: '/barbero/estadisticas', label: 'Estadisticas', icon: BarChart3 },
      { to: '/barbero/perfil', label: 'Mi perfil', icon: User },
    ],
  },
]

/** Navegacion del panel del ADMINISTRADOR */
export const ADMIN_NAV = [
  {
    section: 'General',
    items: [{ to: '/admin', label: 'Tablero', icon: LayoutDashboard, end: true }],
  },
  {
    section: 'Operacion',
    items: [
      { to: '/admin/citas', label: 'Citas', icon: ClipboardList },
      { to: '/admin/servicios', label: 'Servicios', icon: Scissors },
      { to: '/admin/galeria', label: 'Galeria de fotos', icon: Images },
      { to: '/admin/barberos', label: 'Barberos', icon: UserCog },
      { to: '/admin/clientes', label: 'Clientes', icon: Users },
    ],
  },
  {
    section: 'Escuela',
    items: [{ to: '/admin/cursos', label: 'Cursos', icon: GraduationCap }],
  },
  {
    section: 'Configuracion',
    items: [
      { to: '/admin/negocio', label: 'Mi negocio', icon: Store },
      { to: '/admin/perfil', label: 'Mi perfil', icon: User },
    ],
  },
]

/** Enlaces del area de CLIENTE (barra superior, no sidebar) */
export const CLIENT_NAV = [
  { to: '/cliente', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/cliente/agendar', label: 'Agendar cita', icon: CalendarDays },
  { to: '/cliente/citas', label: 'Mis citas', icon: ListChecks },
  { to: '/cliente/mensajes', label: 'Mensajes', icon: MessageSquare },
  { to: '/cliente/cursos', label: 'Mis cursos', icon: GraduationCap },
  { to: '/cliente/perfil', label: 'Mi perfil', icon: User },
]

/** Enlaces del sitio publico */
export const PUBLIC_NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/servicios', label: 'Servicios' },
  { to: '/barberos', label: 'Barberos' },
  { to: '/cursos', label: 'Cursos' },
  { to: '/contacto', label: 'Contacto' },
]

/** Iconos auxiliares reexportados para las cabeceras de seccion */
export const NAV_ICONS = { ShieldCheck, Settings }
