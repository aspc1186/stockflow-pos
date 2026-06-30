import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import type { Empresa } from '@/types'
import { formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function EmpresasPage() {
  const navigate=useNavigate(); const qc=useQueryClient()
  const [modal,setModal]=useState(false)
  const [form,setForm]=useState({nombre:'',nit:'',telefono:'',email:'',ciudad:'',tipo:'restaurante',licencia_fin:'',admin_nombre:'',admin_email:'',admin_username:'',admin_password:''})

  const {data:empresas=[],isLoading}=useQuery({queryKey:['sa-empresas'],queryFn:async()=>{const {data}=await api.get<{data:Empresa[]}>('/superadmin/empresas');return data.data}})
  const crear=useMutation({
    mutationFn:()=>api.post('/superadmin/empresas',form),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['sa-empresas']});setModal(false);toast.success('Empresa creada')},
    onError:(e:any)=>toast.error(e?.response?.data?.message??'Error'),
  })
  const toggle=useMutation({
    mutationFn:({id,activa}:{id:string;activa:boolean})=>api.patch(`/superadmin/empresas/${id}`,{activa}),
    onSuccess:()=>qc.invalidateQueries({queryKey:['sa-empresas']}),
  })

  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Empresas</h1><p className="page-subtitle">{empresas.length} registradas</p></div>
        <button onClick={()=>setModal(true)} className="btn-primary"><Plus className="w-4 h-4"/>Nueva empresa</button>
      </div>
      <div className="card overflow-hidden"><table className="table-base">
        <thead><tr><th>Empresa</th><th>Tipo</th><th>Ciudad</th><th>Usuarios</th><th>Licencia</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {(empresas as (Empresa&{total_usuarios?:number})[]).map(e=>(
            <tr key={e.id} className="cursor-pointer" onClick={()=>navigate(`/superadmin/empresas/${e.id}`)}>
              <td><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center"><Building2 className="w-4 h-4 text-brand-400"/></div><div><p className="font-medium text-surface-50">{e.nombre}</p><p className="text-xs text-surface-200/40">{e.slug}</p></div></div></td>
              <td className="capitalize text-surface-200/60">{e.tipo}</td>
              <td className="text-surface-200/60">{(e as any).ciudad??'—'}</td>
              <td className="text-surface-200/70">{e.total_usuarios??0}</td>
              <td className="text-xs text-surface-200/50">{e.licencia_fin?formatDate(e.licencia_fin,'dd/MM/yyyy'):'Sin límite'}</td>
              <td><span className={e.activa?'badge-green':'badge-red'}>{e.activa?'Activa':'Inactiva'}</span></td>
              <td onClick={ev=>ev.stopPropagation()}><button onClick={()=>toggle.mutate({id:e.id,activa:!e.activa})} className={`text-xs px-2 py-1 rounded font-medium ${e.activa?'text-red-400 hover:bg-red-500/10':'text-emerald-400 hover:bg-emerald-500/10'}`}>{e.activa?'Desactivar':'Activar'}</button></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Nueva empresa" size="lg"
        footer={<div className="flex gap-3"><button onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={()=>crear.mutate()} disabled={crear.isPending||!form.nombre||!form.admin_email||!form.admin_password} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear empresa'}</button></div>}>
        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-surface-200/50 uppercase tracking-wide mb-3">Datos del negocio</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
              <div><label className="label">Tipo</label><select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>{['restaurante','bar','discoteca','mixto'].map(t=><option key={t} value={t} className="bg-surface-800 capitalize">{t}</option>)}</select></div>
              <div><label className="label">Ciudad</label><input className="input" value={form.ciudad} onChange={e=>setForm(p=>({...p,ciudad:e.target.value}))}/></div>
              <div><label className="label">NIT</label><input className="input" value={form.nit} onChange={e=>setForm(p=>({...p,nit:e.target.value}))}/></div>
              <div><label className="label">Licencia hasta</label><input type="date" className="input" value={form.licencia_fin} onChange={e=>setForm(p=>({...p,licencia_fin:e.target.value}))}/></div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-surface-200/50 uppercase tracking-wide mb-3">Administrador</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Nombre</label><input className="input" value={form.admin_nombre} onChange={e=>setForm(p=>({...p,admin_nombre:e.target.value}))}/></div>
              <div><label className="label">Username</label><input className="input" value={form.admin_username} onChange={e=>setForm(p=>({...p,admin_username:e.target.value}))}/></div>
              <div><label className="label">Email *</label><input type="email" className="input" value={form.admin_email} onChange={e=>setForm(p=>({...p,admin_email:e.target.value}))}/></div>
              <div><label className="label">Contraseña *</label><input type="password" className="input" value={form.admin_password} onChange={e=>setForm(p=>({...p,admin_password:e.target.value}))}/></div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
