import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Users, Clock, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import type { Mesa, EstadoMesa } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const CFG: Record<EstadoMesa,{bg:string;border:string;dot:string;label:string}> = {
  libre:{bg:'bg-emerald-500/10 hover:bg-emerald-500/20',border:'border-emerald-500/30',dot:'bg-emerald-400',label:'Libre'},
  ocupada:{bg:'bg-amber-500/10 hover:bg-amber-500/20',border:'border-amber-500/30',dot:'bg-amber-400 animate-pulse',label:'Ocupada'},
  reservada:{bg:'bg-blue-500/10 hover:bg-blue-500/20',border:'border-blue-500/30',dot:'bg-blue-400',label:'Reservada'},
  limpieza:{bg:'bg-purple-500/10 hover:bg-purple-500/20',border:'border-purple-500/30',dot:'bg-purple-400',label:'Limpieza'},
  cerrada:{bg:'bg-surface-200/5 hover:bg-surface-200/10',border:'border-white/5',dot:'bg-surface-200/30',label:'Cerrada'},
}

function tiempo(f?: string): string {
  if (!f) return ''
  const d = Math.floor((Date.now()-new Date(f).getTime())/60000)
  return d < 60 ? `${d}m` : `${Math.floor(d/60)}h ${d%60}m`
}

export default function MesasPage() {
  const navigate = useNavigate(); const { isAdmin } = useAuth(); const qc = useQueryClient()
  const [filtro, setFiltro] = useState<EstadoMesa|'todas'>('todas')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({numero:'',nombre:'',capacidad:'4',tipo:'mesa',consumo_minimo:'0'})

  const { data: mesas = [], isLoading, refetch } = useQuery({
    queryKey: ['mesas'],
    queryFn: async () => { const { data } = await api.get<any>('/mesas'); return (data.data||data) as Mesa[] },
    refetchInterval: 15_000,
  })
  const crear = useMutation({
    mutationFn: (d:any) => api.post('/mesas', d),
    onSuccess: () => { qc.invalidateQueries({queryKey:['mesas']}); setModal(false); setForm({numero:'',nombre:'',capacidad:'4',tipo:'mesa',consumo_minimo:'0'}); toast.success('Mesa creada') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'Error'),
  })

  const filtradas = filtro === 'todas' ? mesas : mesas.filter(m => m.estado === filtro)
  const conteo = (['libre','ocupada','reservada','limpieza','cerrada'] as EstadoMesa[]).reduce((a,e) => { a[e]=mesas.filter(m=>m.estado===e).length; return a }, {} as Record<EstadoMesa,number>)

  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Mesas</h1><p className="page-subtitle">{mesas.length} mesas · {conteo.ocupada??0} ocupadas · {conteo.libre??0} libres</p></div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-ghost btn-sm"><RefreshCw className="w-4 h-4"/></button>
          {isAdmin && <button onClick={() => setModal(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Nueva mesa</button>}
        </div>
      </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtradas.map(mesa => {
            const cfg = CFG[mesa.estado] ?? CFG.libre
            return (
              <button key={mesa.id} onClick={() => navigate(`/app/pedidos?mesa=${mesa.id}`)}
                className={cn('relative p-4 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98]',cfg.bg,cfg.border)}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-surface-50">#{mesa.numero}</span>
                  <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0',cfg.dot)}/>
                </div>
                {mesa.nombre && <p className="text-xs text-surface-200/60 truncate mb-1">{mesa.nombre}</p>}
                {mesa.zona_nombre && <div className="flex items-center gap-1 mb-1"><MapPin className="w-3 h-3 text-surface-200/30"/><span className="text-[10px] text-surface-200/30 truncate">{mesa.zona_nombre}</span></div>}
                {mesa.pedido_id && mesa.pedido_total !== undefined ? (
                  <div className="space-y-1 mt-2">
                    <p className="text-sm font-bold text-surface-50">{formatCurrency(mesa.pedido_total)}</p>
                    {mesa.apertura_at && <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-surface-200/30"/><span className="text-[10px] text-surface-200/40">{tiempo(mesa.apertura_at)}</span></div>}
                  </div>
                ) : <p className="text-xs font-medium mt-2 text-surface-200/40">{cfg.label}</p>}
                <div className="flex items-center gap-1 mt-2"><Users className="w-3 h-3 text-surface-200/20"/><span className="text-[10px] text-surface-200/25">{mesa.capacidad}</span></div>
              </button>
            )
          })}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva mesa" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => crear.mutate({numero:parseInt(form.numero),nombre:form.nombre||undefined,capacidad:parseInt(form.capacidad),tipo:form.tipo,consumo_minimo:parseFloat(form.consumo_minimo)||0})} disabled={!form.numero||crear.isPending} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear mesa'}</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Número *</label><input type="number" min={1} className="input" value={form.numero} onChange={e=>setForm(p=>({...p,numero:e.target.value}))}/></div>
          <div><label className="label">Nombre (opcional)</label><input className="input" placeholder="Ej: VIP 1" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Capacidad</label><input type="number" min={1} className="input" value={form.capacidad} onChange={e=>setForm(p=>({...p,capacidad:e.target.value}))}/></div>
            <div><label className="label">Tipo</label><select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}><option value="mesa">Mesa</option><option value="barra">Barra</option><option value="vip">VIP</option><option value="cabina">Cabina</option><option value="terraza">Terraza</option></select></div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
