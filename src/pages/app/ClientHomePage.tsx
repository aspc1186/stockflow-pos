import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, BarChart3, Boxes, ClipboardList, CookingPot, Package, QrCode, ReceiptText, Settings2, ShieldCheck, ShoppingCart, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { GRUPOS_MODULOS, MODULOS_PLATAFORMA, planNormalizado, type GrupoModulo, type ModuloPlataforma } from '@/config/modules.config'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import type { DashboardStats } from '@/types'

const resumen: Record<GrupoModulo, string> = {
  Operacion: 'Ventas, pedidos, caja, productos y clientes.',
  'Puestos y atencion': 'Mesas, reservas, responsables y eventos.',
  'Inventario y WMS': 'Existencias, movimientos y captura con scanner.',
  'Restaurante y recetas': 'Ingredientes, recetas, costos y mermas.',
  Administracion: 'Usuarios, reportes, configuracion e integraciones.',
  Sistema: 'Herramientas tecnicas y soporte de la plataforma.',
}
const iconosGrupo: Record<GrupoModulo, any> = { Operacion:ShoppingCart, 'Puestos y atencion':Users, 'Inventario y WMS':Boxes, 'Restaurante y recetas':CookingPot, Administracion:ShieldCheck, Sistema:Settings2 }
const limitesPorRol: Record<string, string[]> = { admin: [], supervisor: [], cajero:['dashboard','caja','pedidos','mesas'], mesero:['mesas','pedidos'], barra:['pedidos','productos'], cocina:['pedidos'] }
function permitido(modulo: ModuloPlataforma, rol: string, plan: string, tipo: string, extras: string[]) {
  const idsRol = limitesPorRol[rol] ?? []
  return modulo.disponible && (!idsRol.length || idsRol.includes(modulo.id)) && (modulo.planes.includes(planNormalizado(plan)) || extras.includes(modulo.id)) && (!modulo.negocios || modulo.negocios.includes(tipo))
}
function indicador(modulo: ModuloPlataforma, stats?: DashboardStats) {
  if (!stats) return null
  const valores: Record<string,string> = { dashboard:'Resumen operativo', productos:`${stats.productos_mas_vendidos?.length || 0} destacados`, caja:formatCurrency(stats.caja_actual || 0), pedidos:`${stats.pedidos_activos || 0} activos`, mesas:`${stats.mesas_ocupadas || 0} ocupadas`, inventario:formatCurrency(stats.valor_inventario || 0), 'indicadores-inventario':`${stats.inventario_critico || 0} criticos`, reportes:'Indicadores y exportacion', recetas:'Costos por porcion', ingredientes:'Stock de cocina' }
  return valores[modulo.id] || null
}

function AccesoRapido({ onClick, icono, titulo, detalle, color }:{onClick:()=>void;icono:React.ReactNode;titulo:string;detalle:string;color:string}) {
  return <button onClick={onClick} className={`flex min-h-32 items-center gap-4 rounded-lg border p-5 text-left transition hover:brightness-110 ${color}`}><span className="rounded-lg bg-black/15 p-3">{icono}</span><span><b className="block text-lg text-surface-50">{titulo}</b><span className="mt-1 block text-sm text-surface-100/80">{detalle}</span></span></button>
}

export default function ClientHomePage() {
  const navigate = useNavigate(); const { user } = useAuth(); const [grupo, setGrupo] = useState<GrupoModulo>('Operacion'); const [busqueda, setBusqueda] = useState('')
  const empresa=user?.empresa; const tipo=String(empresa?.tipo||'').toLowerCase(); const extras=empresa?.modulos_extra||[]
  const { data: stats } = useQuery({ queryKey:['dashboard-stats'], queryFn:async()=>{const r=await api.get<any>('/dashboard');return (r.data.data||r.data) as DashboardStats}, staleTime:30_000 })
  const modulos=useMemo(()=>MODULOS_PLATAFORMA.filter(modulo=>permitido(modulo,user?.rol||'',empresa?.plan||'basico',tipo,extras)),[user?.rol,empresa?.plan,tipo,extras.join('|')])
  const visibles=modulos.filter(modulo=>modulo.grupo===grupo && `${modulo.nombre} ${modulo.descripcion}`.toLowerCase().includes(busqueda.toLowerCase()))
  return <div className="space-y-5"><header className="flex flex-col gap-4 border-b border-white/10 pb-4 xl:flex-row xl:items-center"><div className="min-w-0 flex-1"><p className="text-xs text-surface-200/50">Inicio / Panel principal</p><h1 className="mt-1 text-2xl font-bold text-surface-50">Bienvenido, {user?.nombre||'usuario'}</h1><p className="mt-1 text-sm text-surface-200/60">{empresa?.nombre||'Tu empresa'}: selecciona lo que deseas gestionar.</p></div><input value={busqueda} onChange={e=>setBusqueda(e.target.value)} className="input h-11 w-full xl:w-72" placeholder="Buscar modulo"/></header>
    <section className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><AccesoRapido onClick={()=>navigate('/app/escanear/barras?tipo=entrada')} color="border-emerald-400/35 bg-emerald-500/15" icono={<ArrowDownToLine className="h-7 w-7 text-emerald-200"/>} titulo="Entrada" detalle="Registrar mercancía por código"/><AccesoRapido onClick={()=>navigate('/app/escanear/barras?tipo=salida')} color="border-rose-400/35 bg-rose-500/15" icono={<ArrowUpFromLine className="h-7 w-7 text-rose-200"/>} titulo="Salida" detalle="Descontar productos por código"/><AccesoRapido onClick={()=>navigate('/app/escanear/qr')} color="border-violet-400/35 bg-violet-500/15" icono={<QrCode className="h-7 w-7 text-violet-200"/>} titulo="Conteo de inventario" detalle="General y cíclico con QR"/><AccesoRapido onClick={()=>navigate('/app/inventario')} color="border-sky-400/35 bg-sky-500/15" icono={<Boxes className="h-7 w-7 text-sky-200"/>} titulo="Inventario" detalle="Movimientos y existencias"/><AccesoRapido onClick={()=>navigate('/app/pedidos')} color="border-amber-400/35 bg-amber-500/15" icono={<ClipboardList className="h-7 w-7 text-amber-200"/>} titulo="Pedidos" detalle="Ventas y seguimiento"/></div>
      <div className="flex flex-wrap gap-2">{GRUPOS_MODULOS.map(nombre=>{const activos=modulos.filter(m=>m.grupo===nombre).length;if(!activos)return null;const Icon=iconosGrupo[nombre];return <button key={nombre} onClick={()=>{setGrupo(nombre);setBusqueda('')}} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${grupo===nombre?'border-brand-400 bg-brand-500 text-white':'border-white/10 bg-surface-800/75 text-surface-200/70 hover:bg-white/5'}`}><Icon className="h-4 w-4"/>{nombre}</button>})}<span className="ml-auto self-center text-xs text-surface-200/50">Plan {empresa?.plan||'Basico'} · {modulos.length} módulos</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Resumen icon={<ReceiptText className="h-5 w-5 text-emerald-300"/>} titulo="Ventas del día" valor={formatCurrency(stats?.ventas_hoy||0)}/><Resumen icon={<ClipboardList className="h-5 w-5 text-amber-300"/>} titulo="Pedidos activos" valor={String(stats?.pedidos_activos||0)}/><Resumen icon={<Package className="h-5 w-5 text-violet-300"/>} titulo="Valor inventario" valor={formatCurrency(stats?.valor_inventario||0)}/><Resumen icon={<BarChart3 className="h-5 w-5 text-sky-300"/>} titulo="Stock crítico" valor={String(stats?.inventario_critico||0)}/></div>
      <div className="card p-4"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-surface-50">{grupo}</h2><p className="mt-1 text-sm text-surface-200/60">{resumen[grupo]}</p></div><span className="badge-blue">{visibles.length} accesos</span></div><div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{visibles.map(modulo=>{const Icon=modulo.icono;const dato=indicador(modulo,stats);return <article key={modulo.id} className="flex min-h-44 flex-col rounded-lg border border-white/10 bg-surface-900/35 p-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-500/15"><Icon className="h-6 w-6 text-brand-300"/></span><div className="min-w-0"><h3 className="font-semibold text-surface-50">{modulo.nombre}</h3><p className="mt-1 text-sm leading-6 text-surface-200/60">{modulo.descripcion}</p></div></div><div className="mt-auto flex items-center justify-between gap-3 pt-4">{dato?<span className="text-xs font-medium text-emerald-300">{dato}</span>:<span className="text-xs text-surface-200/45">Disponible</span>}<button onClick={()=>modulo.ruta&&navigate(modulo.ruta)} className="btn-secondary min-h-11" disabled={!modulo.ruta}>Entrar <ArrowRight className="h-4 w-4"/></button></div></article>})}{visibles.length===0&&<p className="py-12 text-center text-surface-200/50">No hay módulos que coincidan con la búsqueda.</p>}</div></div></section></div>
}
function Resumen({icon,titulo,valor}:{icon:React.ReactNode;titulo:string;valor:string}) { return <div className="card flex min-h-24 items-center gap-3 p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/5">{icon}</span><div className="min-w-0"><p className="text-xs text-surface-200/55">{titulo}</p><p className="mt-1 truncate text-lg font-bold text-surface-50">{valor}</p></div></div> }
