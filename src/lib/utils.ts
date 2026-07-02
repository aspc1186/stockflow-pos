import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string, fmt = 'dd/MM/yyyy HH:mm'): string {
  try { return format(parseISO(dateStr), fmt, { locale: es }) }
  catch { return dateStr }
}

export function calcularTiempoTranscurrido(fecha: string): string {
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000)
  if (diff < 1) return 'Ahora'
  if (diff < 60) return `${diff}m`
  return `${Math.floor(diff / 60)}h ${diff % 60}m`
}
