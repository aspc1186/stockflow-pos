import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, BarChart3 } from 'lucide-react'
import api from '@/lib/axios'
import { formatCurrency } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { PageLoader } from '@/components/ui/Spinner'

export default function ReportesPage() {
  const hoy = new Date().toISOString().split('T')[0]
  const hace30 = new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0]
  const [desde, setDesde] = useState(hace30)
  const [hasta, setHasta] = useState(hoy)
  const [agrupacion, setAgrupacion] = useState('dia')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reportes', desde, hasta, agrupacion],
    queryFn: async () => {
      const { data } = await api.get<any>(`/dashboard/reportes?desde=${desde}&hasta=${hasta}&agrupacion=${agrupacion}`)
      return data.data || data
    },
  })

  if (isLoading) return <PageLoader />
  const resumen = data?.resumen || {}
  const ventas = data?.ventas_por_periodo || []
  const productos = data?.top_productos || []

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Reportes</h1><p className="page-subtitle">Análisis de ventas</p></div>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <div><label className="label">Desde</label><input type="date" className="input" value={desde} onChange={e => setDesde(e.target.value)}/></div>
        <div><label className="label">Hasta</label><input type="date" className="input" value={hasta} onChange={e => setHasta(e.target.value)}/></div>
        <div><label className="label">Agrupar por</label>
          <select className="input" value={agrupacion} onChange={e => setAgrupacion(e.target.value)}>
            <option value="dia" className="bg-surface-800">Día</option>
            <option value="semana" className="bg-surface-800">Semana</option>
            <option value="mes" className="bg-surface-800">Mes</option>
          </select>
        </div>
        <button onClick={() => refetch()} className="btn-primary">Consultar</button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Total pedidos', value: resumen.total_pedidos ?? 0},
          {label:'Total ventas', value: formatCurrency(resumen.total_ventas ?? 0)},
          {label:'Ticket promedio', value: formatCurrency(resumen.ticket_promedio ?? 0)},
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-surface-50">{s.value}</p>
            <p className="text-xs text-surface-200/50 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      {ventas.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-200/70 mb-4 uppercase tracking-wide">Ventas por periodo</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ventas}>
              <XAxis dataKey="periodo" tick={{fontSize:11,fill:'#9ca3af'}}/>
              <YAxis tick={{fontSize:11,fill:'#9ca3af'}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
              <Tooltip contentStyle={{background:'#1a1f2e',border:'1px solid #2a3048',borderRadius:'8px'}} formatter={(v:number)=>[formatCurrency(v),'Ventas']}/>
              <Bar dataKey="total" fill="#6366f1" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top productos */}
      {productos.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-200/70 mb-4 uppercase tracking-wide">Top productos</h3>
          <div className="space-y-3">
            {productos.slice(0,10).map((p:any, i:number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-mono text-surface-200/30 w-4">{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-surface-100 truncate">{p.nombre}</span>
                    <span className="text-xs font-bold text-brand-400 ml-2">{formatCurrency(p.total)}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full"><div className="h-full bg-brand-600 rounded-full" style={{width:`${(p.total/productos[0].total)*100}%`}}/></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ventas.length === 0 && productos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="w-16 h-16 text-surface-200/15 mb-4"/>
          <p className="text-surface-200/40">Sin datos para el período seleccionado</p>
        </div>
      )}
    </div>
  )
}
