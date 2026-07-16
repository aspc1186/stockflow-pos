import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import api from '@/lib/axios'
import { formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function UsuariosPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<any>(null)
  const [usuarioEliminar, setUsuarioEliminar] = useState<any>(null)
  const [form, setForm] = useState({nombre:'',email:'',username:'',password:'',rol_id:'',telefono:''})
  const [edicion, setEdicion] = useState({nombre:'',email:'',username:'',password:'',rol_id:'',telefono:''})

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => { const { data } = await api.get<any>('/usuarios'); return (data.data||data) as any[] }
  })
  const crear = useMutation({
    mutationFn: () => api.post('/usuarios', form),
    onSuccess: () => { qc.invalidateQueries({queryKey:['usuarios']}); setModal(false); setForm({nombre:'',email:'',username:'',password:'',rol_id:'',telefono:''}); toast.success('Usuario creado') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? e?.response?.data?.message ?? 'Error'),
  })
  const toggle = useMutation({
    mutationFn: ({id,activo}:{id:string;activo:boolean}) => api.patch(`/usuarios/${id}`,{activo}),
    onSuccess: () => qc.invalidateQueries({queryKey:['usuarios']}),
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudo actualizar el usuario'),
  })
  const guardarEdicion = useMutation({
    mutationFn: () => api.patch(`/usuarios/${usuarioEditando.id}`, edicion),
    onSuccess: () => { qc.invalidateQueries({queryKey:['usuarios']}); setUsuarioEditando(null); toast.success('Usuario actualizado') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudo actualizar el usuario'),
  })
  const eliminar = useMutation({
    mutationFn: () => api.delete(`/usuarios/${usuarioEliminar.id}`),
    onSuccess: () => { qc.invalidateQueries({queryKey:['usuarios']}); setUsuarioEliminar(null); toast.success('Usuario eliminado') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudo eliminar el usuario'),
  })
  const abrirEdicion = (u:any) => {
    setEdicion({ nombre:u.nombre||'', email:u.email?.endsWith('@sin-email.local') ? '' : u.email||'', username:u.username||'', password:'', rol_id:u.rol||'', telefono:u.telefono||'' })
    setUsuarioEditando(u)
  }

  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Usuarios</h1><p className="page-subtitle">{usuarios.length} usuarios</p></div>
        <button onClick={() => setModal(true)} className="btn-primary"><Plus className="w-4 h-4"/>Nuevo usuario</button>
      </div>
      <div className="card overflow-hidden"><table className="table-base">
        <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Ultimo acceso</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {usuarios.map((u:any) => (
            <tr key={u.id}>
              <td><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center"><span className="text-xs font-bold text-brand-400">{u.nombre[0]}</span></div><div><p className="font-medium text-surface-50">{u.nombre}</p><p className="text-xs text-surface-200/40">@{u.username}</p></div></div></td>
              <td className="text-surface-200/70">{u.email?.endsWith('@sin-email.local') ? 'Sin email' : u.email}</td>
              <td><span className="badge badge-blue capitalize">{u.rol ?? '-'}</span></td>
              <td className="text-xs text-surface-200/50">{u.ultimo_acceso ? formatDate(u.ultimo_acceso,'dd/MM HH:mm') : 'Nunca'}</td>
              <td><span className={u.eliminado_at?'badge-gray':u.activo?'badge-green':'badge-gray'}>{u.eliminado_at?'Eliminado':u.activo?'Activo':'Inactivo'}</span></td>
              <td><div className="flex items-center justify-end gap-1">{!u.eliminado_at && <><button onClick={() => abrirEdicion(u)} className="btn-ghost btn-sm" title="Editar usuario"><Pencil className="w-4 h-4"/></button><button onClick={() => toggle.mutate({id:u.id,activo:!u.activo})} className={`text-xs px-2 py-1 rounded font-medium ${u.activo?'text-red-400 hover:bg-red-500/10':'text-emerald-400 hover:bg-emerald-500/10'}`}>{u.activo?'Desactivar':'Activar'}</button><button onClick={() => setUsuarioEliminar(u)} className="btn-ghost btn-sm text-red-400 hover:bg-red-500/10" title="Eliminar usuario"><Trash2 className="w-4 h-4"/></button></>}</div></td>
            </tr>
          ))}
          {usuarios.length===0&&<tr><td colSpan={6} className="text-center py-12 text-surface-200/30">Sin usuarios</td></tr>}
        </tbody>
      </table></div>
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo usuario" size="md"
        footer={<div className="flex gap-3"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => crear.mutate()} disabled={crear.isPending||!form.nombre||!form.password||!form.rol_id} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear'}</button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
            <div><label className="label">Rol *</label><select className="input" value={form.rol_id} onChange={e=>setForm(p=>({...p,rol_id:e.target.value}))}><option value="">Seleccionar</option><option value="mesero" className="bg-surface-800">Mesero - mesas, pedidos y cobro</option><option value="cajero" className="bg-surface-800">Cajero - mesas y cobro</option><option value="barra" className="bg-surface-800">Barra</option><option value="cocina" className="bg-surface-800">Cocina</option><option value="supervisor" className="bg-surface-800">Supervisor</option><option value="admin" className="bg-surface-800">Admin</option></select></div>
          </div>
          <div><label className="label">Email opcional</label><input type="email" className="input" placeholder="Puede quedar vacio" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Username</label><input className="input" placeholder="Automatico" value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))}/></div>
            <div><label className="label">Telefono</label><input className="input" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/></div>
          </div>
          <div><label className="label">Contrasena *</label><input type="password" className="input" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))}/></div>
        </div>
      </Modal>
      <Modal open={!!usuarioEditando} onClose={() => setUsuarioEditando(null)} title="Editar usuario" size="md"
        footer={<div className="flex gap-3"><button onClick={() => setUsuarioEditando(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => guardarEdicion.mutate()} disabled={guardarEdicion.isPending||!edicion.nombre||!edicion.username||!edicion.rol_id} className="btn-primary flex-1">{guardarEdicion.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<><Save className="w-4 h-4"/>Guardar cambios</>}</button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><div><label className="label">Nombre *</label><input className="input" value={edicion.nombre} onChange={e=>setEdicion(p=>({...p,nombre:e.target.value}))}/></div><div><label className="label">Rol *</label><select className="input" value={edicion.rol_id} onChange={e=>setEdicion(p=>({...p,rol_id:e.target.value}))}><option value="mesero">Mesero</option><option value="cajero">Cajero</option><option value="barra">Barra</option><option value="cocina">Cocina</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div></div>
          <div><label className="label">Email opcional</label><input type="email" className="input" value={edicion.email} onChange={e=>setEdicion(p=>({...p,email:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="label">Username *</label><input className="input" value={edicion.username} onChange={e=>setEdicion(p=>({...p,username:e.target.value}))}/></div><div><label className="label">Telefono</label><input className="input" value={edicion.telefono} onChange={e=>setEdicion(p=>({...p,telefono:e.target.value}))}/></div></div>
          <div><label className="label">Nueva contrasena <span className="text-surface-200/40">(opcional)</span></label><input type="password" className="input" placeholder="Dejar vacio para conservarla" value={edicion.password} onChange={e=>setEdicion(p=>({...p,password:e.target.value}))}/></div>
        </div>
      </Modal>
      <Modal open={!!usuarioEliminar} onClose={() => setUsuarioEliminar(null)} title="Eliminar usuario" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setUsuarioEliminar(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => eliminar.mutate()} disabled={eliminar.isPending} className="btn-danger flex-1">{eliminar.isPending?'Eliminando...':<><Trash2 className="w-4 h-4"/>Eliminar</>}</button></div>}>
        <p className="text-sm text-surface-200/70">Eliminarás a <strong className="text-surface-50">{usuarioEliminar?.nombre}</strong>. No podrá volver a ingresar, pero se conservarán sus pedidos, ventas y cierres para mantener la trazabilidad.</p>
      </Modal>
    </div>
  )
}
