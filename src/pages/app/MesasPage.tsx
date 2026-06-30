import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import type { Mesa, EstadoMesa } from '@/types'
import { useSocket } from '@/contexts/SocketContext'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatCurrency, calcularTiempoTranscurrido } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const ESTADOS: {value:EstadoMesa;label:string;dot:string}[] = [
  {value:'libre',label:'Libre',dot:'bg-emerald-400'},
  {value:'ocupada',label:'Ocupada',dot:'bg-amber-400'},
  {value:'preparando',label:'Preparando',dot:'bg-blue-400'},
  {value:'lista_cobrar',label:'Lista cobrar',dot:'bg-orange-400'},
  {value:'pendiente_pago',label:'Pendiente',dot:'bg-red-400'},
]
const cfg: Record<EstadoMesa,{color:string;bg:string;border:string}> = {
  libre:{color:'text-emerald-400',bg:'bg-emerald-500/10',border:'border-emerald-500/30'},
  ocupada:{color:'text-amber-400',bg:'bg-amber-500/10',border:'border-amber-500/30'},
  preparando:{color:'text-blue-400',bg:'bg-blue-500/10',border:'border-blue-500/30'},
  lista_cobrar:{color:'text-orange-400',bg:'bg-orange-500/10',border:'border-orange-500/30'},
  pendiente_pago:{color:'text-red-400',bg:'bg-red-500/10',border:'border-red-500/30'},
  cerrada:{color:'text-surface-200/40',bg:'bg-surface-200/5',border:'border-white/5'},
}

export default function MesasPage() {
  const navigate = useNavigate(); const { isAdmin } = useAuth()
  const { on, off } = useSocket(); const qc = useQueryClient()
  const [filtro, setFiltro] = useState<EstadoMesa|'todas'>('todas')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({numero:'',nombre:'',capacidad:'4'})

  const { data:mesas=[], isLoading, refetch } = useQuery({
    queryKey:['mesas'],
    queryFn: async()=>{const {data}=await api.get<{data:Mesa[]}>('/mesas');return data.data},
    refetchInterval:15_000,
  })

  useEffect(()=>{
    const h=()=>qc.invalidateQueries({queryKey:['mesas']})
    on('mesa_actualizada',h); on('pedido_nuevo',h)
    return()=>{off('mesa_actualizada',h); off('pedido_nuevo',h)}
  },[on,off,qc])

  const crear = useMutation({
    mutationFn:(d:{numero:string;nombre:string;capacidad:number})=>api.post('/mesas',d),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['mesas']});setModal(false);setForm({numero:'',nombre:'',capacidad:'4'});toast.success('Mesa creada')},
    onError:(e:any)=>toast.error(e?.response?.data?.message??'Error'),
  })

  const filtradas = filtro==='todas' ? mesas : mesas.filter(m=>m.estado===filtro)
  const conteo = ESTADOS.reduce((a,e)=>{a[e.value]=mesas.filter(m=>m.estado===e.value).length;return a},{} as Record<EstadoMesa,number>)

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Mesas</h1><p className="page-subtitle">{mesas.length} mesas</p></div>
        <div className="flex gap-2">
          <button onClick={()=>refetch()} className="btn-ghost btn-sm"><RefreshCw className="w-4 h-4"/></button>
          {isAdmin&&<button onClick={()=>setModal(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Nueva mesa</button>}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>setFiltro('todas')} className={cn('btn btn-sm',filtro==='todas'?'btn-primary':'btn-secondary')}>Todas ({mesas.length})</button>
        {ESTADOS.map(e=><button key={e.value} onClick={()=>setFiltro(e.value)} className={cn('btn btn-sm',filtro===e.value?'btn-primary':'btn-secondary')}><span className={cn('w-2 h-2 rounded-full',e.dot)}/>{e.label} {conteo[e.value]>0&&`(${conteo[e.value]})`}</button>)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filtradas.map(mesa=>{
          const m=mesa as any; const c=cfg[mesa.estado]
          return (
            <button key={mesa.id} onClick={()=>navigate(`/app/pedidos?mesa=${mesa.id}`)}
              className={cn('relative p-4 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98]',c.bg,c.border)}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-surface-50">#{mesa.numero}</span>
                <span className={cn('w-2.5 h-2.5 rounded-full',{
                  'bg-emerald-400':mesa.estado==='libre','bg-amber-400':mesa.estado==='ocupada',
                  'bg-blue-400 animate-pulse':mesa.estado==='preparando','bg-orange-400':mesa.estado==='lista_cobrar',
                  'bg-red-400 animate-pulse':mesa.estado==='pendiente_pago','bg-surface-200/20':mesa.estado==='cerrada',
                })}/>
              </div>
              {mesa.nombre&&<p className="text-xs text-surface-200/50 mb-2 truncate">{mesa.nombre}</p>}
              {m.pedido_id&&m.apertura_at ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-surface-100">{formatCurrency(m.pedido_total??0)}</p>
                  <p className="text-[10px] text-surface-200/40">{calcularTiempoTranscurrido(m.apertura_at)}</p>
                </div>
              ) : <p className={cn('text-xs font-medium mt-1',c.color)}>Disponible</p>}
              <p className="text-[10px] text-surface-200/25 mt-2">Cap. {mesa.capacidad}</p>
            </button>
          )
        })}
      </div>
      {filtradas.length===0&&<div className="flex items-center justify-center h-40 text-sm text-surface-200/30">Sin mesas en este estado</div>}
      <Modal open={modal} onClose={()=>setModal(false)} title="Nueva mesa" size="sm"
        footer={<div className="flex gap-3"><button onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={()=>crear.mutate({numero:form.numero,nombre:form.nombre,capacidad:parseInt(form.capacidad)})} disabled={!form.numero||crear.isPending} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear'}</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Número *</label><input className="input" placeholder="Ej: 1, A1" value={form.numero} onChange={e=>setForm(p=>({...p,numero:e.target.value}))}/></div>
          <div><label className="label">Nombre (opcional)</label><input className="input" placeholder="Ej: Terraza" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div><label className="label">Capacidad</label><input type="number" min={1} max={50} className="input" value={form.capacidad} onChange={e=>setForm(p=>({...p,capacidad:e.target.value}))}/></div>
        </div>
      </Modal>
    </div>
  )
}
