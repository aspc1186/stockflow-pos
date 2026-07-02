import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Users, CheckCircle, XCircle } from 'lucide-react'
import api from '@/lib/axios'
import { formatDate, formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export default function EmpresaDetailPage() {
  const { id } = useParams<{id:string}>(); const navigate = useNavigate(); const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['sa-empresa', id],
    queryFn: async () => { const { data } = await api.get<any>(`/superadmin/empresas/${id}`); return data.data || data },
  })

  const toggle = useMutation({
    mutationFn: (activa: boolean) => api.patch(`/superadmin/empresas/${id}`, {activa}),
    onSuccess: () => { qc.invalidateQueries({queryKey:['sa-empresa',id]}); qc.invalidateQueries({queryKey:['sa-empresas']}); toast.success('Empresa actualizada') },
    onError: () => toast.error('Error al actualizar'),
  })

  if (isLoading) return <PageLoader />
  if (!data) return null
  const empresa = data; const usuarios = data.usuarios || []

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/superadmin/empresas')} className="btn-ghost btn-sm p-2"><ArrowLeft className="w-4 h-4"/></button>
        <div className="flex-1"><h1 className="page-title">{empresa.nombre}</h1><p className="page-subtitle capitalize">{empresa.tipo?.replace(/_/g,' ')} · {empresa.ciudad||'Sin ciudad'}</p></div>
        <button onClick={() => toggle.mutate(!empresa.activa)}
          className={cn('btn btn-sm', empresa.activa ? 'btn-danger' : 'btn-primary')}>
          {empresa.activa ? <><XCircle className="w-4 h-4"/>Desactivar</> : <><CheckCircle className="w-4 h-4"/>Activar</>}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Estado', value: empresa.activa?'Activa':'Inactiva', color: empresa.activa?'text-emerald-400':'text-red-400'},
          {label:'Plan', value: empresa.plan||'Básico', color: 'text-brand-400'},
          {label:'Usuarios', value: usuarios.length, color: 'text-sky-400'},
          {label:'Licencia hasta', value: empresa.licencia_fin?formatDate(empresa.licencia_fin,'dd/MM/yy'):'Sin límite', color: 'text-surface-50'},
        ].map(item => (
          <div key={item.label} className="card p-4">
            <p className="text-xs text-surface-200/50 uppercase tracking-wide mb-1">{item.label}</p>
            <p className={cn('text-lg font-bold', item.color)}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center gap-2">
          <Users className="w-4 h-4 text-surface-200/40"/>
          <h3 className="text-sm font-semibold">Usuarios ({usuarios.length})</h3>
        </div>
        <table className="w-full">
          <thead><tr className="border-b border-white/5"><th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase">Usuario</th><th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase">Email</th><th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase">Rol</th><th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase">Último acceso</th><th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase">Estado</th></tr></thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-sm text-surface-200/30">Sin usuarios</td></tr>
            ) : usuarios.map((u:any) => (
              <tr key={u.id} className="border-b border-white/5">
                <td className="p-4"><p className="font-medium text-surface-50">{u.nombre}</p><p className="text-xs text-surface-200/40">@{u.username}</p></td>
                <td className="p-4 text-surface-200/70 text-sm">{u.email}</td>
                <td className="p-4"><span className="badge badge-blue capitalize">{u.rol}</span></td>
                <td className="p-4 text-xs text-surface-200/50">{u.ultimo_acceso ? formatDate(u.ultimo_acceso,'dd/MM HH:mm') : 'Nunca'}</td>
                <td className="p-4"><span className={u.activo?'badge-green':'badge-gray'}>{u.activo?'Activo':'Inactivo'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
