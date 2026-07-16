import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { HandCoins, Plus } from 'lucide-react'
import api from '@/lib/axios'
import type { Pedido } from '@/types'
import { useSocket } from '@/contexts/SocketContext'
import { formatCurrency, formatDate, calcularTiempoTranscurrido } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const badge: Record<string,string> = {abierto:'badge-blue',en_preparacion:'badge-yellow',listo:'badge-green',precierre:'badge-yellow',cobrado:'badge-gray',cancelado:'badge-red'}
const lbl: Record<string,string> = {abierto:'Abierto',en_preparacion:'En preparación',listo:'Listo',cobrado:'Cobrado',cancelado:'Cancelado'}

export default function PedidosPage() {
  const navigate = useNavigate(); const [params] = useSearchParams(); const qc = useQueryClient(); const { on, off } = useSocket(); const { isAdmin } = useAuth()
  const [filtro, setFiltro] = useState(params.get('estado') || 'todos')
  const estadoQ = filtro === 'activos' ? 'abierto,en_preparacion,listo,precierre' : filtro === 'todos' ? '' : filtro
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos', estadoQ],
    queryFn: async () => { const p = estadoQ ? `?estado=${estadoQ}` : ''; const { data } = await api.get<any>(`/pedidos${p}`); return (data.data || data) as Pedido[] },
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  })
  const { data: arqueo = [] } = useQuery({
    queryKey: ['arqueo-meseros'],
    queryFn: async () => { const { data } = await api.get<any>('/dashboard/arqueo'); return (data.data || data) as any[] },
    enabled: isAdmin,
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  })
  useEffect(() => { const h = () => qc.invalidateQueries({queryKey:['pedidos']}); on('pedido_nuevo',h); on('pedido_actualizado',h); return () => { off('pedido_nuevo',h); off('pedido_actualizado',h) } }, [on,off,qc])
  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Pedidos</h1><p className="page-subtitle">{pedidos.length} pedidos</p></div>
        <button onClick={() => navigate('/app/mesas')} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Nuevo</button>
      </div>
      {isAdmin && <div className="card overflow-hidden"><div className="flex items-center gap-2 border-b border-white/5 px-4 py-3"><HandCoins className="w-4 h-4 text-amber-400"/><div><h3 className="text-sm font-semibold">Arqueo temporal por mesero</h3><p className="text-xs text-surface-200/45">Ventas en precierre pendientes de confirmar en caja.</p></div></div><div className="overflow-x-auto"><table className="table-base"><thead><tr><th>Mesero</th><th>Ventas en precierre</th><th>Dinero por entregar</th></tr></thead><tbody>{arqueo.map((a:any)=><tr key={a.id}><td><p className="font-medium">{a.nombre}</p><p className="text-xs text-surface-200/45">@{a.username}</p></td><td className="font-semibold text-amber-300">{a.ventas_precierre}</td><td className="font-bold text-surface-50">{formatCurrency(a.dinero_por_entregar)}</td></tr>)}{arqueo.length===0&&<tr><td colSpan={3} className="py-6 text-center text-sm text-surface-200/35">No hay dinero pendiente por entregar</td></tr>}</tbody></table></div></div>}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {[{value:'activos',label:'Activos'},{value:'precierre',label:'Precierre'},{value:'cobrado',label:'Cobrados'},{value:'cancelado',label:'Cancelados'},{value:'todos',label:'Todos'}].map(f => (
          <button key={f.value} onClick={() => setFiltro(f.value)} className={cn('btn btn-sm', filtro===f.value?'btn-primary':'btn-secondary')}>{f.label}</button>
        ))}
      </div>
      <div className="space-y-3 md:hidden">{pedidos.map(p => { const r = p as any; return <button key={p.id} onClick={() => navigate(`/app/pedidos/${p.id}`)} className="card w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-surface-50">{r.mesa_numero ? `Mesa ${r.mesa_numero}` : 'Pedido sin mesa'}</p><p className="mt-1 text-xs text-surface-200/50">{r.mesero_nombre || 'Sin mesero'} - {formatDate(p.apertura_at,'HH:mm')}</p></div><span className={badge[p.estado]}>{lbl[p.estado] || (p.estado === 'precierre' ? 'Precierre' : p.estado)}</span></div>
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3"><span className="text-xs text-surface-200/50">#{p.numero || '-'}</span><span className="font-bold text-surface-50">{formatCurrency(p.total)}</span></div>
      </button>})}{pedidos.length === 0 && <div className="card py-12 text-center text-sm text-surface-200/40">No hay pedidos para este filtro</div>}</div>
      <div className="card hidden overflow-hidden md:block"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>#</th><th>Mesa</th><th>Estado</th><th>Mesero</th><th>Total</th><th>Hora</th><th>Tiempo</th></tr></thead>
        <tbody>
          {pedidos.map(p => { const r = p as any; return (
            <tr key={p.id} onClick={() => navigate(`/app/pedidos/${p.id}`)} className="cursor-pointer">
              <td className="font-mono text-xs text-surface-200/60">#{p.numero || '-'}</td>
              <td>{r.mesa_numero ? <span className="font-medium">Mesa {r.mesa_numero}</span> : <span className="text-surface-200/40">Sin mesa</span>}</td>
              <td><span className={badge[p.estado]}>{lbl[p.estado] || (p.estado === 'precierre' ? 'Precierre' : p.estado)}</span></td>
              <td className="text-surface-200/70">{r.mesero_nombre || r.usuario_nombre || '—'}</td>
              <td className="font-semibold text-surface-50">{formatCurrency(p.total)}</td>
              <td className="text-surface-200/50 text-xs">{formatDate(p.apertura_at,'HH:mm')}</td>
              <td className="text-surface-200/50 text-xs">{calcularTiempoTranscurrido(p.apertura_at)}</td>
            </tr>
          )})}
          {pedidos.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-surface-200/30">No hay pedidos para este filtro</td></tr>}
        </tbody>
      </table></div></div>
    </div>
  )
}
