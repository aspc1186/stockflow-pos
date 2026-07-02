import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChefHat } from 'lucide-react'
import api from '@/lib/axios'
import { formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export default function CocinaPage() {
  const qc = useQueryClient()
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['cocina-pedidos'],
    queryFn: async () => { const { data } = await api.get<any>('/pedidos?estado=abierto,en_preparacion,listo'); return (data.data||data) as any[] },
    refetchInterval: 8_000,
  })
  const actualizar = useMutation({
    mutationFn: ({pedidoId,itemId,estado}:{pedidoId:string;itemId:string;estado:string}) =>
      api.patch(`/pedidos/${pedidoId}/items/${itemId}`, {estado}),
    onSuccess: () => qc.invalidateQueries({queryKey:['cocina-pedidos']}),
    onError: () => toast.error('Error al actualizar'),
  })

  if (isLoading) return <PageLoader />
  const activos = pedidos.filter((p:any) => ['abierto','en_preparacion'].includes(p.estado))

  return (
    <div className="min-h-screen bg-surface-900 p-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center"><ChefHat className="w-5 h-5 text-orange-400"/></div>
        <div><h1 className="text-xl font-bold text-white">Cocina</h1><p className="text-sm text-surface-200/50">{activos.length} pedidos activos</p></div>
      </div>
      {activos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20"><ChefHat className="w-16 h-16 text-surface-200/15 mb-4"/><p className="text-surface-200/40">Sin pedidos pendientes</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activos.map((pedido:any) => {
            const items = (pedido.items||[]).filter((i:any) => i.destino==='cocina'||i.destino==='ambos')
            if (!items.length) return null
            return (
              <div key={pedido.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-surface-50">Mesa {pedido.mesa_numero || '—'}</p>
                    <p className="text-xs text-surface-200/50">{formatDate(pedido.apertura_at,'HH:mm')} · {pedido.mesero_nombre||''}</p>
                  </div>
                  <span className={cn('badge', pedido.estado==='abierto'?'badge-yellow':'badge-blue')}>{pedido.estado.replace('_',' ')}</span>
                </div>
                <div className="space-y-2">
                  {items.map((item:any) => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <div>
                        <p className="text-sm font-medium text-surface-50">{item.nombre || item.producto_id}</p>
                        <p className="text-xs text-surface-200/50">{item.cantidad}x {item.observaciones||''}</p>
                      </div>
                      <div className="flex gap-1">
                        {item.estado==='pendiente'&&<button onClick={()=>actualizar.mutate({pedidoId:pedido.id,itemId:item.id,estado:'preparando'})} className="text-[10px] px-2 py-1 rounded bg-blue-500/20 text-blue-400">Preparar</button>}
                        {item.estado==='preparando'&&<button onClick={()=>actualizar.mutate({pedidoId:pedido.id,itemId:item.id,estado:'listo'})} className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">Listo ✓</button>}
                        {item.estado==='listo'&&<span className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400/60">Listo</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
