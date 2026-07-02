import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import api from '@/lib/axios'
import type { Pedido } from '@/types'
import { useSocket } from '@/contexts/SocketContext'
import { formatCurrency, formatDate, calcularTiempoTranscurrido } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const badge: Record<string,string> = {abierto:'badge-blue',en_preparacion:'badge-yellow',listo:'badge-green',cobrado:'badge-gray',cancelado:'badge-red'}
const lbl: Record<string,string> = {abierto:'Abierto',en_preparacion:'En preparación',listo:'Listo',cobrado:'Cobrado',cancelado:'Cancelado'}

export default function PedidosPage() {
  const navigate = useNavigate(); const [params] = useSearchParams(); const qc = useQueryClient(); const { on, off } = useSocket()
  const [filtro, setFiltro] = useState(params.get('estado') || 'activos')
  const estadoQ = filtro === 'activos' ? 'abierto,en_preparacion,listo' : filtro === 'todos' ? '' : filtro
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos', estadoQ],
    queryFn: async () => { const p = estadoQ ? `?estado=${estadoQ}` : ''; const { data } = await api.get<any>(`/pedidos${p}`); return (data.data || data) as Pedido[] },
    refetchInterval: 15_000,
  })
  useEffect(() => { const h = () => qc.invalidateQueries({queryKey:['pedidos']}); on('pedido_nuevo',h); on('pedido_actualizado',h); return () => { off('pedido_nuevo',h); off('pedido_actualizado',h) } }, [on,off,qc])
  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Pedidos</h1><p className="page-subtitle">{pedidos.length} pedidos</p></div>
        <button onClick={() => navigate('/app/mesas')} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Nuevo</button>
      </div>
      <div className="flex gap-2">
        {[{value:'activos',label:'Activos'},{value:'cobrado',label:'Cobrados'},{value:'cancelado',label:'Cancelados'},{value:'todos',label:'Todos'}].map(f => (
          <button key={f.value} onClick={() => setFiltro(f.value)} className={cn('btn btn-sm', filtro===f.value?'btn-primary':'btn-secondary')}>{f.label}</button>
        ))}
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>#</th><th>Mesa</th><th>Estado</th><th>Mesero</th><th>Total</th><th>Hora</th><th>Tiempo</th></tr></thead>
        <tbody>
          {pedidos.map(p => { const r = p as any; return (
            <tr key={p.id} onClick={() => navigate(`/app/pedidos/${p.id}`)} className="cursor-pointer">
              <td className="font-mono text-xs text-surface-200/60">#{p.numero || '-'}</td>
              <td>{r.mesa_numero ? <span className="font-medium">Mesa {r.mesa_numero}</span> : <span className="text-surface-200/40">Sin mesa</span>}</td>
              <td><span className={badge[p.estado]}>{lbl[p.estado]}</span></td>
              <td className="text-surface-200/70">{r.mesero_nombre || r.usuario_nombre || '—'}</td>
              <td className="font-semibold text-surface-50">{formatCurrency(p.total)}</td>
              <td className="text-surface-200/50 text-xs">{formatDate(p.apertura_at,'HH:mm')}</td>
              <td className="text-surface-200/50 text-xs">{calcularTiempoTranscurrido(p.apertura_at)}</td>
            </tr>
          )})}
          {pedidos.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-surface-200/30">Sin pedidos</td></tr>}
        </tbody>
      </table></div></div>
    </div>
  )
}
