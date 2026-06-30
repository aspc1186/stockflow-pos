import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
export function cn(...i: ClassValue[]) { return twMerge(clsx(i)) }
export function formatCurrency(v: number, c='COP') {
  return new Intl.NumberFormat('es-CO',{style:'currency',currency:c,minimumFractionDigits:0,maximumFractionDigits:0}).format(v)
}
export function formatDate(d: string|Date, fmt='dd/MM/yyyy HH:mm') {
  return format(new Date(d), fmt, {locale:es})
}
export function timeAgo(d: string|Date) { return formatDistanceToNow(new Date(d),{addSuffix:true,locale:es}) }
export function calcularTiempoTranscurrido(desde: string) {
  const diff = Math.floor((Date.now()-new Date(desde).getTime())/1000)
  const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
export function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
}
export function generateUsername(nombre: string) {
  return nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'.').slice(0,30)
}
export function calcularSubtotal(q:number,p:number){return Number((q*p).toFixed(2))}
export function calcularImpuesto(s:number,pct:number){return Number((s*pct/100).toFixed(2))}
