import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpFromLine, BarChart3, Boxes, CalendarDays, ClipboardList, ContactRound, CreditCard, LogOut, Package, QrCode, ReceiptText, Settings2, ShoppingBag, ShoppingCart, Store, Users, UtensilsCrossed } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { MODULOS_PLATAFORMA, planNormalizado, type ModuloPlataforma } from '@/config/modules.config'
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
type Tarjeta = { id: string; titulo: string; detalle: string; icono: React.ReactNode; acento: Accento; ruta?: string; accion?: 'productos' | 'salir' }

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
  return <button type="button" aria-label={`${tarjeta.titulo}: ${tarjeta.detalle}`} onClick={onClick} className={`group flex w-full flex-col rounded-2xl border p-5 text-left shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-400 ${secundaria ? 'min-h-52' : 'min-h-64'} ${estilos[tarjeta.acento]}`}>
    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-current/30 bg-surface-950/25 text-current">{tarjeta.icono}</span>
    <div className="mt-auto"><h2 className="text-2xl font-bold text-surface-50">{tarjeta.titulo}</h2><p className="mt-2 max-w-[20ch] text-base leading-6 text-surface-100/85">{tarjeta.detalle}</p><ArrowRight className="mt-4 h-7 w-7 transition-transform group-hover:translate-x-1" /></div>
  </button>
}

function ResumenRapido({ icono, etiqueta, valor, acento }: { icono: React.ReactNode; etiqueta: string; valor: string; acento: string }) {
  return <div className="flex min-w-0 items-center gap-3 px-4 py-3"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${acento}`}>{icono}</span><div className="min-w-0"><p className="text-sm text-surface-200/70">{etiqueta}</p><p className="truncate text-lg font-bold text-surface-50">{valor}</p></div></div>
}

export default function ClientHomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [nivel, setNivel] = useState<'inicio' | 'productos'>('inicio')
  const [busqueda, setBusqueda] = useState('')
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
    tiene('pedidos') && { id: 'venta', titulo: esServicio ? 'Nueva atencion' : 'Nueva venta', detalle: esServicio ? 'Registrar un servicio o atencion' : 'Crear una venta rapida o para llevar', icono: <ShoppingCart className="h-9 w-9" />, acento: 'emerald', ruta: '/app/pedidos' },
    usaMesas && tiene('mesas') && { id: 'mesas', titulo: esServicio ? 'Puestos y atencion' : 'Mesas', detalle: esServicio ? 'Gestionar sillas, cabinas y atenciones' : 'Gestionar mesas y comandas', icono: esServicio ? <Users className="h-9 w-9" /> : <UtensilsCrossed className="h-9 w-9" />, acento: 'sky', ruta: '/app/mesas' },
    tiene('pedidos') && { id: 'pedidos', titulo: esServicio ? 'Servicios' : 'Pedidos', detalle: esServicio ? 'Ver atenciones activas y seguimiento' : 'Ver pedidos activos y comandas', icono: <ClipboardList className="h-9 w-9" />, acento: 'violet', ruta: '/app/pedidos' },
    tiene('productos') && { id: 'productos', titulo: 'Productos', detalle: 'Gestionar productos, precios e inventario', icono: <Package className="h-9 w-9" />, acento: 'orange', accion: 'productos' },
    tiene('caja') && { id: 'caja', titulo: 'Caja', detalle: 'Apertura, cierre y movimientos de caja', icono: <CreditCard className="h-9 w-9" />, acento: 'cyan', ruta: '/app/caja' },
  ].filter(Boolean) as Tarjeta[]

  const secundarias: Tarjeta[] = [
    tiene('reportes') && { id: 'reportes', titulo: 'Reportes', detalle: 'Ventas, productos, inventario y mas', icono: <BarChart3 className="h-8 w-8" />, acento: 'amber', ruta: '/app/reportes' },
    tiene('clientes') && { id: 'clientes', titulo: 'Clientes', detalle: 'Gestionar clientes y facturacion', icono: <ContactRound className="h-8 w-8" />, acento: 'pink', ruta: '/app/clientes' },
    tiene('configuracion') && { id: 'configuracion', titulo: 'Configuracion', detalle: 'Ajustes, usuarios y permisos', icono: <Settings2 className="h-8 w-8" />, acento: 'green', ruta: '/app/configuracion' },
    { id: 'salir', titulo: 'Cerrar sesion', detalle: 'Salir de StockFlow POS', icono: <LogOut className="h-8 w-8" />, acento: 'blue', accion: 'salir' },
  ].filter(Boolean) as Tarjeta[]

  const productos: Tarjeta[] = [
    tiene('productos') && { id: 'maestro', titulo: 'Maestro de productos', detalle: 'Catalogo, precios y codigos', icono: <Package className="h-8 w-8" />, acento: 'orange', ruta: '/app/productos' },
    tiene('inventario') && { id: 'inventario', titulo: 'Inventario', detalle: 'Existencias y movimientos', icono: <Boxes className="h-8 w-8" />, acento: 'sky', ruta: '/app/inventario' },
    tiene('barras') && { id: 'entrada', titulo: 'Entrada', detalle: 'Registrar mercancia por codigo', icono: <ArrowDownToLine className="h-8 w-8" />, acento: 'emerald', ruta: '/app/escanear/barras?tipo=entrada' },
    tiene('barras') && { id: 'salida', titulo: 'Salida', detalle: 'Descontar producto por codigo', icono: <ArrowUpFromLine className="h-8 w-8" />, acento: 'pink', ruta: '/app/escanear/barras?tipo=salida' },
    tiene('conteos') && { id: 'conteos', titulo: 'Conteos', detalle: 'Conteo general y ciclico con QR', icono: <QrCode className="h-8 w-8" />, acento: 'violet', ruta: '/app/escanear/qr' },
  ].filter(Boolean) as Tarjeta[]

  const filtro = (tarjeta: Tarjeta) => `${tarjeta.titulo} ${tarjeta.detalle}`.toLowerCase().includes(busqueda.toLowerCase())
  const visibles = nivel === 'productos' ? productos.filter(filtro) : principales.filter(filtro)
  const ejecutar = (tarjeta: Tarjeta) => {
    if (tarjeta.accion === 'productos') return setNivel('productos')
    if (tarjeta.accion === 'salir') { if (window.confirm('Deseas cerrar la sesion actual?')) logout(); return }
    if (tarjeta.ruta) navigate(tarjeta.ruta)
  }
  const fecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date())

  return <div className="mx-auto max-w-[1560px] space-y-6 pb-4">
    <header className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3"><img src="/images/stockflow-login.png" alt="StockFlow POS" className="h-14 w-14 rounded-xl object-cover object-left" /><div><p className="text-2xl font-bold text-surface-50">StockFlow <span className="text-emerald-400">POS</span></p><p className="text-sm text-surface-200/70">Sistema de Punto de Venta</p></div></div>
      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-surface-800/75 px-4 py-3"><span className="rounded-xl bg-brand-500/15 p-2.5 text-brand-300"><Store className="h-6 w-6" /></span><div className="min-w-0"><p className="truncate text-lg font-semibold text-surface-50">{empresa?.nombre || 'Tu negocio'}</p><p className="truncate text-sm text-surface-200/70">{user?.rol || 'Usuario'} · Caja {formatCurrency(stats?.caja_actual || 0)}</p></div></div>
    </header>

    <div className="flex flex-col items-center gap-4 text-center"><div><h1 className="text-4xl font-bold text-surface-50 sm:text-5xl">Bienvenido, {user?.nombre?.split(' ')[0] || 'usuario'}</h1><p className="mt-2 text-xl text-surface-200/75">Que deseas hacer hoy?</p></div><input value={busqueda} onChange={event => setBusqueda(event.target.value)} className="input h-12 w-full max-w-md" placeholder="Buscar una actividad" /></div>

    {nivel === 'productos' && <div className="flex items-center justify-between"><button type="button" onClick={() => setNivel('inicio')} className="btn-secondary min-h-11"><ArrowLeft className="h-4 w-4" />Volver</button><p className="text-sm text-surface-200/70">Productos e inventario</p></div>}
    <section className={`grid gap-5 ${nivel === 'productos' ? 'sm:grid-cols-2 xl:grid-cols-5' : 'sm:grid-cols-2 xl:grid-cols-5'}`}>
      {visibles.map(tarjeta => <TarjetaModulo key={tarjeta.id} tarjeta={tarjeta} onClick={() => ejecutar(tarjeta)} />)}
    </section>
    {visibles.length === 0 && <div className="card p-8 text-center text-surface-200/70">No hay actividades disponibles que coincidan con la busqueda.</div>}

    {nivel === 'inicio' && <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><>{secundarias.filter(filtro).map(tarjeta => <TarjetaModulo key={tarjeta.id} tarjeta={tarjeta} onClick={() => ejecutar(tarjeta)} secundaria />)}</></section>}

    {nivel === 'inicio' && <footer className="card grid divide-y divide-white/10 overflow-hidden sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      <ResumenRapido icono={<CalendarDays className="h-6 w-6 text-sky-300" />} etiqueta="Jornada" valor={fecha} acento="bg-sky-500/15" />
      <ResumenRapido icono={<BarChart3 className="h-6 w-6 text-emerald-300" />} etiqueta="Ventas del dia" valor={formatCurrency(stats?.ventas_hoy || 0)} acento="bg-emerald-500/15" />
      <ResumenRapido icono={<ClipboardList className="h-6 w-6 text-violet-300" />} etiqueta="Pedidos activos" valor={String(stats?.pedidos_activos || 0)} acento="bg-violet-500/15" />
      <ResumenRapido icono={usaMesas ? <Users className="h-6 w-6 text-orange-300" /> : <Boxes className="h-6 w-6 text-orange-300" />} etiqueta={usaMesas ? 'Mesas ocupadas' : 'Stock critico'} valor={usaMesas ? `${stats?.mesas_ocupadas || 0} / ${(stats?.mesas_ocupadas || 0) + (stats?.mesas_libres || 0)}` : String(stats?.inventario_critico || 0)} acento="bg-orange-500/15" />
    </footer>}
  </div>
}
