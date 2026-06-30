import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ShoppingBag, UtensilsCrossed, AlertTriangle, CreditCard, Users } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '@/lib/axios'
import type { DashboardStats } from '@/types'
import StatCard from '@/components/ui/StatCard'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils'
import { useSocket } from '@/contexts/SocketContext'

export default function DashboardPage() {
  const { on, off } = useSocket()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => { const { data } = await api.get<{data:DashboardStats}>('/dashboard/stats'); return data.data },
    refetchInterval: 30_000,
  })
  useEffect(() => {
    const h = () => refetch()
    on('pedido_nuevo', h); on('pedido_actualizado', h)
    return () => { off('pedido_nuevo', h); off('pedido_actualizado', h) }
  }, [on, off, refetch])

  if (isLoading) return <PageLoader />
  if (!data) return null
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Resumen en tiempo real</p></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ventas hoy" value={formatCurrency(data.ventas_hoy)} icon={<TrendingUp className="w-5 h-5 text-brand-400"/>} iconBg="bg-brand-600/20" />
        <StatCard label="Pedidos activos" value={data.pedidos_activos} icon={<ShoppingBag className="w-5 h-5 text-amber-400"/>} iconBg="bg-amber-500/20" />
        <StatCard label="Mesas ocupadas" value={data.mesas_ocupadas} icon={<UtensilsCrossed className="w-5 h-5 text-emerald-400"/>} iconBg="bg-emerald-500/20" />
        <StatCard label="Mesas libres" value={data.mesas_libres} icon={<Users className="w-5 h-5 text-sky-400"/>} iconBg="bg-sky-500/20" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ventas del mes" value={formatCurrency(data.ventas_mes)} icon={<TrendingUp className="w-5 h-5 text-purple-400"/>} iconBg="bg-purple-500/20" />
        <StatCard label="Caja actual" value={formatCurrency(data.caja_actual)} icon={<CreditCard className="w-5 h-5 text-green-400"/>} iconBg="bg-green-500/20" />
        <StatCard label="Stock crítico" value={data.inventario_critico} icon={<AlertTriangle className="w-5 h-5 text-red-400"/>} iconBg="bg-red-500/20" />
        <StatCard label="Usuarios activos" value={data.usuarios_conectados ?? 0} icon={<Users className="w-5 h-5 text-orange-400"/>} iconBg="bg-orange-500/20" />
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-surface-200/70 mb-4 uppercase tracking-wide">Ventas por hora — hoy</h3>
          {data.ventas_por_hora.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.ventas_por_hora}>
                <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2454f0" stopOpacity={0.3}/><stop offset="95%" stopColor="#2454f0" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="hora" tick={{fontSize:11,fill:'#9ca3af'}}/>
                <YAxis tick={{fontSize:11,fill:'#9ca3af'}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={{background:'#1a1f2e',border:'1px solid #2a3048',borderRadius:'8px'}} formatter={(v:number)=>[formatCurrency(v),'Ventas']}/>
                <Area type="monotone" dataKey="total" stroke="#2454f0" fill="url(#gv)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="h-[200px] flex items-center justify-center text-sm text-surface-200/30">Sin ventas hoy</div>}
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-200/70 mb-4 uppercase tracking-wide">Top productos — hoy</h3>
          {data.productos_mas_vendidos.length > 0 ? (
            <div className="space-y-3">
              {data.productos_mas_vendidos.slice(0,6).map((p,i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-surface-200/30 w-4">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-surface-100 truncate">{p.nombre}</span>
                      <span className="text-xs font-semibold text-brand-400 ml-2 flex-shrink-0">{p.total}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full"><div className="h-full bg-brand-600 rounded-full" style={{width:`${(p.total/data.productos_mas_vendidos[0].total)*100}%`}}/></div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="flex items-center justify-center h-32 text-sm text-surface-200/30">Sin datos</div>}
        </div>
      </div>
    </div>
  )
}
