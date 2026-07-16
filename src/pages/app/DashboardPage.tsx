import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ShoppingBag, Users, AlertTriangle, CreditCard, Wine, Package, CircleDollarSign, BarChart3 } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '@/lib/axios'
import type { DashboardStats } from '@/types'
import StatCard from '@/components/ui/StatCard'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils'

export default function DashboardPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => { const { data } = await api.get<any>('/dashboard'); return (data.data || data) as DashboardStats },
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  })
  if (isLoading) return <PageLoader />
  if (!data) return <div className="flex items-center justify-center h-64"><div className="text-center"><p className="text-surface-200/50 mb-3">Sin datos</p><button onClick={() => refetch()} className="btn-primary btn-sm">Recargar</button></div></div>
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Resumen en tiempo real</p></div>
        <button onClick={() => refetch()} className="btn-ghost btn-sm">Actualizar</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Ventas del dia" value={formatCurrency(data.ventas_hoy ?? 0)} icon={<TrendingUp className="w-5 h-5 text-brand-400"/>} iconBg="bg-brand-600/20"/>
        <StatCard label="Ventas mes" value={formatCurrency(data.ventas_mes ?? 0)} icon={<TrendingUp className="w-5 h-5 text-purple-400"/>} iconBg="bg-purple-500/20"/>
        <StatCard label="Valor inventario" value={formatCurrency(data.valor_inventario ?? 0)} icon={<Package className="w-5 h-5 text-violet-400"/>} iconBg="bg-violet-500/20"/>
        <StatCard label="Pedidos activos" value={data.pedidos_activos ?? 0} icon={<ShoppingBag className="w-5 h-5 text-amber-400"/>} iconBg="bg-amber-500/20"/>
        <StatCard label="Caja actual" value={formatCurrency(data.caja_actual ?? 0)} icon={<CreditCard className="w-5 h-5 text-green-400"/>} iconBg="bg-green-500/20"/>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Mesas ocupadas" value={data.mesas_ocupadas ?? 0} icon={<Wine className="w-5 h-5 text-orange-400"/>} iconBg="bg-orange-500/20"/>
        <StatCard label="Mesas libres" value={data.mesas_libres ?? 0} icon={<Users className="w-5 h-5 text-emerald-400"/>} iconBg="bg-emerald-500/20"/>
        <StatCard label="Capacidad total" value={data.capacidad_total ?? 0} icon={<Users className="w-5 h-5 text-sky-400"/>} iconBg="bg-sky-500/20"/>
        <StatCard label="Personas atendidas" value={data.capacidad_ocupada ?? 0} icon={<Users className="w-5 h-5 text-orange-400"/>} iconBg="bg-orange-500/20"/>
        <StatCard label="Stock crítico" value={data.inventario_critico ?? 0} icon={<AlertTriangle className="w-5 h-5 text-red-400"/>} iconBg="bg-red-500/20"/>
        <StatCard label="Consumo promedio por persona" value={formatCurrency(data.capacidad_ocupada > 0 ? (data.ventas_hoy / data.capacidad_ocupada) : 0)} icon={<CreditCard className="w-5 h-5 text-sky-400"/>} iconBg="bg-sky-500/20"/>
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-surface-100"><CircleDollarSign className="h-4 w-4 text-amber-400"/>Utilidad del Día</div>
            <p className="mt-3 text-xl font-bold text-surface-50">{formatCurrency(data.utilidad_dia ?? 0)}</p>
            <p className="mt-3 border-t border-white/10 pt-3 text-xs text-surface-200/60">Margen {Number(data.margen_dia ?? 0).toFixed(1)}%</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-surface-100"><BarChart3 className="h-4 w-4 text-emerald-400"/>Utilidad del Mes</div>
            <p className="mt-3 text-xl font-bold text-surface-50">{formatCurrency(data.utilidad_mes ?? 0)}</p>
            <p className="mt-3 border-t border-white/10 pt-3 text-xs text-surface-200/60">Margen {Number(data.margen_mes ?? 0).toFixed(1)}%</p>
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-surface-200/70 mb-4 uppercase tracking-wide">Ventas por hora - caja actual</h3>
          {data.ventas_por_hora?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.ventas_por_hora}>
                <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="hora" tick={{fontSize:11,fill:'#9ca3af'}}/><YAxis tick={{fontSize:11,fill:'#9ca3af'}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={{background:'#1a1f2e',border:'1px solid #2a3048',borderRadius:'8px'}} formatter={(v:number)=>[formatCurrency(v),'Ventas']}/>
                <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#gv)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="h-[200px] flex items-center justify-center"><div className="text-center"><Wine className="w-10 h-10 text-surface-200/20 mx-auto mb-2"/><p className="text-sm text-surface-200/30">Sin ventas en la caja actual</p></div></div>}
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-200/70 mb-4 uppercase tracking-wide">Top productos - caja actual</h3>
          {data.productos_mas_vendidos?.length > 0 ? (
            <div className="space-y-3">
              {data.productos_mas_vendidos.slice(0,7).map((p,i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-surface-200/30 w-4">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1"><span className="text-xs text-surface-100 truncate">{p.nombre}</span><span className="text-xs font-bold text-brand-400 ml-2 flex-shrink-0">{p.total}</span></div>
                    <div className="h-1 bg-white/5 rounded-full"><div className="h-full bg-brand-600 rounded-full" style={{width:`${(p.total/data.productos_mas_vendidos[0].total)*100}%`}}/></div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="flex items-center justify-center h-40"><p className="text-sm text-surface-200/30">Sin datos en la caja actual</p></div>}
        </div>
      </div>
    </div>
  )
}
