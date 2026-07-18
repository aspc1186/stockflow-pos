import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Users, CheckCircle, XCircle, Pencil, Save, ShieldCheck, KeyRound } from 'lucide-react'
import api from '@/lib/axios'
import { formatDate, formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'

export default function EmpresaDetailPage() {
  const { id } = useParams<{id:string}>(); const navigate = useNavigate(); const qc = useQueryClient()
  const { startSupport } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editarAbierto, setEditarAbierto] = useState(false)
  const [soporteAbierto, setSoporteAbierto] = useState(false)
  const [usuarioPassword, setUsuarioPassword] = useState<any | null>(null)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [edicion, setEdicion] = useState({ nombre:'', tipo:'bar', nit:'', ciudad:'', telefono:'', email:'', direccion:'', plan:'basico', licencia_fin:'', notificar_pago:false, mensaje_pago:'' })

  const { data, isLoading } = useQuery({
    queryKey: ['sa-empresa', id],
    queryFn: async () => { const { data } = await api.get<any>(`/superadmin/empresas/${id}`); return data.data || data },
  })

  const toggle = useMutation({
    mutationFn: (activa: boolean) => api.patch(`/superadmin/empresas/${id}`, {activa}),
    onSuccess: () => { qc.invalidateQueries({queryKey:['sa-empresa',id]}); qc.invalidateQueries({queryKey:['sa-empresas']}); toast.success('Empresa actualizada') },
    onError: () => toast.error('Error al actualizar'),
  })
  const guardarEdicion = useMutation({
    mutationFn: () => api.patch(`/superadmin/empresas/${id}`, edicion),
    onSuccess: () => {
      qc.invalidateQueries({queryKey:['sa-empresa',id]})
      qc.invalidateQueries({queryKey:['sa-empresas']})
      setEditarAbierto(false)
      toast.success(edicion.notificar_pago ? 'Empresa actualizada y notificación enviada' : 'Empresa actualizada')
    },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudo guardar la empresa'),
  })
  const abrirSoporte = useMutation({
    mutationFn: () => startSupport(id || ''),
    onSuccess: () => {
      toast.success('Modo de soporte iniciado')
      navigate('/app/dashboard')
    },
    onError: (e: any) => toast.error(e?.response?.data?.msg ?? e?.message ?? 'No fue posible iniciar el modo de soporte'),
  })
  const cambiarPassword = useMutation({
    mutationFn: () => api.patch(`/superadmin/empresas/${id}/usuarios/${usuarioPassword.id}/password`, { password:nuevaPassword }),
    onSuccess: () => { setUsuarioPassword(null); setNuevaPassword(''); setConfirmarPassword(''); toast.success('Contraseña actualizada') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudo actualizar la contraseña'),
  })

  const abrirEdicion = (empresa: any = data) => {
    if (!empresa) return
    setEdicion({ nombre:empresa.nombre||'', tipo:empresa.tipo||'bar', nit:empresa.nit||'', ciudad:empresa.ciudad||'', telefono:empresa.telefono||'', email:empresa.email||'', direccion:empresa.direccion||'', plan:empresa.plan||'basico', licencia_fin:empresa.licencia_fin ? String(empresa.licencia_fin).slice(0,10) : '', notificar_pago:false, mensaje_pago:'' })
    setEditarAbierto(true)
  }

  useEffect(() => {
    if (!data || searchParams.get('editar') !== '1') return
    abrirEdicion(data)
    const next = new URLSearchParams(searchParams)
    next.delete('editar')
    setSearchParams(next, { replace: true })
  }, [data, searchParams, setSearchParams])

  if (isLoading) return <PageLoader />
  if (!data) return null
  const empresa = data; const usuarios = data.usuarios || []

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/superadmin/empresas')} className="btn-ghost btn-sm p-2"><ArrowLeft className="w-4 h-4"/></button>
        <div className="flex-1"><h1 className="page-title">{empresa.nombre}</h1><p className="page-subtitle capitalize">{empresa.tipo?.replace(/_/g,' ')} · {empresa.ciudad||'Sin ciudad'}</p></div>
        <div className="flex flex-wrap justify-end gap-2"><button onClick={()=>setSoporteAbierto(true)} className="btn-primary btn-sm"><ShieldCheck className="w-4 h-4"/>Abrir modo soporte</button><button onClick={()=>abrirEdicion()} className="btn-secondary btn-sm"><Pencil className="w-4 h-4"/>Editar empresa</button><button onClick={() => toggle.mutate(!empresa.activa)} className={cn('btn btn-sm', empresa.activa ? 'btn-danger' : 'btn-primary')}>{empresa.activa ? <><XCircle className="w-4 h-4"/>Desactivar</> : <><CheckCircle className="w-4 h-4"/>Activar</>}</button></div>
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
                <td className="p-4"><div className="flex items-center gap-2"><span className={u.activo?'badge-green':'badge-gray'}>{u.activo?'Activo':'Inactivo'}</span><button type="button" className="btn-secondary btn-sm" title="Cambiar contraseña" onClick={()=>{ setUsuarioPassword(u); setNuevaPassword(''); setConfirmarPassword('') }}><KeyRound className="h-4 w-4"/>Contraseña</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={editarAbierto} onClose={()=>setEditarAbierto(false)} title="Editar empresa" size="lg" footer={<div className="flex gap-3"><button className="btn-secondary flex-1" onClick={()=>setEditarAbierto(false)}>Cancelar</button><button className="btn-primary flex-1" onClick={()=>guardarEdicion.mutate()} disabled={guardarEdicion.isPending || !edicion.nombre.trim()}>{guardarEdicion.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<><Save className="w-4 h-4"/>Guardar cambios</>}</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Nombre de la empresa</label><input className="input" value={edicion.nombre} onChange={e=>setEdicion(p=>({...p,nombre:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Tipo de negocio</label><select className="input" value={edicion.tipo} onChange={e=>setEdicion(p=>({...p,tipo:e.target.value}))}><option value="bar">Bar</option><option value="discoteca">Discoteca</option><option value="bar_discoteca">Bar y discoteca</option><option value="restaurante">Restaurante</option><option value="restaurante_bar">Restaurante bar</option></select></div><div><label className="label">NIT</label><input className="input" value={edicion.nit} onChange={e=>setEdicion(p=>({...p,nit:e.target.value}))}/></div><div><label className="label">Ciudad</label><input className="input" value={edicion.ciudad} onChange={e=>setEdicion(p=>({...p,ciudad:e.target.value}))}/></div><div><label className="label">Telefono</label><input className="input" value={edicion.telefono} onChange={e=>setEdicion(p=>({...p,telefono:e.target.value}))}/></div><div className="col-span-2"><label className="label">Email del negocio</label><input type="email" className="input" value={edicion.email} onChange={e=>setEdicion(p=>({...p,email:e.target.value}))}/></div><div className="col-span-2"><label className="label">Direccion</label><input className="input" value={edicion.direccion} onChange={e=>setEdicion(p=>({...p,direccion:e.target.value}))}/></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Plan</label><select className="input" value={edicion.plan} onChange={e=>setEdicion(p=>({...p,plan:e.target.value}))}><option value="basico">Básico</option><option value="profesional">Profesional</option><option value="premium">Premium</option></select></div><div><label className="label">Licencia hasta</label><input type="date" className="input" value={edicion.licencia_fin} onChange={e=>setEdicion(p=>({...p,licencia_fin:e.target.value}))}/></div></div>
          <label className="flex items-start gap-3 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 cursor-pointer"><input type="checkbox" className="mt-1" checked={edicion.notificar_pago} onChange={e=>setEdicion(p=>({...p,notificar_pago:e.target.checked}))}/><span><span className="block text-sm font-medium text-emerald-100">Notificar pago al cliente</span><span className="block text-xs text-emerald-100/60 mt-1">Al guardar, el administrador de la empresa verá el aviso de pago confirmado.</span></span></label>
          {edicion.notificar_pago && <div><label className="label">Mensaje para el cliente <span className="text-surface-200/40">(opcional)</span></label><textarea className="input min-h-20" placeholder="Pago recibido. Tu servicio fue renovado..." value={edicion.mensaje_pago} onChange={e=>setEdicion(p=>({...p,mensaje_pago:e.target.value}))}/></div>}
        </div>
      </Modal>
      <Modal open={soporteAbierto} onClose={()=>setSoporteAbierto(false)} title="Abrir modo soporte" footer={<div className="flex gap-3"><button className="btn-secondary flex-1" onClick={()=>setSoporteAbierto(false)}>Cancelar</button><button className="btn-primary flex-1" onClick={()=>abrirSoporte.mutate()} disabled={abrirSoporte.isPending}>{abrirSoporte.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<><ShieldCheck className="w-4 h-4"/>Abrir soporte</>}</button></div>}>
        <div className="space-y-3 text-sm text-surface-200/70">
          <p>Vas a entrar a <strong className="text-surface-50">{empresa.nombre}</strong> con permisos de administrador para corregir informacion solicitada por el cliente.</p>
          <p>Podras gestionar mesas, pedidos, caja, productos, inventario, usuarios, reportes y configuracion. Los cambios se aplican solamente a esta empresa.</p>
          <p className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100/85">La sesion de soporte dura hasta dos horas y mostrara un aviso permanente. Podras volver al panel de superadministrador en cualquier momento.</p>
        </div>
      </Modal>
      <Modal open={!!usuarioPassword} onClose={()=>setUsuarioPassword(null)} title="Cambiar contraseña" size="sm" footer={<div className="flex gap-3"><button className="btn-secondary flex-1" onClick={()=>setUsuarioPassword(null)}>Cancelar</button><button className="btn-primary flex-1" onClick={()=>cambiarPassword.mutate()} disabled={cambiarPassword.isPending || nuevaPassword.length < 6 || nuevaPassword !== confirmarPassword}>{cambiarPassword.isPending?'Actualizando...':'Guardar contraseña'}</button></div>}>
        <div className="space-y-4"><p className="text-sm text-surface-200/65">Nueva contraseña para <strong className="text-surface-50">{usuarioPassword?.nombre}</strong> (@{usuarioPassword?.username}). La contraseña anterior no puede verse ni recuperarse.</p><div><label className="label">Nueva contraseña</label><input type="password" autoComplete="new-password" className="input" value={nuevaPassword} onChange={e=>setNuevaPassword(e.target.value)}/></div><div><label className="label">Confirmar contraseña</label><input type="password" autoComplete="new-password" className="input" value={confirmarPassword} onChange={e=>setConfirmarPassword(e.target.value)}/></div>{nuevaPassword && nuevaPassword.length < 6 && <p className="text-xs text-red-300">Debe tener al menos 6 caracteres.</p>}{confirmarPassword && nuevaPassword !== confirmarPassword && <p className="text-xs text-red-300">Las contraseñas no coinciden.</p>}</div>
      </Modal>
    </div>
  )
}
