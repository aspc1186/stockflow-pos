import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, Boxes, ClipboardList, CookingPot, Package, QrCode, ReceiptText, ScanLine, Settings2, ShieldCheck, ShoppingCart, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { GRUPOS_MODULOS, MODULOS_PLATAFORMA, planNormalizado, type GrupoModulo, type ModuloPlataforma } from '@/config/modules.config'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import type { DashboardStats } from '@/types'

const resumen: Record<GrupoModulo, string> = {
  'Operacion':'Ventas, pedidos, caja, productos y clientes.',
  'Puestos y atencion':'Mesas, reservas, responsables y eventos.',
  'Inventario y WMS':'Existencias, movimientos y captura con scanner.',
  'Restaurante y recetas':'Ingredientes, recetas, costos y mermas.',
  'Administracion':'Usuarios, reportes, configuracion e integraciones.',
  'Sistema':'Herramientas tecnicas y soporte de la plataforma.',
}
const iconosGrupo: Record<GrupoModulo, any> = { 'Operacion':ShoppingCart, 'Puestos y atencion':Users, 'Inventario y WMS':Boxes, 'Restaurante y recetas':CookingPot, 'Administracion':ShieldCheck, 'Sistema':Settings2 }
const limitesPorRol: Record<string, string[]> = {
  admin: [], supervisor: [],
  cajero:['dashboard','caja','pedidos','mesas'],
  mesero:['mesas','pedidos'], barra:['pedidos','productos'], cocina:['pedidos'],
}
function permitido(modulo: ModuloPlataforma, rol: string, plan: string, tipo: string, extras: string[]) {
  const idsRol = limitesPorRol[rol] ?? []
  return modulo.disponible && (!idsRol.length || idsRol.includes(modulo.id)) &&
    (modulo.planes.includes(planNormalizado(plan)) || extras.includes(modulo.id)) &&
    (!modulo.negocios || modulo.negocios.includes(tipo))
}
function indicador(modulo: ModuloPlataforma, stats?: DashboardStats) {
  if (!stats) return null
  const valores: Record<string,string> = {
    dashboard:'Resumen operativo', productos:`${stats.productos_mas_vendidos?.length || 0} destacados`, caja:formatCurrency(stats.caja_actual || 0),
    pedidos:`${stats.pedidos_activos || 0} activos`, mesas:`${stats.mesas_ocupadas || 0} ocupadas`, inventario:formatCurrency(stats.valor_inventario || 0),
    'indicadores-inventario':`${stats.inventario_critico || 0} criticos`, reportes:'Indicadores y exportacion', recetas:'Costos por porcion', ingredientes:'Stock de cocina',
  }
  return valores[modulo.id] || null
}

export default function ClientHomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [grupo, setGrupo] = useState<GrupoModulo>('Operacion')
  const [busqueda, setBusqueda] = useState('')
  const empresa = user?.empresa
  const tipo = String(empresa?.tipo || '').toLowerCase()
  const extras = empresa?.modulos_extra || []
  const { data: stats } = useQuery({ queryKey:['dashboard-stats'], queryFn:async()=>{ const respuesta=await api.get<any>('/dashboard'); return (respuesta.data.data||respuesta.data) as DashboardStats }, staleTime:30_000 })
  const modulos = useMemo(() => MODULOS_PLATAFORMA.filter(modulo => permitido(modulo, user?.rol || '', empresa?.plan || 'basico', tipo, extras)), [user?.rol, empresa?.plan, tipo, extras.join('|')])
  const visibles = modulos.filter(modulo => modulo.grupo === grupo && `${modulo.nombre} ${modulo.descripcion}`.toLowerCase().includes(busqueda.toLowerCase()))
  const total = modulos.length

  return <div className="space-y-5">
    <header className="flex flex-col gap-4 border-b border-white/10 pb-4 xl:flex-row xl:items-center">
      <div className="min-w-0 flex-1"><p className="text-xs text-surface-200/50">Inicio / Panel principal</p><h1 className="mt-1 text-2xl font-bold text-surface-50">Bienvenido, {user?.nombre || 'usuario'}</h1><p className="mt-1 text-sm text-surface-200/60">{empresa?.nombre || 'Tu empresa'}: selecciona lo que deseas gestionar.</p></div>
      <input value={busqueda} onChange={event => setBusqueda(event.target.value)} className="input h-11 w-full xl:w-72" placeholder="Buscar modulo" aria-label="Buscar modulo" />
    </header>
    <section className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><button onClick={()=>navigate('/app/escanear/barras')} className="flex min-h-24 items-center gap-3 rounded-lg border border-sky-400/35 bg-sky-500/15 p-4 text-left hover:bg-sky-500/25"><span className="rounded-lg bg-sky-400/20 p-3"><ScanLine className="h-6 w-6 text-sky-200"/></span><span><b className="block text-surface-50">Entrada / salida</b><span className="text-sm text-sky-100/80">Escanear código de barras</span></span></button><button onClick={()=>navigate('/app/escanear/qr')} className="flex min-h-24 items-center gap-3 rounded-lg border border-violet-400/35 bg-violet-500/15 p-4 text-left hover:bg-violet-500/25"><span className="rounded-lg bg-violet-400/20 p-3"><QrCode className="h-6 w-6 text-violet-200"/></span><span><b className="block text-surface-50">Conteo de inventario</b><span className="text-sm text-violet-100/80">General y cíclico con QR</span></span></button><button onClick={()=>navigate('/app/inventario')} className="flex min-h-24 items-center gap-3 rounded-lg border border-emerald-400/35 bg-emerald-500/15 p-4 text-left hover:bg-emerald-500/25"><span className="rounded-lg bg-emerald-400/20 p-3"><Boxes className="h-6 w-6 text-emerald-200"/></span><span><b className="block text-surface-50">Inventario</b><span className="text-sm text-emerald-100/80">Movimientos y existencias</span></span></button><button onClick={()=>navigate('/app/pedidos')} className="flex min-h-24 items-center gap-3 rounded-lg border border-amber-400/35 bg-amber-500/15 p-4 text-left hover:bg-amber-500/25"><span className="rounded-lg bg-amber-400/20 p-3"><ClipboardList className="h-6 w-6 text-amber-200"/></span><span><b className="block text-surface-50">Pedidos</b><span className="text-sm text-amber-100/80">Ventas y seguimiento</span></span></button></div><div className="flex flex-wrap gap-2">{GRUPOS_MODULOS.map(nombre=>{const activos=modulos.filter(modulo=>modulo.grupo===nombre).length;if(!activos)return null;const Icon=iconosGrupo[nombre];return <button type="button" key={nombre} onClick={()=>{setGrupo(nombre);setBusqueda('')}} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${grupo===nombre?'border-brand-400 bg-brand-500 text-white':'border-white/10 bg-surface-800/75 text-surface-200/70 hover:bg-white/5'}`}><Icon className="h-4 w-4"/>{nombre}</button>})}<span className="ml-auto self-center text-xs text-surface-200/50">Plan {empresa?.plan||'Basico'} · {total} módulos</span></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Resumen icon={<ReceiptText className="h-5 w-5 text-emerald-300"/>} titulo="Ventas del día" valor={formatCurrency(stats?.ventas_hoy || 0)}/><Resumen icon={<ClipboardList className="h-5 w-5 text-amber-300"/>} titulo="Pedidos activos" valor={String(stats?.pedidos_activos || 0)}/><Resumen icon={<Package className="h-5 w-5 text-violet-300"/>} titulo="Valor inventario" valor={formatCurrency(stats?.valor_inventario || 0)}/><Resumen icon={<BarChart3 className="h-5 w-5 text-sky-300"/>} titulo="Stock crítico" valor={String(stats?.inventario_critico || 0)}/></div><div className="card p-4"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-surface-50">{grupo}</h2><p className="mt-1 text-sm text-surface-200/60">{resumen[grupo]}</p></div><span className="badge-blue">{visibles.length} accesos</span></div><div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{visibles.map(modulo => { const Icon=modulo.icono; const dato=indicador(modulo,stats); return <article key={modulo.id} className="flex min-h-44 flex-col rounded-lg border border-white/10 bg-surface-900/35 p-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-500/15"><Icon className="h-6 w-6 text-brand-300"/></span><div className="min-w-0"><h3 className="font-semibold text-surface-50">{modulo.nombre}</h3><p className="mt-1 text-sm leading-6 text-surface-200/60">{modulo.descripcion}</p></div></div><div className="mt-auto flex items-center justify-between gap-3 pt-4">{dato?<span className="text-xs font-medium text-emerald-300">{dato}</span>:<span className="text-xs text-surface-200/45">Disponible</span>}<button type="button" onClick={()=>modulo.ruta&&navigate(modulo.ruta)} className="btn-secondary min-h-11" disabled={!modulo.ruta}>Entrar <ArrowRight className="h-4 w-4"/></button></div></article>})}{visibles.length===0&&<p className="py-12 text-center text-surface-200/50">No hay modulos que coincidan con la busqueda.</p>}</div></div></section>
  </div>
}
function Resumen({ icon, titulo, valor }:{icon:React.ReactNode;titulo:string;valor:string}) { return <div className="card flex min-h-24 items-center gap-3 p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/5">{icon}</span><div className="min-w-0"><p className="text-xs text-surface-200/55">{titulo}</p><p className="mt-1 truncate text-lg font-bold text-surface-50">{valor}</p></div></div> }
