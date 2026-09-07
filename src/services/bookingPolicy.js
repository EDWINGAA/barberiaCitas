/**
 * Reglas de quien puede reservar, y cuando no.
 *
 * Nucleo puro: no toca la base de datos ni sabe si estamos en modo demo
 * o en Firebase. Recibe las citas del cliente y decide. Lo usan las DOS
 * implementaciones, para que la politica sea exactamente la misma.
 *
 * Que problema resuelve
 * ---------------------
 * Sin limites, cualquiera con una cuenta puede llenar la agenda de un
 * barbero con citas que no piensa cumplir. Esas horas dejan de estar
 * disponibles para clientes de verdad, y el barbero pierde el dia
 * esperando a gente que no aparece.
 *
 * Los tres limites atacan las tres formas de hacerlo:
 *
 *   1. Acaparar horas   -> solo una cita activa a la vez.
 *   2. Reservar y soltar -> tope de cancelaciones en pocos dias.
 *   3. No presentarse    -> tope de inasistencias.
 *
 * Ninguno estorba a un cliente normal: reservar, ir, y volver a reservar
 * queda muy por debajo de todos ellos.
 */

import {
  APPOINTMENT_STATUS,
  CANCELLATION_WINDOW_DAYS,
  MAX_ACTIVE_APPOINTMENTS,
  MAX_RECENT_CANCELLATIONS,
  MAX_RECENT_NO_SHOWS,
  NO_SHOW_WINDOW_DAYS,
} from '@/constants'

/** Una cita "activa" es la que sigue ocupando un hueco en la agenda */
export const ACTIVE_APPOINTMENT_STATUS = [
  APPOINTMENT_STATUS.PENDIENTE,
  APPOINTMENT_STATUS.CONFIRMADA,
]

/** Citas del cliente que siguen en pie */
export function activeAppointmentsOf(appointments = []) {
  return appointments.filter((a) => ACTIVE_APPOINTMENT_STATUS.includes(a.status))
}

/** "2026-09-07" menos N dias, en el mismo formato */
function diasAntes(hoyISO, dias) {
  const d = new Date(`${hoyISO}T12:00:00`)
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

/**
 * Decide si un cliente puede reservar.
 *
 * @param {object[]} appointments  TODAS las citas del cliente
 * @param {string}   today         fecha de hoy, "YYYY-MM-DD"
 * @param {string}   ignoreId      cita que no cuenta (al reagendar)
 * @returns {{code:string, message:string}|null}  null si puede reservar
 */
export function checkCanBook({ appointments = [], today, ignoreId = null }) {
  const mias = appointments.filter((a) => a.id !== ignoreId)

  /* --- 1. Una cita activa a la vez --- */
  const activas = activeAppointmentsOf(mias)
  if (activas.length >= MAX_ACTIVE_APPOINTMENTS) {
    const cita = activas[0]
    return {
      code: 'appointments/already-active',
      message:
        MAX_ACTIVE_APPOINTMENTS === 1
          ? `Ya tienes una cita agendada para el ${cita.date} a las ${cita.startTime}. ` +
            'Cancelala si quieres reservar otra.'
          : `Solo puedes tener ${MAX_ACTIVE_APPOINTMENTS} citas activas a la vez.`,
    }
  }

  /* --- 2. Demasiadas cancelaciones seguidas --- */
  const desdeCancel = diasAntes(today, CANCELLATION_WINDOW_DAYS)
  const canceladas = mias.filter(
    (a) => a.status === APPOINTMENT_STATUS.CANCELADA && String(a.date) >= desdeCancel
  )
  if (canceladas.length >= MAX_RECENT_CANCELLATIONS) {
    return {
      code: 'appointments/too-many-cancellations',
      message:
        `Has cancelado ${canceladas.length} citas en los ultimos ${CANCELLATION_WINDOW_DAYS} dias. ` +
        'Para volver a reservar, llama a la barberia.',
    }
  }

  /* --- 3. Demasiadas inasistencias --- */
  const desdeNoShow = diasAntes(today, NO_SHOW_WINDOW_DAYS)
  const faltas = mias.filter(
    (a) => a.status === APPOINTMENT_STATUS.NO_SHOW && String(a.date) >= desdeNoShow
  )
  if (faltas.length >= MAX_RECENT_NO_SHOWS) {
    return {
      code: 'appointments/too-many-no-shows',
      message:
        `Faltaste a ${faltas.length} citas sin avisar. ` +
        'Para volver a reservar por internet, pasa por la barberia o llamanos.',
    }
  }

  return null
}

export default checkCanBook
