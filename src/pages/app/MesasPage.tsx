import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Users, Clock, MapPin, UtensilsCrossed, ClipboardList, UserRoundCheck, Pencil, QrCode, ExternalLink } from 'lucide-react'
import QRCode from 'qrcode'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import type { Mesa, EstadoMesa } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const CFG: Record<EstadoMesa,{bg:string;border:string;dot:string;label:string;table:string;chair:string;glow:string}> = {
  libre:{bg:'bg-emerald-500/10 hover:bg-emerald-500/20',border:'border-emerald-500/30',dot:'bg-emerald-400',label:'Libre',table:'from-emerald-500/80 to-emerald-700/80',chair:'bg-emerald-300/70',glow:'shadow-emerald-500/20'},
  ocupada:{bg:'bg-amber-500/10 hover:bg-amber-500/20',border:'border-amber-500/30',dot:'bg-amber-400 animate-pulse',label:'Ocupada',table:'from-amber-500/90 to-orange-700/90',chair:'bg-amber-300/80',glow:'shadow-amber-500/25'},
  reservada:{bg:'bg-blue-500/10 hover:bg-blue-500/20',border:'border-blue-500/30',dot:'bg-blue-400',label:'Reservada',table:'from-blue-500/80 to-sky-700/80',chair:'bg-blue-300/70',glow:'shadow-blue-500/20'},
  limpieza:{bg:'bg-purple-500/10 hover:bg-purple-500/20',border:'border-purple-500/30',dot:'bg-purple-400',label:'Limpieza',table:'from-purple-500/80 to-fuchsia-700/80',chair:'bg-purple-300/70',glow:'shadow-purple-500/20'},
  cerrada:{bg:'bg-surface-200/5 hover:bg-surface-200/10',border:'border-white/5',dot:'bg-surface-200/30',label:'Cerrada',table:'from-surface-500/60 to-surface-700/60',chair:'bg-surface-300/30',glow:'shadow-black/10'},
}

function tiempo(f?: string): string {
  if (!f) return ''
  const d = Math.floor((Date.now()-new Date(f).getTime())/60000)
  return d < 60 ? `${d}m` : `${Math.floor(d/60)}h ${d%60}m`
}

function MesaImagen({ mesa, cfg }: { mesa: Mesa; cfg: typeof CFG[EstadoMesa] }) {
  const chairs = Math.min(Math.max(Number(mesa.capacidad) || 2, 2), 8)
  return (
    <div className="relative h-20 rounded-lg overflow-hidden bg-surface-950/60 border border-white/5 mb-2">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.08),transparent_58%)]" />
      <div className="absolute inset-x-3 top-2 bottom-2">
        {Array.from({length: chairs}).map((_, i) => {
          const left = chairs === 1 ? 50 : 12 + (i % Math.ceil(chairs / 2)) * (76 / Math.max(Math.ceil(chairs / 2) - 1, 1))
          const top = i < Math.ceil(chairs / 2) ? 5 : 78
          return <span key={i} className={cn('absolute w-4 h-2 rounded-sm opacity-80', cfg.chair)} style={{left:`${left}%`, top:`${top}%`, transform:'translateX(-50%)'}} />
        })}
      </div>
      <div className={cn('absolute left-1/2 top-1/2 h-10 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br shadow-xl border border-white/20 flex items-center justify-center', cfg.table, cfg.glow)}>
        <UtensilsCrossed className="w-5 h-5 text-white/85" />
      </div>
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/30 px-2 py-1 backdrop-blur-sm">
        <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
        <span className="text-[9px] font-semibold text-white/80">{cfg.label}</span>
      </div>
    </div>
  )
}

function CodigoMesa({url}:{url:string}) {
  const [src,setSrc]=useState('')
  useEffect(()=>{ QRCode.toDataURL([{ data:url, mode:'byte' }],{width:512,margin:4,errorCorrectionLevel:'H'}).then(setSrc) },[url])
  return src?<img src={src} alt="Código QR público de la mesa" className="mx-auto h-64 w-64 max-w-full rounded-lg bg-white p-2"/>:null
}

export default function MesasPage() {
  const navigate = useNavigate(); const { isAdmin, user } = useAuth(); const qc = useQueryClient()
  const [filtro, setFiltro] = useState<EstadoMesa|'todas'>('todas')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({numero:'',nombre:'',capacidad:'4',tipo:'mesa',consumo_minimo:'0'})
  const [mesaEditando, setMesaEditando] = useState<Mesa | null>(null)
  const [edicion, setEdicion] = useState({numero:'',nombre:'',capacidad:'4'})
  const [meseroMasivo, setMeseroMasivo] = useState('')
  const [mesaQr, setMesaQr] = useState<Mesa | null>(null)
  const urlMesaPublica = mesaQr && user?.empresa?.id
    ? new URL(`/menu/${user.empresa.id}/${mesaQr.id}`, window.location.origin).toString()
    : ''

  const { data: mesas = [], isLoading, refetch } = useQuery({
    queryKey: ['mesas'],
    queryFn: async () => { const { data } = await api.get<any>('/mesas'); return (data.data||data) as Mesa[] },
    refetchInterval: 15_000,
  })
  const { data: meseros = [] } = useQuery({
    queryKey: ['meseros-asignables'],
    queryFn: async () => {
      const { data } = await api.get<any>('/usuarios')
      return ((data.data || data) as any[]).filter(usuario => ['mesero','cajero','barra'].includes(String(usuario.rol || '').trim().toLowerCase()) && usuario.activo)
    },
    enabled: isAdmin,
  })
  const crear = useMutation({
    mutationFn: (d:any) => api.post('/mesas', d),
    onSuccess: () => { qc.invalidateQueries({queryKey:['mesas']}); setModal(false); setForm({numero:'',nombre:'',capacidad:'4',tipo:'mesa',consumo_minimo:'0'}); toast.success('Mesa creada') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'Error'),
  })
  const asignarMesero = useMutation({
    mutationFn: ({ mesaId, meseroId }: { mesaId: string; meseroId: string }) => api.patch(`/mesas/${mesaId}`, { mesero_id: meseroId || null }),
    onMutate: async ({ mesaId, meseroId }) => {
      await qc.cancelQueries({queryKey:['mesas']})
      const anterior = qc.getQueryData<Mesa[]>(['mesas'])
      qc.setQueryData<Mesa[]>(['mesas'], mesasActuales => (mesasActuales || []).map(mesa => mesa.id === mesaId ? {...mesa, mesero_id:meseroId || null} : mesa))
      return { anterior }
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:['mesas']}); toast.success('Mesa asignada') },
    onError: (e:any, _variables, contexto) => { if (contexto?.anterior) qc.setQueryData(['mesas'], contexto.anterior); toast.error(e?.response?.data?.msg ?? e?.message ?? 'No se pudo asignar la mesa') },
  })
  const asignarTodas = useMutation({
    mutationFn: () => api.patch('/mesas', { asignar_todas:true, mesero_id:meseroMasivo || null }),
    onMutate: async () => {
      await qc.cancelQueries({queryKey:['mesas']})
      const anterior = qc.getQueryData<Mesa[]>(['mesas'])
      qc.setQueryData<Mesa[]>(['mesas'], mesasActuales => (mesasActuales || []).map(mesa => ({...mesa, mesero_id:meseroMasivo || null})))
      return { anterior }
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:['mesas']}); toast.success(meseroMasivo ? 'Todas las mesas fueron asignadas' : 'Todas las mesas quedaron sin asignar') },
    onError: (e:any, _variables, contexto) => { if (contexto?.anterior) qc.setQueryData(['mesas'], contexto.anterior); toast.error(e?.response?.data?.msg ?? 'No se pudieron asignar todas las mesas') },
  })
  const editarMesa = useMutation({
    mutationFn: () => api.patch(`/mesas/${mesaEditando?.id}`, { numero: edicion.numero.trim(), nombre: edicion.nombre.trim() || null, capacidad: Math.max(1, parseInt(edicion.capacidad) || 1) }),
    onSuccess: () => { qc.invalidateQueries({queryKey:['mesas']}); setMesaEditando(null); toast.success('Mesa actualizada') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudo actualizar la mesa'),
  })

  const filtradas = filtro === 'todas' ? mesas : mesas.filter(m => m.estado === filtro)
  const conteo = (['libre','ocupada','reservada','limpieza','cerrada'] as EstadoMesa[]).reduce((a,e) => { a[e]=mesas.filter(m=>m.estado===e).length; return a }, {} as Record<EstadoMesa,number>)

  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Mesas</h1><p className="page-subtitle">{mesas.length} mesas - {conteo.ocupada??0} ocupadas - {conteo.libre??0} libres</p></div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-ghost btn-sm"><RefreshCw className="w-4 h-4"/></button>
          {isAdmin && <button onClick={() => setModal(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Nueva mesa</button>}
        </div>
      </div>
      {isAdmin && <div className="card p-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1"><p className="text-sm font-medium text-surface-50">Asignacion masiva</p><p className="text-xs text-surface-200/45">Puedes asignar todas las mesas activas al mismo responsable operativo, sin limite de cantidad.</p></div>
        <select className="input sm:w-56" value={meseroMasivo} onChange={e => setMeseroMasivo(e.target.value)}><option value="">Sin asignar</option>{meseros.map((mesero:any) => <option key={mesero.id} value={mesero.id}>{mesero.nombre} ({mesero.username})</option>)}</select>
        <button onClick={() => asignarTodas.mutate()} disabled={asignarTodas.isPending} className="btn-secondary whitespace-nowrap">{asignarTodas.isPending ? 'Asignando...' : 'Asignar todas'}</button>
      </div>}
      {isAdmin && meseros.length === 0 && <p className="text-sm text-amber-400">No hay responsables operativos activos. Crea un usuario con rol Mesero, Cajero o Barra en Usuarios.</p>}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltro('todas')} className={cn('btn btn-sm',filtro==='todas'?'btn-primary':'btn-secondary')}>Todas ({mesas.length})</button>
        {(['libre','ocupada','reservada','limpieza','cerrada'] as EstadoMesa[]).map(e => (
          <button key={e} onClick={() => setFiltro(e)} className={cn('btn btn-sm',filtro===e?'btn-primary':'btn-secondary')}>
            <span className={cn('w-2 h-2 rounded-full',CFG[e].dot.replace(' animate-pulse',''))}/> {CFG[e].label} {conteo[e]>0&&`(${conteo[e]})`}
          </button>
        ))}
      </div>
      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48">
          <p className="text-sm text-surface-200/40">{mesas.length===0?'No hay mesas':'Sin mesas en este estado'}</p>
          {mesas.length===0&&isAdmin&&<button onClick={() => setModal(true)} className="btn-primary btn-sm mt-4"><Plus className="w-4 h-4"/>Crear primera mesa</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {filtradas.map(mesa => {
            const cfg = CFG[mesa.estado] ?? CFG.libre
            return (
              <article key={mesa.id} className={cn('relative rounded-xl border p-2.5 transition-all hover:-translate-y-0.5',cfg.bg,cfg.border)}>
                <MesaImagen mesa={mesa} cfg={cfg} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-surface-50">Mesa {mesa.numero}</h3>
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0',cfg.dot)}/>
                    </div>
                    {mesa.nombre && <p className="text-xs text-surface-200/60 truncate">{mesa.nombre}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1"><Users className="w-3 h-3 text-surface-200/40"/><span className="text-xs text-surface-200/60">{mesa.capacidad}</span></div>
                    {isAdmin && <button
                      onClick={() => { setMesaEditando(mesa); setEdicion({ numero: String(mesa.numero || ''), nombre: mesa.nombre || '', capacidad: String(mesa.capacidad || 1) }) }}
                      className="btn-ghost btn-sm h-7 w-7 p-0"
                      title="Editar mesa"
                    ><Pencil className="w-3.5 h-3.5"/></button>}
                    {isAdmin && <button onClick={()=>setMesaQr(mesa)} className="btn-ghost btn-sm h-7 w-7 p-0" title="Ver QR del menú"><QrCode className="w-3.5 h-3.5"/></button>}
                  </div>
                </div>

                {mesa.zona_nombre && <div className="flex items-center gap-1 mt-1"><MapPin className="w-3 h-3 text-surface-200/30"/><span className="text-xs text-surface-200/40 truncate">{mesa.zona_nombre}</span></div>}

                {isAdmin && <div className="mt-2">
                  <label className="mb-1 flex items-center gap-1 text-xs text-surface-200/50"><UserRoundCheck className="w-3 h-3"/>Responsable asignado</label>
                  <select
                    className="input h-9 py-1 text-xs"
                    value={mesa.mesero_id || ''}
                    onChange={e => asignarMesero.mutate({ mesaId: mesa.id, meseroId: e.target.value })}
                    disabled={asignarMesero.isPending}
                  >
                    <option value="">Sin asignar</option>
                    {meseros.map((mesero:any) => <option key={mesero.id} value={mesero.id}>{mesero.nombre} ({mesero.username})</option>)}
                  </select>
                </div>}

                <div className="mt-2 min-h-[36px]">
                  {mesa.pedido_id && mesa.pedido_total !== undefined ? (
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-surface-200/45">Pedido activo</p>
                        <p className="text-base font-black text-surface-50">{formatCurrency(mesa.pedido_total)}</p>
                      </div>
                      {mesa.apertura_at && <div className="flex items-center gap-1 text-surface-200/45"><Clock className="w-3 h-3"/><span className="text-xs">{tiempo(mesa.apertura_at)}</span></div>}
                    </div>
                  ) : <p className="text-xs font-medium text-surface-200/45">Lista para tomar pedido</p>}
                </div>

                <button onClick={() => navigate(`/mesero/mesa/${mesa.id}`)} className="btn-primary w-full mt-2 h-9 justify-center text-xs">
                  <ClipboardList className="w-3.5 h-3.5"/>{mesa.pedido_id ? 'Agregar pedido' : 'Tomar pedido'}
                </button>
              </article>
            )
          })}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva mesa" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => crear.mutate({nombre:form.nombre||undefined,capacidad:parseInt(form.capacidad),tipo:form.tipo,consumo_minimo:parseFloat(form.consumo_minimo)||0})} disabled={crear.isPending} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear mesa'}</button></div>}>
        <div className="space-y-4">
          <div className="rounded-lg border border-brand-400/20 bg-brand-500/10 p-3 text-sm text-brand-100">El numero se asignara automaticamente y de forma consecutiva.</div>
          <div><label className="label">Nombre (opcional)</label><input className="input" placeholder="Ej: VIP 1" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Capacidad</label><input type="number" min={1} className="input" value={form.capacidad} onChange={e=>setForm(p=>({...p,capacidad:e.target.value}))}/></div>
            <div><label className="label">Tipo</label><select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}><option value="mesa">Mesa</option><option value="barra">Barra</option><option value="vip">VIP</option><option value="cabina">Cabina</option><option value="terraza">Terraza</option></select></div>
          </div>
        </div>
      </Modal>
      <Modal open={!!mesaEditando} onClose={() => setMesaEditando(null)} title={`Editar mesa ${mesaEditando?.numero || ''}`} size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setMesaEditando(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => editarMesa.mutate()} disabled={editarMesa.isPending || !edicion.numero.trim() || !edicion.capacidad} className="btn-primary flex-1">{editarMesa.isPending ? 'Guardando...' : 'Guardar cambios'}</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Numero o codigo de mesa</label><input className="input" placeholder="Ej: A8" value={edicion.numero} onChange={e => setEdicion(p => ({...p, numero:e.target.value}))}/></div>
          <div><label className="label">Nombre de la mesa</label><input className="input" placeholder="Ej: Terraza 1" value={edicion.nombre} onChange={e => setEdicion(p => ({...p, nombre:e.target.value}))}/></div>
          <div><label className="label">Cantidad de personas</label><input type="number" min={1} className="input" value={edicion.capacidad} onChange={e => setEdicion(p => ({...p, capacidad:e.target.value}))}/></div>
        </div>
      </Modal>
      <Modal open={!!mesaQr} onClose={()=>setMesaQr(null)} title={`QR · Mesa ${mesaQr?.numero || ''}`} size="sm"><div className="space-y-4 text-center"><p className="text-sm text-surface-200/60">Este código abre la carta pública de la mesa, sin usuario ni contraseña.</p>{urlMesaPublica&&<CodigoMesa url={urlMesaPublica}/>}<a href={urlMesaPublica} target="_blank" rel="noreferrer" className="btn-secondary mx-auto w-full text-xs"><ExternalLink className="h-4 w-4"/>Abrir carta pública</a><p className="break-all text-xs text-surface-200/45">{urlMesaPublica}</p></div></Modal>
    </div>
  )
}
