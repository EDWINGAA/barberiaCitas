/**
 * Utilidades de formateo y helpers de presentacion.
 */

import { CURRENCY_SYMBOL } from '@/constants'

/** 350 -> "$350.00" */
export function formatMoney(value) {
  const n = Number(value) || 0
  return `${CURRENCY_SYMBOL}${n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** 12500 -> "$12,500" (sin decimales, para tarjetas de metricas) */
export function formatMoneyShort(value) {
  const n = Number(value) || 0
  return `${CURRENCY_SYMBOL}${Math.round(n).toLocaleString('es-MX')}`
}

/** 0.235 -> "23.5%" */
export function formatPercent(value, decimals = 1) {
  const n = Number(value) || 0
  return `${(n * 100).toFixed(decimals)}%`
}

/** 1234 -> "1,234" */
export function formatNumber(value) {
  return (Number(value) || 0).toLocaleString('es-MX')
}

/** "Marlon Aaron Hernandez" -> "MA" */
export function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** Primer nombre de una persona */
export function firstName(name = '') {
  return String(name).trim().split(/\s+/)[0] || ''
}

/** Corta un texto largo anadiendo puntos suspensivos */
export function truncate(text = '', max = 120) {
  const s = String(text)
  return s.length > max ? `${s.slice(0, max).trimEnd()}...` : s
}

/** Telefono a 10 digitos -> "55 1234 5678" */
export function formatPhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length === 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`
  return phone
}

/** Primera letra en mayuscula */
export function capitalize(text = '') {
  const s = String(text)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Normaliza texto para busquedas: minusculas y sin acentos.
 * "Núñez" -> "nunez"
 */
export function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Une clases condicionales de Tailwind ignorando valores vacios */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Porcentaje de ocupacion de un curso (0 a 1), acotado para la barra de cupo.
 */
export function occupancyRatio(enrolled, capacity) {
  const cap = Number(capacity) || 0
  if (cap <= 0) return 0
  return Math.min(1, Math.max(0, (Number(enrolled) || 0) / cap))
}

/** Texto de disponibilidad de cupo de un curso */
export function seatsLabel(enrolled, capacity) {
  const left = Math.max(0, (Number(capacity) || 0) - (Number(enrolled) || 0))
  if (left === 0) return 'Cupo lleno'
  if (left === 1) return 'Ultimo lugar'
  return `${left} lugares disponibles`
}
