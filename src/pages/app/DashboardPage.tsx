import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TrendingUp, ShoppingBag, Users, AlertTriangle, CreditCard, Wine, Package, CircleDollarSign, BarChart3 } from 'lucide-react'
import { AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '@/lib/axios'
import type { DashboardStats } from '@/types'
import StatCard from '@/components/ui/StatCard'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency, formatDate } from '@/lib/utils'

type TipoGrafico = 'area' | 'linea' | 'barras' | 'dona' | 'radar'
const colores = ['#6366f1','#22c55e','#f59e0b','#ec4899','#38bdf8','#a855f7','#fb7185','#14b8a6']

function SelectorGrafico({ value, onChange }: { value: TipoGrafico; onChange: (tipo: TipoGrafico) => void }) {
  return <select aria-label="Tipo de gráfico" className="input h-8 w-28 py-1 text-xs" value={value} onChange={e => onChange(e.target.value as TipoGrafico)}>
    <option value="area">Área</option><option value="linea">Línea</option><option value="barras">Barras</option><option value="dona">Dona</option><option value="radar">Radar</option>
  </select>
}

function Grafico({ data, etiqueta, clave, tipo }: { data: Record<string, any>[]; etiqueta: string; clave: string; tipo: TipoGrafico }) {
  const tooltip = <Tooltip contentStyle={{ background:'#1a1f2e', border:'1px solid #2a3048', borderRadius:'8px' }} formatter={(v:number) => [formatCurrency(v), etiqueta]} />
  if (tipo === 'dona') return <PieChart><Pie data={data} dataKey="total" nameKey={clave} innerRadius={45} outerRadius={75} paddingAngle={3}>{data.map((_, i) => <Cell key={i} fill={colores[i % colores.length]} />)}</Pie>{tooltip}</PieChart>
  if (tipo === 'radar') return <RadarChart data={data}><PolarGrid stroke="#334155" /><PolarAngleAxis dataKey={clave} tick={{ fontSize:10, fill:'#9ca3af' }} /><PolarRadiusAxis tick={false} axisLine={false} /><Radar dataKey="total" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} />{tooltip}</RadarChart>
  if (tipo === 'barras') return <BarChart data={data}><XAxis dataKey={clave} tick={{ fontSize:10, fill:'#9ca3af' }} interval={0} /><YAxis tick={{ fontSize:10, fill:'#9ca3af' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} /><Bar dataKey="total" fill="#6366f1" radius={[5,5,0,0]} />{tooltip}</BarChart>
  if (tipo === 'linea') return <LineChart data={data}><XAxis dataKey={clave} tick={{ fontSize:10, fill:'#9ca3af' }} interval={0} /><YAxis tick={{ fontSize:10, fill:'#9ca3af' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} /><Line type="monotone" dataKey="total" stroke="#38bdf8" strokeWidth={3} dot={false} />{tooltip}</LineChart>
  return <AreaChart data={data}><defs><linearGradient id={`grad-${clave}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs><XAxis dataKey={clave} tick={{ fontSize:10, fill:'#9ca3af' }} interval={0} /><YAxis tick={{ fontSize:10, fill:'#9ca3af' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} /><Area type="monotone" dataKey="total" stroke="#6366f1" fill={`url(#grad-${clave})`} strokeWidth={2} />{tooltip}</AreaChart>
}

function PanelGrafico({ titulo, data, etiqueta, clave, tipo, onTipo, vacio }: { titulo:string; data:Record<string,any>[]; etiqueta:string; clave:string; tipo:TipoGrafico; onTipo:(tipo:TipoGrafico)=>void; vacio:string }) {
  return <div className="card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-surface-200/70">{titulo}</h3><SelectorGrafico value={tipo} onChange={onTipo}/></div>{data.length ? <ResponsiveContainer width="100%" height={220}><Grafico data={data} etiqueta={etiqueta} clave={clave} tipo={tipo}/></ResponsiveContainer> : <div className="flex h-[220px] items-center justify-center text-center text-sm text-surface-200/35">{vacio}</div>}</div>
}

export default function DashboardPage() {
  const [graficoVentas, setGraficoVentas] = useState<TipoGrafico>('area')
  const [graficoProductos, setGraficoProductos] = useState<TipoGrafico>('barras')
  const [graficoPedidos, setGraficoPedidos] = useState<TipoGrafico>('linea')
  const { data, isLoading, refetch } = useQuery({ queryKey:['dashboard-stats'], queryFn:async()=>{ const { data }=await api.get<any>('/dashboard'); return (data.data || data) as DashboardStats }, refetchInterval:3000, refetchIntervalInBackground:true, refetchOnWindowFocus:'always' })
  if (isLoading) return <PageLoader />
  if (!data) return <div className="flex h-64 items-center justify-center"><div className="text-center"><p className="mb-3 text-surface-200/50">Sin datos</p><button onClick={()=>refetch()} className="btn-primary btn-sm">Recargar</button></div></div>
  return <div className="space-y-4 sm:space-y-6">
    <div className="page-header"><div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">{data.fecha_operativa ? `Jornada operativa: ${formatDate(data.fecha_operativa, 'dd/MM/yyyy')}` : 'Resumen en tiempo real'}</p></div><button onClick={()=>refetch()} className="btn-ghost btn-sm">Actualizar</button></div>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"><StatCard label="Ventas del día" value={formatCurrency(data.ventas_hoy ?? 0)} icon={<TrendingUp className="h-5 w-5 text-brand-400"/>} iconBg="bg-brand-600/20"/><StatCard label="Ventas mes" value={formatCurrency(data.ventas_mes ?? 0)} icon={<TrendingUp className="h-5 w-5 text-purple-400"/>} iconBg="bg-purple-500/20"/><StatCard label="Valor inventario" value={formatCurrency(data.valor_inventario ?? 0)} icon={<Package className="h-5 w-5 text-violet-400"/>} iconBg="bg-violet-500/20"/><StatCard label="Pedidos activos" value={data.pedidos_activos ?? 0} icon={<ShoppingBag className="h-5 w-5 text-amber-400"/>} iconBg="bg-amber-500/20"/><StatCard label="Caja actual" value={formatCurrency(data.caja_actual ?? 0)} icon={<CreditCard className="h-5 w-5 text-green-400"/>} iconBg="bg-green-500/20"/></div>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"><StatCard label="Mesas ocupadas" value={data.mesas_ocupadas ?? 0} icon={<Wine className="h-5 w-5 text-orange-400"/>} iconBg="bg-orange-500/20"/><StatCard label="Mesas libres" value={data.mesas_libres ?? 0} icon={<Users className="h-5 w-5 text-emerald-400"/>} iconBg="bg-emerald-500/20"/><StatCard label="Capacidad total" value={data.capacidad_total ?? 0} icon={<Users className="h-5 w-5 text-sky-400"/>} iconBg="bg-sky-500/20"/><StatCard label="Personas atendidas" value={data.capacidad_ocupada ?? 0} icon={<Users className="h-5 w-5 text-orange-400"/>} iconBg="bg-orange-500/20"/><StatCard label="Stock crítico" value={data.inventario_critico ?? 0} icon={<AlertTriangle className="h-5 w-5 text-red-400"/>} iconBg="bg-red-500/20"/><StatCard label="Consumo promedio por persona" value={formatCurrency(data.capacidad_ocupada > 0 ? data.ventas_hoy / data.capacidad_ocupada : 0)} icon={<CreditCard className="h-5 w-5 text-sky-400"/>} iconBg="bg-sky-500/20"/><div className="col-span-2 grid grid-cols-2 gap-3 sm:gap-4"><div className="card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-surface-100"><CircleDollarSign className="h-4 w-4 text-amber-400"/>Utilidad del Día</div><p className="mt-3 text-xl font-bold text-surface-50">{formatCurrency(data.utilidad_dia ?? 0)}</p><p className="mt-3 border-t border-white/10 pt-3 text-xs text-surface-200/60">Margen {Number(data.margen_dia ?? 0).toFixed(1)}%</p></div><div className="card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-surface-100"><BarChart3 className="h-4 w-4 text-emerald-400"/>Utilidad del Mes</div><p className="mt-3 text-xl font-bold text-surface-50">{formatCurrency(data.utilidad_mes ?? 0)}</p><p className="mt-3 border-t border-white/10 pt-3 text-xs text-surface-200/60">Margen {Number(data.margen_mes ?? 0).toFixed(1)}%</p></div></div></div>
    <div className="grid gap-4 lg:grid-cols-2"><PanelGrafico titulo="Ventas por hora - caja actual" data={data.ventas_por_hora || []} etiqueta="Ventas" clave="hora" tipo={graficoVentas} onTipo={setGraficoVentas} vacio="Sin ventas en la caja actual"/><PanelGrafico titulo="Top productos - caja actual" data={data.productos_mas_vendidos || []} etiqueta="Unidades" clave="nombre" tipo={graficoProductos} onTipo={setGraficoProductos} vacio="Sin productos vendidos en la caja actual"/><div className="lg:col-span-2"><PanelGrafico titulo="Ventas por pedido - caja actual" data={data.ventas_por_pedido || []} etiqueta="Total del pedido" clave="pedido" tipo={graficoPedidos} onTipo={setGraficoPedidos} vacio="Aún no hay pedidos cobrados en la caja actual"/></div></div>
  </div>
}
