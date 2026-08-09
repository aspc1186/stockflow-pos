import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpFromLine, Barcode, BarChart3, Boxes, CalendarDays, ClipboardList, QrCode, ReceiptText, Settings2, Store, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { MODULOS_PLATAFORMA, planNormalizado, type GrupoModulo, type ModuloPlataforma } from '@/config/modules.config'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import type { DashboardStats } from '@/types'

const limitesPorRol: Record<string, string[]> = {
  admin: [], supervisor: [], cajero: ['dashboard', 'caja', 'pedidos', 'mesas'],
  mesero: ['mesas', 'pedidos'], barra: ['pedidos', 'productos'], cocina: ['pedidos'],
}

function permitido(modulo: ModuloPlataforma, rol: string, plan: string, tipo: string, extras: string[]) {
  const idsRol = limitesPorRol[rol] ?? []
  return modulo.disponible
    && (!idsRol.length || idsRol.includes(modulo.id))
    && (modulo.planes.includes(planNormalizado(plan)) || extras.includes(modulo.id))
    && (!modulo.negocios || modulo.negocios.includes(tipo))
}

type Accento = 'emerald' | 'sky' | 'violet' | 'orange' | 'cyan' | 'amber' | 'pink' | 'green' | 'blue'
type Tarjeta = { id: string; titulo: string; detalle: string; icono: React.ReactNode; acento: Accento; ruta?: string; accion?: GrupoModulo | 'salir' }

const estilos: Record<Accento, string> = {
  emerald: 'border-emerald-400/70 bg-emerald-500/10 hover:bg-emerald-500/15',
  sky: 'border-sky-400/70 bg-sky-500/10 hover:bg-sky-500/15',
  violet: 'border-violet-400/70 bg-violet-500/10 hover:bg-violet-500/15',
  orange: 'border-orange-400/70 bg-orange-500/10 hover:bg-orange-500/15',
  cyan: 'border-cyan-400/70 bg-cyan-500/10 hover:bg-cyan-500/15',
  amber: 'border-amber-400/70 bg-amber-500/10 hover:bg-amber-500/15',
  pink: 'border-pink-400/70 bg-pink-500/10 hover:bg-pink-500/15',
  green: 'border-green-400/70 bg-green-500/10 hover:bg-green-500/15',
  blue: 'border-blue-400/70 bg-blue-500/10 hover:bg-blue-500/15',
}

function TarjetaModulo({ tarjeta, onClick, secundaria = false }: { tarjeta: Tarjeta; onClick: () => void; secundaria?: boolean }) {
  return <button type="button" aria-label={`${tarjeta.titulo}: ${tarjeta.detalle}`} data-accent={tarjeta.acento} onClick={onClick} className={`home-module-card group flex w-full flex-col rounded-lg border p-3 text-left shadow-md shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand-400 ${secundaria ? 'min-h-[96px]' : 'min-h-[116px] sm:min-h-[132px]'} ${estilos[tarjeta.acento]}`}>
    <span className={`flex items-center justify-center rounded-full border border-current/35 bg-surface-950/25 text-current ${secundaria ? 'h-8 w-8' : 'h-10 w-10'}`}>{tarjeta.icono}</span>
    <div className="mt-auto"><h2 className={`${secundaria ? 'text-base' : 'text-lg'} font-bold leading-tight text-surface-50`}>{tarjeta.titulo}</h2><p className={`mt-1 text-xs leading-4 text-surface-100/85 ${secundaria ? 'line-clamp-1' : 'line-clamp-2'}`}>{tarjeta.detalle}</p>{!secundaria && <ArrowRight className="mt-2 h-5 w-5 transition-transform group-hover:translate-x-1" />}</div>
  </button>
}

function ResumenRapido({ icono, etiqueta, valor, acento }: { icono: React.ReactNode; etiqueta: string; valor: string; acento: string }) {
  return <div className="flex min-w-0 items-center gap-3 px-4 py-3"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${acento}`}>{icono}</span><div className="min-w-0"><p className="text-sm text-surface-200/70">{etiqueta}</p><p className="truncate text-lg font-bold text-surface-50">{valor}</p></div></div>
}

export default function ClientHomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [grupoActivo, setGrupoActivo] = useState<GrupoModulo | null>(null)
  const empresa = user?.empresa
  const tipo = String(empresa?.tipo || '').toLowerCase()
  const extras = empresa?.modulos_extra || []
  const usaMesas = ['restaurante', 'bar', 'discoteca', 'cafeteria', 'cafe', 'tienda bar', 'comidas rapidas'].some(valor => tipo.includes(valor))
  const esServicio = ['barberia', 'salon', 'spa', 'estetica', 'manicure'].some(valor => tipo.includes(valor))
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const r = await api.get<any>('/dashboard')
      return (r.data.data || r.data) as DashboardStats
    },
    staleTime: 30_000,
  })
  const modulos = useMemo(() => MODULOS_PLATAFORMA.filter(modulo => permitido(modulo, user?.rol || '', empresa?.plan || 'basico', tipo, extras)), [user?.rol, empresa?.plan, tipo, extras.join('|')])
  const tiene = (id: string) => modulos.some(modulo => modulo.id === id)

  const principales: Tarjeta[] = [
    tiene('barras') && { id: 'entrada', titulo: 'Entrada', detalle: 'Registrar mercancia por codigo', icono: <span className="relative"><Barcode className="h-9 w-9"/><ArrowDownToLine className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-600 p-0.5"/></span>, acento: 'emerald', ruta: '/app/escanear/barras?tipo=entrada' },
    tiene('barras') && { id: 'salida', titulo: 'Salida', detalle: 'Descontar productos por codigo', icono: <span className="relative"><Barcode className="h-9 w-9"/><ArrowUpFromLine className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-pink-600 p-0.5"/></span>, acento: 'pink', ruta: '/app/escanear/barras?tipo=salida' },
    tiene('conteos') && { id: 'conteos', titulo: 'Conteo de inventario', detalle: 'General y ciclico con QR', icono: <QrCode className="h-9 w-9" />, acento: 'violet', ruta: '/app/escanear/qr' },
    tiene('inventario') && { id: 'inventario', titulo: 'Inventario', detalle: 'Movimientos y existencias', icono: <Boxes className="h-9 w-9" />, acento: 'sky', ruta: '/app/inventario' },
    tiene('pedidos') && { id: 'pedidos', titulo: esServicio ? 'Servicios' : 'Pedidos', detalle: esServicio ? 'Atenciones activas y seguimiento' : 'Ventas y seguimiento', icono: <ClipboardList className="h-9 w-9" />, acento: 'amber', ruta: '/app/pedidos' },
  ].filter(Boolean) as Tarjeta[]

  const grupos: Tarjeta[] = [
    modulos.some(modulo => modulo.grupo === 'Operacion') && { id: 'operacion', titulo: 'Operacion', detalle: 'Ventas, caja, pedidos y clientes', icono: <ReceiptText className="h-5 w-5" />, acento: 'blue', accion: 'Operacion' },
    modulos.some(modulo => modulo.grupo === 'Puestos y atencion') && { id: 'puestos', titulo: 'Puestos y atencion', detalle: 'Mesas, reservas y responsables', icono: <Users className="h-5 w-5" />, acento: 'violet', accion: 'Puestos y atencion' },
    modulos.some(modulo => modulo.grupo === 'Inventario y WMS') && { id: 'inventario-wms', titulo: 'Inventario y WMS', detalle: 'Existencias, escaneo y conteos', icono: <Boxes className="h-5 w-5" />, acento: 'emerald', accion: 'Inventario y WMS' },
    modulos.some(modulo => modulo.grupo === 'Administracion') && { id: 'administracion', titulo: 'Administracion', detalle: 'Usuarios, reportes y configuracion', icono: <Settings2 className="h-5 w-5" />, acento: 'amber', accion: 'Administracion' },
  ].filter(Boolean) as Tarjeta[]

  const modulosDelGrupo: Tarjeta[] = grupoActivo
    ? modulos.filter(modulo => modulo.grupo === grupoActivo).map(modulo => ({ id: modulo.id, titulo: modulo.nombre, detalle: modulo.descripcion, icono: <modulo.icono className="h-7 w-7" />, acento: 'sky' as Accento, ruta: modulo.ruta }))
    : []
  const ejecutar = (tarjeta: Tarjeta) => {
    if (tarjeta.accion === 'salir') { if (window.confirm('Deseas cerrar la sesion actual?')) logout(); return }
    if (tarjeta.accion) return setGrupoActivo(tarjeta.accion)
    if (tarjeta.ruta) navigate(tarjeta.ruta)
  }
  const fecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date())

  return <div className="mx-auto w-full max-w-[1700px] space-y-4 pb-3">
    <header className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3"><video aria-label="Logo animado StockFlow POS" autoPlay loop muted playsInline preload="metadata" poster="/images/stockflow-login.png" className="h-14 w-14 rounded-xl bg-surface-900 object-cover shadow-lg shadow-brand-500/10"><source src="/images/stockflow-logo-animated.mp4" type="video/mp4" /></video><div><p className="text-2xl font-bold text-surface-50">StockFlow <span className="text-emerald-400">POS</span></p><p className="mt-0.5 text-sm text-surface-200/70">Sistema de Punto de Venta</p></div></div>
      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-surface-800/75 px-4 py-2.5"><span className="rounded-lg bg-brand-500/15 p-2 text-brand-300"><Store className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-base font-semibold text-surface-50">{empresa?.nombre || 'Tu negocio'}</p><p className="truncate text-xs text-surface-200/70">{user?.rol || 'Usuario'} · Caja {formatCurrency(stats?.caja_actual || 0)}</p></div></div>
    </header>

    <div className="flex flex-col items-center text-center"><div><h1 className="text-2xl font-bold text-surface-50 sm:text-3xl">Bienvenido, {empresa?.nombre || 'tu negocio'}</h1><p className="mt-0.5 text-base text-surface-200/75">Que deseas hacer hoy?</p></div></div>

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {principales.map(tarjeta => <TarjetaModulo key={tarjeta.id} tarjeta={tarjeta} onClick={() => ejecutar(tarjeta)} />)}
    </section>
    {principales.length === 0 && <div className="card p-8 text-center text-surface-200/70">No hay actividades disponibles para esta empresa.</div>}

    <section className="mx-auto grid max-w-[1320px] gap-3 sm:grid-cols-2 lg:grid-cols-4">{grupos.map(tarjeta => <TarjetaModulo key={tarjeta.id} tarjeta={tarjeta} onClick={() => ejecutar(tarjeta)} secundaria />)}</section>

    {grupoActivo && <section className="card space-y-4 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-surface-50">{grupoActivo}</h2><p className="text-sm text-surface-200/70">Modulos disponibles para esta empresa</p></div><button type="button" onClick={() => setGrupoActivo(null)} className="btn-secondary min-h-10"><ArrowLeft className="h-4 w-4" />Cerrar</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{modulosDelGrupo.map(tarjeta => <TarjetaModulo key={tarjeta.id} tarjeta={tarjeta} onClick={() => ejecutar(tarjeta)} secundaria />)}</div></section>}

    {!grupoActivo && <footer className="card grid divide-y divide-white/10 overflow-hidden sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      <ResumenRapido icono={<CalendarDays className="h-6 w-6 text-sky-300" />} etiqueta="Jornada" valor={fecha} acento="bg-sky-500/15" />
      <ResumenRapido icono={<BarChart3 className="h-6 w-6 text-emerald-300" />} etiqueta="Ventas del dia" valor={formatCurrency(stats?.ventas_hoy || 0)} acento="bg-emerald-500/15" />
      <ResumenRapido icono={<ClipboardList className="h-6 w-6 text-violet-300" />} etiqueta="Pedidos activos" valor={String(stats?.pedidos_activos || 0)} acento="bg-violet-500/15" />
      <ResumenRapido icono={usaMesas ? <Users className="h-6 w-6 text-orange-300" /> : <Boxes className="h-6 w-6 text-orange-300" />} etiqueta={usaMesas ? 'Mesas ocupadas' : 'Stock critico'} valor={usaMesas ? `${stats?.mesas_ocupadas || 0} / ${(stats?.mesas_ocupadas || 0) + (stats?.mesas_libres || 0)}` : String(stats?.inventario_critico || 0)} acento="bg-orange-500/15" />
    </footer>}
  </div>
}
