/**
 * Utilidades de fecha y hora.
 *
 * Convencion de toda la app:
 *   - las fechas se guardan como texto "YYYY-MM-DD"
 *   - las horas se guardan como texto "HH:mm" (24 h)
 * Trabajar con texto evita por completo los problemas de zona horaria
 * entre el navegador, el modo mock y Firestore.
 */

import { WEEKDAYS, WEEKDAYS_SHORT, MONTHS, OPENING_HOURS_KEYS } from '@/constants'

/* ------------------------------------------------------------------ */
/*  Conversiones basicas                                               */
/* ------------------------------------------------------------------ */

/** Objeto Date -> "YYYY-MM-DD" (usando la hora local, nunca UTC) */
export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "YYYY-MM-DD" -> objeto Date a medianoche local */
export function fromISODate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** "YYYY-MM-DD" + "HH:mm" -> objeto Date local */
export function toDateTime(iso, time = '00:00') {
  const [h, min] = String(time).split(':').map(Number)
  const d = fromISODate(iso)
  d.setHours(h || 0, min || 0, 0, 0)
  return d
}

/** Fecha de hoy en formato "YYYY-MM-DD" */
export function todayISO() {
  return toISODate(new Date())
}

/** Hora actual en formato "HH:mm" */
export function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/*  Minutos <-> "HH:mm"                                                */
/* ------------------------------------------------------------------ */

/** "HH:mm" -> minutos transcurridos desde medianoche */
export function timeToMinutes(time) {
  if (!time) return 0
  const [h, m] = String(time).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Minutos desde medianoche -> "HH:mm" */
export function minutesToTime(minutes) {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Suma minutos a una hora "HH:mm" y devuelve la nueva hora */
export function addMinutes(time, minutes) {
  return minutesToTime(timeToMinutes(time) + minutes)
}

/* ------------------------------------------------------------------ */
/*  Aritmetica de dias                                                 */
/* ------------------------------------------------------------------ */

/** Suma (o resta, con negativos) dias a una fecha ISO */
export function addDays(iso, days) {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Diferencia en dias completos entre dos fechas ISO (b - a) */
export function diffDays(a, b) {
  const ms = fromISODate(b).getTime() - fromISODate(a).getTime()
  return Math.round(ms / 86400000)
}

/** Indice de dia de la semana de una fecha ISO (0 = domingo) */
export function weekdayOf(iso) {
  return fromISODate(iso).getDay()
}

/** Clave de horario del negocio ("lun", "mar"...) para una fecha ISO */
export function openingKeyOf(iso) {
  return OPENING_HOURS_KEYS[weekdayOf(iso)]
}

/** Lunes de la semana a la que pertenece la fecha ISO dada */
export function startOfWeek(iso) {
  const day = weekdayOf(iso)
  const delta = day === 0 ? -6 : 1 - day // la semana arranca en lunes
  return addDays(iso, delta)
}

/** Domingo de la semana a la que pertenece la fecha ISO dada */
export function endOfWeek(iso) {
  return addDays(startOfWeek(iso), 6)
}

/** Primer dia del mes de la fecha ISO dada */
export function startOfMonth(iso) {
  const d = fromISODate(iso)
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1))
}

/** Ultimo dia del mes de la fecha ISO dada */
export function endOfMonth(iso) {
  const d = fromISODate(iso)
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/** Array de 7 fechas ISO, de lunes a domingo, para la semana de la fecha dada */
export function weekDates(iso) {
  const start = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/**
 * Rejilla de un mes para la vista calendario: siempre 6 filas x 7 columnas,
 * rellenando con dias del mes anterior y siguiente.
 */
export function monthGrid(iso) {
  const first = startOfMonth(iso)
  const gridStart = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

/** Lista inclusiva de fechas ISO entre dos fechas */
export function datesBetween(fromIso, toIso) {
  const out = []
  const total = diffDays(fromIso, toIso)
  if (total < 0) return out
  for (let i = 0; i <= total; i += 1) out.push(addDays(fromIso, i))
  return out
}

/* ------------------------------------------------------------------ */
/*  Comparaciones                                                      */
/* ------------------------------------------------------------------ */

export function isToday(iso) {
  return iso === todayISO()
}

export function isPastDate(iso) {
  return iso < todayISO()
}

export function isFutureDate(iso) {
  return iso > todayISO()
}

/** true si la fecha ISO cae dentro del rango [from, to] (ambos inclusive) */
export function isWithin(iso, from, to) {
  if (from && iso < from) return false
  if (to && iso > to) return false
  return true
}

/** true si el instante fecha+hora ya paso */
export function isPastDateTime(iso, time) {
  return toDateTime(iso, time).getTime() < Date.now()
}

/** Horas que faltan (puede ser negativo) hasta el instante fecha+hora */
export function hoursUntil(iso, time) {
  return (toDateTime(iso, time).getTime() - Date.now()) / 3600000
}

/**
 * Dos intervalos horarios [aStart, aEnd) y [bStart, bEnd) se solapan.
 * Se usa para detectar dobles reservas y choques con bloqueos o cursos.
 */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  const a1 = timeToMinutes(aStart)
  const a2 = timeToMinutes(aEnd)
  const b1 = timeToMinutes(bStart)
  const b2 = timeToMinutes(bEnd)
  return a1 < b2 && b1 < a2
}

/* ------------------------------------------------------------------ */
/*  Formateo para la interfaz                                          */
/* ------------------------------------------------------------------ */

/** "2026-09-04" -> "4 de septiembre de 2026" */
export function formatLongDate(iso) {
  if (!iso) return ''
  const d = fromISODate(iso)
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
}

/** "2026-09-04" -> "viernes, 4 de septiembre" */
export function formatWeekdayDate(iso) {
  if (!iso) return ''
  const d = fromISODate(iso)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

/** "2026-09-04" -> "04 sep" */
export function formatShortDate(iso) {
  if (!iso) return ''
  const d = fromISODate(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

/** "2026-09-04" -> "Vie 04" */
export function formatDayChip(iso) {
  if (!iso) return ''
  const d = fromISODate(iso)
  return `${WEEKDAYS_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`
}

/** "14:30" -> "2:30 PM" */
export function formatTime12(time) {
  if (!time) return ''
  const [h, m] = String(time).split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Rango horario legible: "10:00 - 11:00" */
export function formatTimeRange(start, end) {
  return `${formatTime12(start)} - ${formatTime12(end)}`
}

/** "Hoy", "Manana", "Ayer" o la fecha larga */
export function formatRelativeDay(iso) {
  const delta = diffDays(todayISO(), iso)
  if (delta === 0) return 'Hoy'
  if (delta === 1) return 'Manana'
  if (delta === -1) return 'Ayer'
  return formatWeekdayDate(iso)
}

/** Duracion en minutos -> "1 h 30 min" */
export function formatDuration(minutes) {
  const m = Number(minutes) || 0
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h && rest) return `${h} h ${rest} min`
  if (h) return `${h} h`
  return `${rest} min`
}

/** Marca de tiempo ISO completa -> "04/09/2026 11:20" */
export function formatTimestamp(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} ${time}`
}

/* ------------------------------------------------------------------ */
/*  Rejilla de horarios                                                */
/* ------------------------------------------------------------------ */

/**
 * Genera las horas de inicio candidatas entre open y close.
 * Solo devuelve huecos donde la duracion completa cabe antes del cierre.
 *
 * @param {string} open      hora de apertura "HH:mm"
 * @param {string} close     hora de cierre "HH:mm"
 * @param {number} step      salto entre huecos, en minutos
 * @param {number} duration  duracion del servicio, en minutos
 */
export function buildTimeGrid(open, close, step, duration) {
  const out = []
  const start = timeToMinutes(open)
  const end = timeToMinutes(close)
  for (let t = start; t + duration <= end; t += step) {
    out.push(minutesToTime(t))
  }
  return out
}
