import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
export function cn(...i: ClassValue[]) { return twMerge(clsx(i)) }
export function formatCurrency(n: number) { return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) }
export function formatDate(d: string, fmt='dd/MM/yyyy HH:mm') { try { return format(parseISO(d),fmt,{locale:es}) } catch { return d } }
export function calcularTiempoTranscurrido(f: string) {
  const d = Math.floor((Date.now()-new Date(f).getTime())/60000)
  if (d < 1) return 'Ahora'
  if (d < 60) return `${d}m`
  return `${Math.floor(d/60)}h ${d%60}m`
}
