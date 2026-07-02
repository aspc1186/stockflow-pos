import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Minus, Send, CreditCard, Clock, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/axios'
import type { Mesa, Producto, Pedido, Categoria } from '@/types'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

function tiempo(f?: string): string {
  if (!f) return ''
  const d = Math.floor((Date.now() - new Date(f).getTime()) / 60000)
  if (d < 60) return `${d}m`
  return `${Math.floor(d / 60)}h ${d % 60}m`
}

export default function MesaPedidoPage() {
  const { mesaId } = useParams<{ mesaId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [catActiva, setCatActiva] = useState<string | null>(null)
  const [carrito, setCarrito] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [verResumen, setVerResumen] = useState(true)

  const { data: mesa } = useQuery({
    queryKey: ['mesa', mesaId],
    queryFn: async () => { const { data } = await api.get<any>(`/mesas/${mesaId}`); return (data.data || data) as Mesa },
    refetchInterval: 15_000,
  })

  const { data: cats = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => { const { data } = await api.get<any>('/categorias'); return (data.data || data) as Categoria[] }
  })

  const { data: productos = [] } = useQuery({
    queryKey: ['prods-menu'],
    queryFn: async () => { const { data } = await api.get<any>('/productos?disponible=true'); return (data.data || data) as Producto[] }
  })

  const { data: pedidoActivo, refetch: refetchPedido } = useQuery({
    queryKey: ['pedido-activo', mesaId],
    queryFn: async () => {
      const { data } = await api.get<any>(`/pedidos?mesa_id=${mesaId}&estado=abierto,en_preparacion,listo`)
      const rows = data.data || data
      return Array.isArray(rows) ? rows[0] ?? null : null
    },
    refetchInterval: 15_000,
  })

  // Detalle completo del pedido activo (con items)
  const { data: pedidoDetalle } = useQuery({
    queryKey: ['pedido-detalle', (pedidoActivo as any)?.id],
    queryFn: async () => {
      const { data } = await api.get<any>(`/pedidos/${(pedidoActivo as any).id}`)
      return (data.data || data) as Pedido
    },
    enabled: !!(pedidoActivo as any)?.id,
    refetchInterval: 15_000,
  })

  const filtrados = catActiva ? productos.filter(p => p.categoria_id === catActiva) : productos
  const totalCarrito = Object.entries(carrito).reduce((sum, [id, q]) => {
    const p = productos.find(p => p.id === id)
    return sum + (p?.precio_venta ?? 0) * q
  }, 0)
  const totalItems = Object.values(carrito).reduce((a, b) => a + b, 0)
  const add = (id: string) => setCarrito(c => ({ ...c, [id]: (c[id] || 0) + 1 }))
  const rem = (id: string) => setCarrito(c => {
    const n = (c[id] || 0) - 1
    if (n <= 0) { const { [id]: _, ...r } = c; return r }
    return { ...c, [id]: n }
  })

  const enviar = async () => {
    if (!totalItems) return
    setLoading(true)
    try {
      const items = Object.entries(carrito).map(([pid, q]) => ({ producto_id: pid, cantidad: q }))
      if (pedidoActivo) {
        await api.post(`/pedidos/${(pedidoActivo as any).id}`, { items })
      } else {
        await api.post('/pedidos', { mesa_id: mesaId, tipo: 'mesa', items })
      }
      setCarrito({})
      qc.invalidateQueries({ queryKey: ['pedido-activo', mesaId] })
      qc.invalidateQueries({ queryKey: ['pedido-detalle', (pedidoActivo as any)?.id] })
      qc.invalidateQueries({ queryKey: ['mesa', mesaId] })
      refetchPedido()
      toast.success('✓ Pedido enviado')
    } catch { toast.error('Error al enviar') }
    finally { setLoading(false) }
  }

  const itemsPedido = pedidoDetalle?.items ?? []
  const totalAcumulado = pedidoDetalle?.total ?? (pedidoActivo as any)?.total ?? 0
  const t = tiempo(mesa?.apertura_at || (pedidoActivo as any)?.apertura_at)

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface-800 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/mesero')} className="p-1.5 rounded-lg hover:bg-white/5">
            <ArrowLeft className="w-5 h-5 text-white/60"/>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-white text-lg">Mesa {mesa?.numero}</p>
              {mesa?.nombre && <span className="text-white/40 text-sm">· {mesa.nombre}</span>}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {t && <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-white/30"/><span className="text-xs text-white/40">{t}</span></div>}
              {totalAcumulado > 0 && <span className="text-xs font-semibold text-brand-400">Total: {formatCurrency(totalAcumulado)}</span>}
            </div>
          </div>
          {pedidoActivo && (
            <button
              onClick={async () => {
                try {
                  await api.patch(`/pedidos/${(pedidoActivo as any).id}`, { estado: 'cobrado' })
                  toast.success('Cuenta solicitada')
                  navigate('/mesero')
                } catch { toast.error('Error') }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/20 text-orange-400 text-xs font-semibold border border-orange-500/20"
            >
              <CreditCard className="w-3.5 h-3.5"/>Cuenta
            </button>
          )}
        </div>
      </div>

      {/* Resumen pedido activo */}
      {itemsPedido.length > 0 && (
        <div className="bg-surface-800/50 border-b border-white/5">
          <button
            onClick={() => setVerResumen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-brand-400"/>
              <span className="text-sm font-semibold text-white">Pedido actual</span>
              <span className="text-xs bg-brand-600/30 text-brand-400 px-2 py-0.5 rounded-full">{itemsPedido.length} ítems</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-brand-400">{formatCurrency(totalAcumulado)}</span>
              {verResumen ? <ChevronUp className="w-4 h-4 text-white/30"/> : <ChevronDown className="w-4 h-4 text-white/30"/>}
            </div>
          </button>

          {verResumen && (
            <div className="px-4 pb-3 space-y-2">
              {itemsPedido.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-1.5 border-t border-white/5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-bold text-brand-400 w-5 text-center">{item.cantidad}×</span>
                    <span className="text-sm text-white truncate">{item.nombre || 'Producto'}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-white">{formatCurrency(item.subtotal)}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', {
                      'bg-yellow-500/20 text-yellow-400': item.estado === 'pendiente',
                      'bg-blue-500/20 text-blue-400': item.estado === 'preparando',
                      'bg-emerald-500/20 text-emerald-400': item.estado === 'listo',
                      'bg-white/10 text-white/40': item.estado === 'entregado',
                    })}>
                      {item.estado}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-sm text-white/50">Total acumulado</span>
                <span className="text-base font-black text-white">{formatCurrency(totalAcumulado)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtros categoría */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none border-b border-white/5 bg-surface-900 sticky top-[65px] z-10">
        <button
          onClick={() => setCatActiva(null)}
          className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
            catActiva === null ? 'bg-brand-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10')}
        >
          Todos ({productos.length})
        </button>
        {cats.map(c => (
          <button key={c.id} onClick={() => setCatActiva(c.id)}
            className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              catActiva === c.id ? 'bg-brand-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10')}>
            {c.icono} {c.nombre}
          </button>
        ))}
      </div>

      {/* Grid productos */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtrados.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/30 text-sm">Sin productos disponibles</p>
            <p className="text-white/20 text-xs mt-1">El administrador debe crear productos primero</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtrados.map(prod => {
              const q = carrito[prod.id] || 0
              return (
                <div key={prod.id}
                  className={cn('bg-surface-800 rounded-xl p-3 relative border transition-all',
                    q > 0 ? 'border-brand-500/60 bg-brand-900/20' : 'border-white/5')}>
                  {q > 0 && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center text-xs font-black text-white shadow-lg">
                      {q}
                    </div>
                  )}
                  <p className="text-sm font-semibold text-white mb-0.5 leading-tight">{prod.nombre}</p>
                  <p className="text-brand-400 font-bold text-sm mb-3">{formatCurrency(prod.precio_venta)}</p>

                  {q > 0 ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => rem(prod.id)}
                        className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95">
                        <Minus className="w-3.5 h-3.5 text-white"/>
                      </button>
                      <div className="flex-1 text-center">
                        <span className="text-base font-black text-white">{q}</span>
                        <p className="text-[10px] text-white/30">{formatCurrency(prod.precio_venta * q)}</p>
                      </div>
                      <button onClick={() => add(prod.id)}
                        className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center hover:bg-brand-500 active:scale-95">
                        <Plus className="w-3.5 h-3.5 text-white"/>
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => add(prod.id)}
                      className="w-full h-8 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center gap-1 hover:bg-brand-600/30 active:scale-95 text-xs font-semibold">
                      <Plus className="w-3.5 h-3.5"/> Agregar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Botón enviar carrito */}
      {totalItems > 0 && (
        <div className="sticky bottom-0 p-4 bg-surface-900/95 backdrop-blur border-t border-white/5">
          {/* Resumen del carrito actual */}
          <div className="mb-3 space-y-1">
            {Object.entries(carrito).map(([id, q]) => {
              const p = productos.find(p => p.id === id)
              if (!p) return null
              return (
                <div key={id} className="flex justify-between text-xs text-white/50">
                  <span>{q}× {p.nombre}</span>
                  <span>{formatCurrency(p.precio_venta * q)}</span>
                </div>
              )
            })}
            <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-white/10">
              <span>Nuevo pedido ({totalItems} ítems)</span>
              <span>{formatCurrency(totalCarrito)}</span>
            </div>
            {totalAcumulado > 0 && (
              <div className="flex justify-between text-sm text-brand-400 font-bold">
                <span>Total mesa</span>
                <span>{formatCurrency(totalAcumulado + totalCarrito)}</span>
              </div>
            )}
          </div>
          <button onClick={enviar} disabled={loading} className="btn-primary w-full py-3.5 text-base font-bold rounded-xl">
            {loading
              ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
              : <><Send className="w-5 h-5"/> Enviar a barra / cocina</>
            }
          </button>
        </div>
      )}
    </div>
  )
}
