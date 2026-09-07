import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send } from 'lucide-react'

import { CHAT_POLL_MS, CHAT_WRITABLE_STATUS, MESSAGE_MAX_LENGTH } from '@/constants'
import { cn } from '@/utils/format'
import { formatRelativeDay } from '@/utils/date'
import services from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/context/ToastContext'
import { Avatar, Modal, Spinner } from '@/components/ui'

/** ISO -> "14:32" */
function hhmm(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Clave de dia "YYYY-MM-DD" a partir de un ISO */
function dayKey(iso) {
  return String(iso).slice(0, 10)
}

/**
 * Chat privado entre el cliente y el barbero de una cita.
 *
 * Se muestra dentro de su propia ventana modal: los paneles solo tienen
 * que pasarle la cita y quien la mira. Mientras esta abierto vuelve a
 * pedir los mensajes cada pocos segundos (el proyecto no usa realtime) y
 * marca como leidos los del otro lado.
 *
 * @param {object}   appointment   cita a la que pertenece el hilo (null = cerrado)
 * @param {object}   me            usuario actual { uid, role, name, photoURL }
 * @param {object}   counterpart   la otra persona { name, photoURL }
 * @param {Function} onClose
 * @param {Function} [onActivity]  se llama tras leer o enviar, para refrescar contadores
 */
export function AppointmentChat({ appointment, me, counterpart, onClose, onActivity }) {
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const activityRef = useRef(onActivity)
  activityRef.current = onActivity

  const appointmentId = appointment?.id || null
  const canWrite = appointment ? CHAT_WRITABLE_STATUS.includes(appointment.status) : false

  const loader = useCallback(() => {
    if (!appointmentId) return Promise.resolve([])
    return services.messages.listThread({ appointmentId, userId: me.uid, role: me.role })
  }, [appointmentId, me.uid, me.role])

  const { data: messages, loading, error, reload } = useAsync(loader, [appointmentId], {
    enabled: Boolean(appointmentId),
    initialData: [],
  })

  /* --------- Marcar como leidos los mensajes del otro lado --------- */
  const markRead = useCallback(async () => {
    if (!appointmentId) return
    try {
      const touched = await services.messages.markRead({
        appointmentId,
        userId: me.uid,
        role: me.role,
      })
      if (touched) activityRef.current?.()
    } catch {
      // Leer no es critico: si falla, se reintenta en el siguiente ciclo
    }
  }, [appointmentId, me.uid, me.role])

  useEffect(() => {
    if (!appointmentId) return
    // Solo llama al servidor si hay algo del otro lado sin leer
    const field = me.role === 'barbero' ? 'readByBarber' : 'readByClient'
    const hayPendientes = (messages || []).some((m) => m.senderId !== me.uid && !m[field])
    if (hayPendientes) markRead()
  }, [appointmentId, messages, markRead, me.role, me.uid])

  /* --------- Refresco periodico mientras el chat esta abierto --------- */
  useEffect(() => {
    if (!appointmentId) return undefined
    const id = setInterval(() => {
      reload()
    }, CHAT_POLL_MS)
    return () => clearInterval(id)
  }, [appointmentId, reload])

  /* --------- Autoscroll al ultimo mensaje --------- */
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  /* --------- Mensajes agrupados por dia --------- */
  const grupos = useMemo(() => {
    const out = []
    ;(messages || []).forEach((m) => {
      const key = dayKey(m.createdAt)
      const ultimo = out[out.length - 1]
      if (ultimo && ultimo.key === key) ultimo.items.push(m)
      else out.push({ key, items: [m] })
    })
    return out
  }, [messages])

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending || !canWrite) return
    setSending(true)
    try {
      await services.messages.send({ appointmentId, senderId: me.uid, text })
      setDraft('')
      await reload()
      activityRef.current?.()
    } catch (err) {
      toast.error(err?.message || 'No pudimos enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <Modal
      open={Boolean(appointment)}
      onClose={onClose}
      title={counterpart?.name || 'Conversacion'}
      description={
        appointment
          ? `${appointment.serviceName || 'Cita'} · ${formatRelativeDay(appointment.date)} ${appointment.startTime}`
          : ''
      }
      size="lg"
    >
      <div className="flex h-[60vh] flex-col">
        {/* Con quien hablas */}
        <div className="mb-3 flex items-center gap-2.5 border-b border-ink-700/70 pb-3">
          <Avatar src={counterpart?.photoURL} name={counterpart?.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-100">
              {counterpart?.name || 'Conversacion'}
            </p>
            <p className="text-xs text-ink-500">
              {me.role === 'barbero' ? 'Cliente de esta cita' : 'Tu barbero'}
            </p>
          </div>
        </div>

        {/* ---------- Mensajes ---------- */}
        <div
          ref={scrollRef}
          className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1 pb-2"
        >
          {loading && (!messages || messages.length === 0) ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-rose-300">
              No pudimos cargar la conversacion.
            </p>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-500">
              Aun no hay mensajes. Escribe el primero.
            </p>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.key} className="space-y-2">
                <div className="flex justify-center">
                  <span className="rounded-full bg-ink-800 px-2.5 py-0.5 text-[11px] text-ink-400">
                    {formatRelativeDay(grupo.key)}
                  </span>
                </div>

                {grupo.items.map((m) => {
                  const mine = m.senderId === me.uid
                  return (
                    <div
                      key={m.id}
                      className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                          mine
                            ? 'rounded-br-md bg-gold-500/15 text-gold-50 ring-1 ring-inset ring-gold-500/25'
                            : 'rounded-bl-md bg-ink-800 text-ink-100'
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p
                          className={cn(
                            'mt-1 text-[10px]',
                            mine ? 'text-gold-200/60' : 'text-ink-500'
                          )}
                        >
                          {hhmm(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* ---------- Redaccion ---------- */}
        {canWrite ? (
          <div className="mt-3 border-t border-ink-700/70 pt-3">
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje..."
                className="max-h-32 min-h-[42px] flex-1 resize-y rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition focus:border-gold-500"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                aria-label="Enviar mensaje"
                className={cn(
                  'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl transition',
                  'bg-gold-500 text-ink-950 hover:bg-gold-400',
                  'disabled:cursor-not-allowed disabled:opacity-40'
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-600">
              Enter para enviar · Shift+Enter para salto de linea
            </p>
          </div>
        ) : (
          <p className="mt-3 border-t border-ink-700/70 pt-3 text-center text-xs text-ink-500">
            Esta conversacion es de solo lectura: la cita ya no esta confirmada.
          </p>
        )}
      </div>
    </Modal>
  )
}

export default AppointmentChat
