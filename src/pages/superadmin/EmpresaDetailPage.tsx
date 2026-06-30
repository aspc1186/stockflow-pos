import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Users } from 'lucide-react'
import api from '@/lib/axios'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

export default function EmpresaDetailPage() {
  const {id}=useParams<{id:string}>(); const navigate=useNavigate(); const qc=useQueryClient()
  const {data,isLoading}=useQuery({queryKey:['sa-empresa',id],queryFn:async()=>{const {data}=await api.get<{data:unknown}>(`/superadmin/empresas/${id}`);return data.data}})
  const toggle=useMutation({
    mutationFn:(activa:boolean)=>api.patch(`/superadmin/empresas/${id}`,{activa}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['sa-empresa',id]});toast.success('Estado actualizado')},
  })
  if (isLoading) return <PageLoader />
  if (!data) return null
  const e=data as Record<string,unknown>; const usuarios=(e.usuarios??[]) as Record<string,unknown>[]
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={()=>navigate('/superadmin/empresas')} className="btn-ghost btn-sm p-2"><ArrowLeft className="w-4 h-4"/></button>
        <div><h1 className="page-title">{e.nombre as string}</h1><p className="page-subtitle capitalize">{e.tipo as string} · {(e.ciudad as string)??'—'}</p></div>
        <div className="ml-auto">
          <button onClick={()=>toggle.mutate(!(e.activa as boolean))} className={e.activa?'btn-danger btn-sm':'btn-primary btn-sm'}>{e.activa?'Desactivar':'Activar'} empresa</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[{label:'Usuarios',v:e.total_usuarios??0,icon:<Users className="w-4 h-4 text-brand-400"/>},
          {label:'Pedidos totales',v:e.total_pedidos??0,icon:<Building2 className="w-4 h-4 text-emerald-400"/>},
          {label:'Ventas totales',v:formatCurrency(Number(e.ventas_totales??0)),icon:<Building2 className="w-4 h-4 text-amber-400"/>}].map(i=>(
          <div key={i.label} className="card p-4 flex items-center gap-3">{i.icon}<div><p className="text-xs text-surface-200/50">{i.label}</p><p className="text-xl font-bold text-surface-50">{i.v}</p></div></div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold">Usuarios</h3></div>
        <table className="table-base"><thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Último acceso</th><th>Estado</th></tr></thead>
        <tbody>{usuarios.map(u=>(
          <tr key={u.id as string}>
            <td className="font-medium">{u.nombre as string}</td>
            <td className="text-surface-200/60">{u.email as string}</td>
            <td><span className="badge-blue capitalize">{u.rol as string}</span></td>
            <td className="text-xs text-surface-200/50">{u.ultimo_acceso?formatDate(u.ultimo_acceso as string,'dd/MM HH:mm'):'Nunca'}</td>
            <td><span className={u.activo?'badge-green':'badge-red'}>{u.activo?'Activo':'Inactivo'}</span></td>
          </tr>
        ))}</tbody>
        </table>
      </div>
    </div>
  )
}
