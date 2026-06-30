import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, ChefHat } from 'lucide-react'
import api from '@/lib/axios'
import type { Pedido, PedidoItem } from '@/types'
import { useSocket } from '@/contexts/SocketContext'
import { calcularTiempoTranscurrido } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function CocinaPage() {
  const qc=useQueryClient(); const {on,off}=useSocket()
  const {data:pedidos=[]}=useQuery({
    queryKey:['cocina'],
    queryFn:async()=>{const {data}=await api.get<{data:Pedido[]}>('/pedidos?estado=abierto,en_preparacion');return data.data},
    refetchInterval:10_000,
  })
  useEffect(()=>{
    const h=()=>qc.invalidateQueries({queryKey:['cocina']})
    on('pedido_nuevo',h); on('pedido_actualizado',h); on('item_actualizado',h)
    return()=>{off('pedido_nuevo',h); off('pedido_actualizado',h); off('item_actualizado',h)}
  },[on,off,qc])
  const upd=useMutation({
    mutationFn:({pid,iid,estado}:{pid:string;iid:string;estado:string})=>api.patch(`/pedidos/${pid}/items/${iid}`,{estado}),
    onSuccess:()=>qc.invalidateQueries({queryKey:['cocina']}),
    onError:()=>toast.error('Error'),
  })
  const conItems=pedidos.map(p=>({...p,items:(p.items??[]).filter(i=>['cocina','ambos'].includes(i.destino)&&!['entregado','cancelado'].includes(i.estado))})).filter(p=>p.items.length>0)
  return (
    <div className="min-h-screen bg-surface-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center"><ChefHat className="w-5 h-5 text-orange-400"/></div>
          <div><h1 className="text-xl font-bold text-white">Pantalla de Cocina</h1><p className="text-sm text-surface-200/50">{conItems.length} pedidos pendientes</p></div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {conItems.map(pedido=>{
            const urgente=new Date().getTime()-new Date(pedido.apertura_at).getTime()>20*60*1000
            const p=pedido as any
            return (
              <div key={pedido.id} className={cn('card border rounded-xl overflow-hidden',urgente?'border-red-500/50':'border-white/5')}>
                <div className={cn('px-4 py-3 flex items-center justify-between',urgente?'bg-red-500/20':'bg-white/5')}>
                  <span className="font-bold text-white">{p.mesa_numero?`Mesa ${p.mesa_numero}`:`#${pedido.numero}`}</span>
                  <div className={cn('flex items-center gap-1 text-xs font-semibold',urgente?'text-red-400':'text-amber-400')}><Clock className="w-3 h-3"/>{calcularTiempoTranscurrido(pedido.apertura_at)}</div>
                </div>
                <div className="divide-y divide-white/5">
                  {pedido.items.map(item=>{const it=item as any;return(
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xl font-bold',item.estado==='en_preparacion'?'text-blue-400':'text-surface-50')}>{item.cantidad}</span>
                          <span className="text-sm text-surface-100">{it.nombre}</span>
                        </div>
                        {item.observaciones&&<p className="text-xs text-amber-400 mt-0.5 ml-7">⚠ {item.observaciones}</p>}
                      </div>
                      <div className="flex gap-1.5">
                        {item.estado==='pendiente'&&<button onClick={()=>upd.mutate({pid:pedido.id,iid:item.id,estado:'en_preparacion'})} className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-medium">Iniciar</button>}
                        {item.estado==='en_preparacion'&&<button onClick={()=>upd.mutate({pid:pedido.id,iid:item.id,estado:'listo'})} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-medium"><Check className="w-3 h-3"/>Listo</button>}
                        {item.estado==='listo'&&<span className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-400/60 font-medium">✓ Listo</span>}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )
          })}
          {conItems.length===0&&<div className="col-span-full flex flex-col items-center justify-center py-20 text-center"><ChefHat className="w-12 h-12 text-surface-200/20 mb-3"/><p className="text-surface-200/40 font-medium">Sin pedidos pendientes</p></div>}
        </div>
      </div>
    </div>
  )
}
