import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, Link2, Plus, Plug, Settings2, Trash2 } from 'lucide-react'
import api from '@/lib/axios'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const proveedores = [
  { id:'siigo', nombre:'Siigo', tipo:'Facturacion y contabilidad' },
  { id:'sci', nombre:'SCI', tipo:'Contabilidad y gestion' },
  { id:'oci', nombre:'OCI', tipo:'Oracle Cloud Infrastructure' },
  { id:'sap', nombre:'SAP', tipo:'ERP empresarial' },
  { id:'oracle', nombre:'Oracle', tipo:'ERP y bases de datos' },
  { id:'odoo', nombre:'Odoo', tipo:'ERP modular' },
  { id:'alegra', nombre:'Alegra', tipo:'Facturacion y contabilidad' },
  { id:'siesa', nombre:'Siesa', tipo:'ERP empresarial' },
  { id:'novasoft', nombre:'Novasoft', tipo:'Gestion empresarial' },
  { id:'loggro_enterprise', nombre:'Loggro Enterprise', tipo:'ERP y gestion administrativa' },
  { id:'softland', nombre:'Softland', tipo:'ERP y contabilidad' },
  { id:'factory', nombre:'Factory', tipo:'Gestion empresarial' },
]

const vacio = { proveedor:'siigo', nombre:'Siigo', ambiente:'pruebas', endpoint:'', usuario:'', secreto:'', activo:false }

export default function IntegracionesPage() {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [form, setForm] = useState(vacio)
  const { data: integraciones = [], isLoading } = useQuery({ queryKey:['integraciones-erp'], queryFn:async()=>{ const { data }=await api.get<any>('/integraciones'); return data.data || data } })
  const pendientes = integraciones.filter((item:any) => item.estado === 'pendiente' || !item.tiene_secreto)
  const elegirProveedor = (id:string) => {
    const proveedor = proveedores.find(item => item.id === id)
    if (!proveedor) return
    setEditando(null)
    setForm({ ...vacio, proveedor:proveedor.id, nombre:proveedor.nombre })
    setAbierto(true)
  }
  const guardar = useMutation({
    mutationFn: () => editando ? api.patch(`/integraciones/${editando.id}`, form) : api.post('/integraciones', form),
    onSuccess: () => { qc.invalidateQueries({queryKey:['integraciones-erp']}); setAbierto(false); setEditando(null); setForm(vacio); toast.success(editando ? 'Conexion actualizada' : 'Conexion guardada') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudo guardar la conexion'),
  })
  const activar = useMutation({ mutationFn:({id,activo}:{id:string;activo:boolean})=>api.patch(`/integraciones/${id}`,{activo}), onSuccess:()=>qc.invalidateQueries({queryKey:['integraciones-erp']}), onError:()=>toast.error('No se pudo actualizar') })
  const eliminar = useMutation({ mutationFn:(id:string)=>api.delete(`/integraciones/${id}`), onSuccess:()=>{qc.invalidateQueries({queryKey:['integraciones-erp']}); toast.success('Conexion eliminada')} })
  const abrirNueva = () => { setEditando(null); setForm(vacio); setAbierto(true) }
  const completar = (integracion:any) => { setEditando(integracion); setForm({ proveedor:integracion.proveedor, nombre:integracion.nombre, ambiente:integracion.ambiente || 'pruebas', endpoint:integracion.endpoint || '', usuario:integracion.usuario || '', secreto:'', activo:!!integracion.activo }); setAbierto(true) }
  const proveedorSeleccionado = proveedores.find(item => item.id === form.proveedor)

  if (isLoading) return <PageLoader/>
  return <div className="space-y-5">
    <div className="page-header"><div><h1 className="page-title">Integraciones ERP</h1><p className="page-subtitle">Centraliza las conexiones de facturacion, contabilidad y gestion.</p></div><button className="btn-primary btn-sm" onClick={abrirNueva}><Plus className="w-4 h-4"/>Nueva conexion</button></div>

    <section className="card overflow-hidden">
      <div className="border-b border-white/5 p-4"><h2 className="text-sm font-semibold">Proveedores disponibles</h2><p className="mt-1 text-xs text-surface-200/45">Selecciona un proveedor para registrar sus credenciales y dejar la conexion lista para activar.</p></div>
      <div className="grid gap-px bg-white/5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {proveedores.map(proveedor => {
          const existente = integraciones.find((item:any) => item.proveedor === proveedor.id)
          return <div key={proveedor.id} className="min-w-0 bg-surface-800 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-surface-50">{proveedor.nombre}</p><p className="mt-1 min-h-8 text-xs text-surface-200/45">{proveedor.tipo}</p></div><Plug className="h-4 w-4 flex-shrink-0 text-brand-300"/></div>{existente ? <button className="btn-secondary btn-sm mt-4 w-full" onClick={()=>completar(existente)}><Settings2 className="h-4 w-4"/>{existente.activo ? 'Gestionar conexion' : 'Completar conexion'}</button> : <button className="btn-primary btn-sm mt-4 w-full" onClick={()=>elegirProveedor(proveedor.id)}><Plus className="h-4 w-4"/>Configurar</button>}</div>
        })}
      </div>
    </section>

    <div className="card overflow-hidden"><div className="flex items-center gap-2 border-b border-white/5 p-4"><Clock3 className="h-4 w-4 text-amber-300"/><div><h2 className="text-sm font-semibold">Conexiones pendientes</h2><p className="mt-0.5 text-xs text-surface-200/45">Faltan credenciales o activacion para comenzar la sincronizacion.</p></div><span className="ml-auto badge badge-yellow">{pendientes.length}</span></div>{pendientes.length === 0 ? <p className="p-5 text-sm text-surface-200/45">No hay conexiones pendientes.</p> : <div className="divide-y divide-white/5">{pendientes.map((item:any)=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium text-surface-50">{item.nombre}</p><p className="mt-1 text-xs text-surface-200/45">{item.ambiente} · {item.tiene_secreto ? 'Falta activar la sincronizacion' : 'Faltan credenciales'}</p></div><button className="btn-primary btn-sm" onClick={()=>completar(item)}><Settings2 className="h-4 w-4"/>Completar conexion</button></div>)}</div>}</div>

    <section><div className="mb-3 flex items-center gap-2"><h2 className="text-sm font-semibold">Conexiones configuradas</h2><span className="badge badge-blue">{integraciones.length}</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{integraciones.map((item:any)=><div key={item.id} className="card p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-brand-500/15 p-2.5"><Plug className="h-5 w-5 text-brand-300"/></div><div className="min-w-0"><h3 className="truncate font-semibold">{item.nombre}</h3><p className="mt-0.5 text-xs text-surface-200/45">{item.ambiente}</p></div></div><span className={item.estado==='configurado'?'badge-green':'badge-yellow'}>{item.estado}</span></div><div className="mt-5 space-y-2 text-sm text-surface-200/60"><p className="truncate">{item.endpoint || 'Endpoint pendiente de configurar'}</p><p>{item.tiene_secreto ? 'Credenciales registradas; no se muestran nuevamente' : 'Faltan credenciales de acceso'}</p></div><div className="mt-5 flex items-center justify-between gap-2 border-t border-white/5 pt-3"><label className="flex items-center gap-2 text-xs text-surface-200/60"><input type="checkbox" checked={item.activo} disabled={!item.tiene_secreto} onChange={e=>activar.mutate({id:item.id,activo:e.target.checked})}/>Activar</label><div className="flex gap-1"><button className="btn-ghost btn-sm p-2" title="Configurar" onClick={()=>completar(item)}><Settings2 className="h-4 w-4"/></button><button className="btn-ghost btn-sm p-2 text-red-300" title="Eliminar" onClick={()=>eliminar.mutate(item.id)}><Trash2 className="h-4 w-4"/></button></div></div></div>)}{integraciones.length===0&&<div className="card col-span-full flex min-h-32 flex-col items-center justify-center text-center"><Link2 className="h-9 w-9 text-surface-200/20"/><p className="mt-3 text-sm text-surface-200/45">Selecciona un proveedor para crear la primera conexion.</p></div>}</div></section>

    <Modal open={abierto} onClose={()=>{setAbierto(false);setEditando(null)}} title={editando ? `Completar conexion ${editando.nombre}` : `Nueva conexion ${proveedorSeleccionado?.nombre || ''}`} size="md" footer={<div className="flex gap-3"><button className="btn-secondary flex-1" onClick={()=>{setAbierto(false);setEditando(null)}}>Cancelar</button><button className="btn-primary flex-1" disabled={guardar.isPending || !form.nombre} onClick={()=>guardar.mutate()}>{guardar.isPending?'Guardando...':editando?'Guardar y conectar':'Guardar conexion'}</button></div>}><div className="space-y-4"><p className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-3 text-xs text-sky-100/80">Registra las credenciales entregadas por el proveedor. La clave no vuelve a mostrarse despues de guardarla; activar la opcion solo habilita esta conexion dentro de StockFlow.</p><div className="grid grid-cols-2 gap-3"><div><label className="label">Proveedor</label><select className="input" disabled={!!editando} value={form.proveedor} onChange={e=>{ const proveedor=proveedores.find(item=>item.id===e.target.value); setForm(p=>({...p,proveedor:e.target.value,nombre:proveedor?.nombre || p.nombre})) }}>{proveedores.map(proveedor=><option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>)}</select></div><div><label className="label">Ambiente</label><select className="input" value={form.ambiente} onChange={e=>setForm(p=>({...p,ambiente:e.target.value}))}><option value="pruebas">Pruebas</option><option value="produccion">Produccion</option></select></div></div><div><label className="label">Nombre de conexion</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div><div><label className="label">Endpoint API</label><input className="input" placeholder="URL entregada por el proveedor" value={form.endpoint} onChange={e=>setForm(p=>({...p,endpoint:e.target.value}))}/></div><div><label className="label">Usuario o identificador de cuenta</label><input className="input" value={form.usuario} onChange={e=>setForm(p=>({...p,usuario:e.target.value}))}/></div><div><label className="label">API key o secreto {editando && <span className="text-surface-200/40">(deja vacio para conservar)</span>}</label><input type="password" className="input" value={form.secreto} onChange={e=>setForm(p=>({...p,secreto:e.target.value}))}/></div><label className="flex items-center gap-2 text-sm text-surface-200/70"><input type="checkbox" checked={form.activo} disabled={!form.secreto && !editando?.tiene_secreto} onChange={e=>setForm(p=>({...p,activo:e.target.checked}))}/>Activar sincronizacion cuando las credenciales esten listas</label></div></Modal>
  </div>
}
