import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import api from '@/lib/axios'
import type { Usuario } from '@/types'
import { formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const ROLES=[{id:2,n:'admin'},{id:3,n:'supervisor'},{id:4,n:'mesero'},{id:5,n:'bartender'},{id:6,n:'cocinero'},{id:7,n:'cajero'},{id:8,n:'bodeguero'},{id:9,n:'consulta'}]

export default function UsuariosPage() {
  const qc=useQueryClient()
  const [modal,setModal]=useState(false)
  const [form,setForm]=useState({nombre:'',email:'',username:'',password:'',rol_id:'4',telefono:''})

  const {data:usuarios=[],isLoading}=useQuery({queryKey:['usuarios'],queryFn:async()=>{const {data}=await api.get<{data:Usuario[]}>('/usuarios');return data.data}})
  const crear=useMutation({
    mutationFn:()=>api.post('/usuarios',{...form,rol_id:parseInt(form.rol_id)}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['usuarios']});setModal(false);setForm({nombre:'',email:'',username:'',password:'',rol_id:'4',telefono:''});toast.success('Usuario creado')},
    onError:(e:any)=>toast.error(e?.response?.data?.message??'Error'),
  })
  const toggle=useMutation({
    mutationFn:({id,activo}:{id:string;activo:boolean})=>api.patch(`/usuarios/${id}`,{activo}),
    onSuccess:()=>qc.invalidateQueries({queryKey:['usuarios']}),
  })

  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Usuarios</h1><p className="page-subtitle">{usuarios.length} usuarios</p></div>
        <button onClick={()=>setModal(true)} className="btn-primary"><Plus className="w-4 h-4"/>Nuevo usuario</button>
      </div>
      <div className="card overflow-hidden"><table className="table-base">
        <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {usuarios.map(u=>{const ur=u as any;return(
            <tr key={u.id}>
              <td><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center"><span className="text-xs font-bold text-brand-400">{u.nombre[0]}</span></div><div><p className="font-medium text-surface-50">{u.nombre}</p><p className="text-xs text-surface-200/40">@{u.username}</p></div></div></td>
              <td className="text-surface-200/70">{u.email}</td>
              <td><span className="badge badge-blue capitalize">{ur.rol?.nombre??'—'}</span></td>
              <td className="text-xs text-surface-200/50">{u.ultimo_acceso?formatDate(u.ultimo_acceso,'dd/MM HH:mm'):'Nunca'}</td>
              <td><span className={u.activo?'badge-green':'badge-gray'}>{u.activo?'Activo':'Inactivo'}</span></td>
              <td><button onClick={()=>toggle.mutate({id:u.id,activo:!u.activo})} className={`text-xs px-2 py-1 rounded font-medium ${u.activo?'text-red-400 hover:bg-red-500/10':'text-emerald-400 hover:bg-emerald-500/10'}`}>{u.activo?'Desactivar':'Activar'}</button></td>
            </tr>
          )})}
          {usuarios.length===0&&<tr><td colSpan={6} className="text-center py-12 text-surface-200/30">Sin usuarios</td></tr>}
        </tbody>
      </table></div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Nuevo usuario" size="md"
        footer={<div className="flex gap-3"><button onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={()=>crear.mutate()} disabled={crear.isPending||!form.nombre||!form.email||!form.password} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear'}</button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
            <div><label className="label">Rol *</label><select className="input" value={form.rol_id} onChange={e=>setForm(p=>({...p,rol_id:e.target.value}))}>{ROLES.map(r=><option key={r.id} value={r.id} className="bg-surface-800 capitalize">{r.n}</option>)}</select></div>
          </div>
          <div><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Username</label><input className="input" placeholder="Automático" value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))}/></div>
            <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/></div>
          </div>
          <div><label className="label">Contraseña *</label><input type="password" className="input" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))}/></div>
        </div>
      </Modal>
    </div>
  )
}
