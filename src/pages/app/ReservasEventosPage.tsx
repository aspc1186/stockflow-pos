import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageUp, Pencil, Plus, Trash2 } from 'lucide-react'
import api from '@/lib/axios'
import Modal from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const reservaVacia = { nombre:'', telefono:'', fecha_hora:'', personas:'2', notas:'', estado:'pendiente' }
const eventoVacio = { titulo:'', descripcion:'', fecha_inicio:'', fecha_fin:'', tipo:'evento', imagen_url:'', activo:true }

export default function ReservasEventosPage({ modo }: { modo:'reservas'|'eventos' }) {
  const qc = useQueryClient()
  const esReserva = modo === 'reservas'
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState<any>(esReserva ? reservaVacia : eventoVacio)
  const { data: registros = [] } = useQuery({ queryKey:[modo], queryFn:async()=>{ const { data } = await api.get(`/${modo}`); return data.data || data } })
  const guardar = useMutation({
    mutationFn: () => editando
      ? api.patch(`/${modo}/${editando.id}`, { ...form, personas:Number(form.personas) || 1 })
      : api.post(`/${modo}`, { ...form, personas:Number(form.personas) || 1 }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey:[modo] }); setOpen(false); setEditando(null); toast.success(editando ? (esReserva ? 'Reserva actualizada' : 'Evento actualizado') : (esReserva ? 'Reserva creada' : 'Evento publicado')) },
    onError: (e:any) => toast.error(e?.response?.data?.msg || 'No se pudo guardar'),
  })
  const eliminar = useMutation({ mutationFn:(id:string)=>api.delete(`/${modo}/${id}`), onSuccess:()=>qc.invalidateQueries({queryKey:[modo]}), onError:()=>toast.error('No se pudo eliminar') })
  const cargar = (file?:File) => { if (!file) return; const lector = new FileReader(); lector.onload=()=>setForm((actual:any)=>({ ...actual, imagen_url:String(lector.result || '') })); lector.readAsDataURL(file) }
  const abrirNuevo = () => { setEditando(null); setForm(esReserva ? { ...reservaVacia } : { ...eventoVacio }); setOpen(true) }
  const abrirEdicion = (registro:any) => {
    setEditando(registro)
    setForm(esReserva
      ? { nombre:registro.nombre || '', telefono:registro.telefono || '', fecha_hora:registro.fecha_hora ? String(registro.fecha_hora).slice(0,16) : '', personas:String(registro.personas || 1), notas:registro.notas || '', estado:registro.estado || 'pendiente' }
      : { titulo:registro.titulo || '', descripcion:registro.descripcion || '', fecha_inicio:registro.fecha_inicio ? String(registro.fecha_inicio).slice(0,16) : '', fecha_fin:registro.fecha_fin ? String(registro.fecha_fin).slice(0,16) : '', tipo:registro.tipo || 'evento', imagen_url:registro.imagen_url || '', activo:registro.activo !== false })
    setOpen(true)
  }

  return <div className="space-y-5">
    <div className="page-header"><div><h1 className="page-title">{esReserva ? 'Reservas' : 'Eventos y promociones'}</h1><p className="page-subtitle">{registros.length} registros</p></div><button className="btn-primary btn-sm" onClick={abrirNuevo}><Plus className="h-4 w-4"/>{esReserva ? 'Nueva reserva' : 'Nuevo evento'}</button></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{registros.map((registro:any) => <article key={registro.id} className="card overflow-hidden">{!esReserva && registro.imagen_url && <img src={registro.imagen_url} alt={registro.titulo} className="h-32 w-full object-cover"/>}<div className="p-4"><div className="flex justify-between gap-3"><div><h2 className="font-semibold">{esReserva ? registro.nombre : registro.titulo}</h2><p className="mt-1 text-xs text-surface-200/50">{formatDate(esReserva ? registro.fecha_hora : registro.fecha_inicio,'dd/MM/yyyy HH:mm')}</p></div><div className="flex gap-1"><button className="btn-ghost btn-sm p-2" title="Editar" onClick={()=>abrirEdicion(registro)}><Pencil className="h-4 w-4"/></button><button className="btn-ghost btn-sm p-2 text-red-300" title="Eliminar" onClick={()=>eliminar.mutate(registro.id)}><Trash2 className="h-4 w-4"/></button></div></div><p className="mt-3 text-sm text-surface-200/65">{esReserva ? `${registro.personas} personas · ${registro.telefono || 'Sin teléfono'}` : registro.descripcion || 'Sin descripción'}</p><span className="badge-gray mt-3">{esReserva ? registro.estado : registro.tipo}</span></div></article>)}</div>
    {!registros.length && <div className="card py-16 text-center text-surface-200/45">Aún no hay {esReserva ? 'reservas' : 'eventos o promociones'}.</div>}
    <Modal open={open} onClose={()=>setOpen(false)} title={editando ? (esReserva ? 'Editar reserva' : 'Editar evento o promoción') : (esReserva ? 'Nueva reserva' : 'Nuevo evento o promoción')} footer={<div className="flex gap-3"><button className="btn-secondary flex-1" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn-primary flex-1" onClick={()=>guardar.mutate()} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar'}</button></div>}>
      {esReserva ? <div className="space-y-3"><input className="input" placeholder="Nombre" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/><input className="input" placeholder="Teléfono" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})}/><div className="grid grid-cols-2 gap-3"><input type="datetime-local" className="input" value={form.fecha_hora} onChange={e=>setForm({...form,fecha_hora:e.target.value})}/><input type="number" className="input" placeholder="Personas" value={form.personas} onChange={e=>setForm({...form,personas:e.target.value})}/></div><textarea className="input" placeholder="Notas" value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})}/></div> : <div className="space-y-3"><input className="input" placeholder="Título" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}/><textarea className="input" placeholder="Descripción de la promoción" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/><div className="grid grid-cols-2 gap-3"><input type="datetime-local" className="input" value={form.fecha_inicio} onChange={e=>setForm({...form,fecha_inicio:e.target.value})}/><input type="datetime-local" className="input" value={form.fecha_fin} onChange={e=>setForm({...form,fecha_fin:e.target.value})}/></div><input ref={input} type="file" accept="image/*" className="hidden" onChange={e=>cargar(e.target.files?.[0])}/><button type="button" className="btn-secondary btn-sm" onClick={()=>input.current?.click()}><ImageUp className="h-4 w-4"/>Subir imagen</button>{form.imagen_url&&<img src={form.imagen_url} alt="Vista previa" className="h-24 w-40 rounded-lg object-cover"/>}</div>}
    </Modal>
  </div>
}
