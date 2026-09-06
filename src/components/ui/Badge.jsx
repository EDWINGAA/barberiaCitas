import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_STYLES,
  COURSE_LEVEL_LABELS,
  COURSE_LEVEL_STYLES,
  COURSE_MODALITY_LABELS,
  COURSE_MODALITIES,
  COURSE_STATUS_LABELS,
  COURSE_STATUS_STYLES,
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_STYLES,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
} from '@/constants'
import { cn } from '@/utils/format'

/** Etiqueta generica */
export function Badge({ children, className = '', size = 'sm', icon: Icon }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        'bg-ink-750 text-ink-200 ring-1 ring-inset ring-ink-600',
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Estado de una cita */
export function AppointmentStatusBadge({ status, size = 'sm', withDot = true }) {
  const style = APPOINTMENT_STATUS_STYLES[status]
  return (
    <Badge className={style?.badge} size={size}>
      {withDot && <span className={cn('h-1.5 w-1.5 rounded-full', style?.dot)} aria-hidden="true" />}
      {APPOINTMENT_STATUS_LABELS[status] || status}
    </Badge>
  )
}

/** Estado de un curso */
export function CourseStatusBadge({ status, size = 'sm' }) {
  return (
    <Badge className={COURSE_STATUS_STYLES[status]} size={size}>
      {COURSE_STATUS_LABELS[status] || status}
    </Badge>
  )
}

/** Nivel de un curso (principiante / intermedio / avanzado) */
export function CourseLevelBadge({ level, size = 'sm' }) {
  return (
    <Badge className={COURSE_LEVEL_STYLES[level]} size={size}>
      {COURSE_LEVEL_LABELS[level] || level}
    </Badge>
  )
}

/** Modalidad de un curso (presencial / online) */
export function CourseModalityBadge({ modality, size = 'sm' }) {
  const isOnline = modality === COURSE_MODALITIES.ONLINE
  return (
    <Badge
      className={
        isOnline
          ? 'bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-400/30'
          : 'bg-gold-500/15 text-gold-300 ring-1 ring-inset ring-gold-400/30'
      }
      size={size}
    >
      {COURSE_MODALITY_LABELS[modality] || modality}
    </Badge>
  )
}

/** Estado de una inscripcion */
export function EnrollmentStatusBadge({ status, size = 'sm' }) {
  return (
    <Badge className={ENROLLMENT_STATUS_STYLES[status]} size={size}>
      {ENROLLMENT_STATUS_LABELS[status] || status}
    </Badge>
  )
}

/** Estado de pago de una inscripcion */
export function PaymentStatusBadge({ status, size = 'xs' }) {
  const styles = {
    [PAYMENT_STATUS.PAGADO]: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
    [PAYMENT_STATUS.PENDIENTE]: 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/30',
    [PAYMENT_STATUS.REEMBOLSADO]: 'bg-ink-600/30 text-ink-300 ring-1 ring-inset ring-ink-500/40',
  }
  return (
    <Badge className={styles[status]} size={size}>
      {PAYMENT_STATUS_LABELS[status] || status}
    </Badge>
  )
}

export default Badge
