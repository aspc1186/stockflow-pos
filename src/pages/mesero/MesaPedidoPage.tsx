import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Minus, Send, CreditCard } from 'lucide-react'
import api from '@/lib/axios'
import type { Mesa, Producto, Pedido, Categoria } from '@/types'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export default function MesaPedidoPage() {
  const { mesaId } = useParams<{mesaId:string}>(); const navigate = useNavigate(); const qc = useQueryClient()
  const [catActiva, setCatActiva] = useState<string|null>(null)
  const [carrito, setCarrito] = useState<Record<string,number>>({})
  const [loading, setLoading] = useState(false)

  const { data: mesa } = useQuery({ queryKey: ['mesa',mesaId], queryFn: async () => { const { data } = await api.get<any>(`/mesas/${mesaId}`); return (data.data||data) as Mesa } })
  const { data: cats = [] } = useQuery({ queryKey: ['categorias'], queryFn: async () => { const { data } = await api.get<any>('/categorias'); return (data.data||data) as Categoria[] } })
  const { data: productos = [] } = useQuery({ queryKey: ['prods-menu'], queryFn: async () => { const { data } = await api.get<any>('/productos?disponible=true'); return (data.data||data) as Producto[] } })
  const { data: pedidoActivo } = useQuery({ queryKey: ['pedido-activo',mesaId], queryFn: async () => { const { data } = await api.get<any>(`/pedidos?mesa_id=${mesaId}&estado=abierto,en_preparacion,listo`); const rows=(data.data||data); return Array.isArray(rows)?rows[0]??null:null } })

  const filtrados = catActiva ? productos.filter(p => p.categoria_id === catActiva) : productos
  const totalCarrito = Object.entries(carrito).reduce((sum,[id,q]) => { const p=productos.find(p=>p.id===id); return sum+(p?.precio_venta??0)*q }, 0)
  const totalItems = Object.values(carrito).reduce((a,b) => a+b, 0)
  const add = (id:string) => setCarrito(c => ({...c,[id]:(c[id]||0)+1}))
  const rem = (id:string) => setCarrito(c => { const n=(c[id]||0)-1; if(n<=0){const{[id]:_,...r}=c;return r}; return{...c,[id]:n} })

  const enviar = async () => {
    if (!totalItems) return; setLoading(true)
    try {
      const items = Object.entries(carrito).map(([pid,q]) => ({producto_id:pid,cantidad:q}))
      if (pedidoActivo) { await api.post(`/pedidos/${(pedidoActivo as any).id}`, {items}) }
      else { await api.post('/pedidos', {mesa_id:mesaId,tipo:'mesa',items}) }
      setCarrito({}); qc.invalidateQueries({queryKey:['pedido-activo',mesaId]}); qc.invalidateQueries({queryKey:['mesa',mesaId]})
      toast.success('Pedido enviado')
    } catch { toast.error('Error al enviar') } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col">
      <div className="sticky top-0 z-10 bg-surface-800/90 backdrop-blur border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/mesero')} className="p-1.5"><ArrowLeft className="w-5 h-5 text-surface-200/60"/></button>
          <div className="flex-1">
            <p className="font-semibold text-white">Mesa {mesa?.numero}{mesa?.nombre?` · ${mesa.nombre}`:''}</p>
            <p className="text-xs text-surface-200/50">{pedidoActivo?`Activo · ${formatCurrency((pedidoActivo as any).total)}`:'Sin pedido'}</p>
          </div>
          {pedidoActivo && <button onClick={async()=>{try{await api.patch(`/pedidos/${(pedidoActivo as any).id}`,{estado:'cobrado'});toast.success('Cuenta solicitada');navigate('/mesero')}catch{toast.error('Error')}}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-medium"><CreditCard className="w-3.5 h-3.5"/>Cuenta</button>}
        </div>
      </div>
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none border-b border-white/5">
        <button onClick={() => setCatActiva(null)} className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium',catActiva===null?'bg-brand-600 text-white':'bg-white/5 text-surface-200/60')}>Todos</button>
        {cats.map(c => <button key={c.id} onClick={() => setCatActiva(c.id)} className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium',catActiva===c.id?'bg-brand-600 text-white':'bg-white/5 text-surface-200/60')}>{c.icono} {c.nombre}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {filtrados.map(prod => { const q=carrito[prod.id]||0; return (
            <div key={prod.id} className={cn('card p-3 relative',q>0&&'border-brand-500/50')}>
              {q>0&&<div className="absolute -top-2 -right-2 w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center text-xs font-bold text-white">{q}</div>}
              <p className="text-sm font-medium text-surface-50 mb-1 leading-tight">{prod.nombre}</p>
              <p className="text-xs text-brand-400 font-semibold mb-3">{formatCurrency(prod.precio_venta)}</p>
              {q>0?<div className="flex items-center gap-2 w-full">
                <button onClick={() => rem(prod.id)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Minus className="w-3 h-3"/></button>
                <span className="flex-1 text-center text-sm font-bold">{q}</span>
                <button onClick={() => add(prod.id)} className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center"><Plus className="w-3 h-3"/></button>
              </div>:<button onClick={() => add(prod.id)} className="w-full h-8 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center"><Plus className="w-4 h-4"/></button>}
            </div>
          )})}
        </div>
      </div>
      {totalItems>0&&<div className="sticky bottom-0 p-4 bg-surface-900 border-t border-white/5">
        <button onClick={enviar} disabled={loading} className="btn-primary w-full py-4 text-base">
          {loading?<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<><Send className="w-5 h-5"/>Enviar {totalItems} ítem{totalItems>1?'s':''} · {formatCurrency(totalCarrito)}</>}
        </button>
      </div>}
    </div>
  )
}
