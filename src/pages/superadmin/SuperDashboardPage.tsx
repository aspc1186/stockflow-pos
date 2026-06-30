import { useQuery } from '@tanstack/react-query'
import { Building2, TrendingUp, Users } from 'lucide-react'
import api from '@/lib/axios'
import { PageLoader } from '@/components/ui/Spinner'

export default function SuperDashboardPage() {
  const {data:empresas=[],isLoading}=useQuery({queryKey:['sa-empresas'],queryFn:async()=>{const {data}=await api.get<{data:unknown[]}>('/superadmin/empresas');return data.data}})
  if (isLoading) return <PageLoader />
  const activas=(empresas as any[]).filter(e=>e.activa).length
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Super Admin</h1><p className="text-surface-200/50 text-sm mt-1">Vista global de la plataforma</p></div>
      <div className="grid grid-cols-3 gap-4">
        {[{label:'Total empresas',v:empresas.length,icon:<Building2 className="w-5 h-5 text-brand-400"/>,bg:'bg-brand-600/20'},
          {label:'Activas',v:activas,icon:<TrendingUp className="w-5 h-5 text-emerald-400"/>,bg:'bg-emerald-500/20'},
          {label:'Inactivas',v:empresas.length-activas,icon:<Users className="w-5 h-5 text-red-400"/>,bg:'bg-red-500/20'}].map(i=>(
          <div key={i.label} className="card p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${i.bg}`}>{i.icon}</div>
            <div><p className="text-xs text-surface-200/50 uppercase tracking-wide">{i.label}</p><p className="text-3xl font-bold text-surface-50">{i.v}</p></div>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold">Empresas registradas</h3></div>
        <table className="table-base"><thead><tr><th>Empresa</th><th>Tipo</th><th>Usuarios</th><th>Estado</th></tr></thead>
        <tbody>{(empresas as any[]).slice(0,10).map(e=>(
          <tr key={e.id}><td className="font-medium text-surface-50">{e.nombre}</td><td className="text-surface-200/60 capitalize">{e.tipo}</td><td className="text-surface-200/70">{e.total_usuarios}</td><td><span className={e.activa?'badge-green':'badge-red'}>{e.activa?'Activa':'Inactiva'}</span></td></tr>
        ))}</tbody></table>
      </div>
    </div>
  )
}
