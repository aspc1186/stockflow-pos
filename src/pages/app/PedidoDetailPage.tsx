import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Minus, CreditCard, Check, X, ShoppingBag } from 'lucide-react'
import api from '@/lib/axios'
import type { Pedido, Producto } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

export default function PedidoDetailPage() {
  const { id } = useParams<{id:string}>(); const navigate = useNavigate(); const qc = useQueryClient()
  const [modalP, setModalP] = useState(false); const [modalC, setModalC] = useState(false); const [confirmCan, setConfirmCan] = useState(false)
  const [metodo, setMetodo] = useState('efectivo'); const [desc, setDesc] = useState('0'); const [prop, setProp] = useState('0')

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido', id],
    queryFn: async () => { const { data } = await api.get<any>(`/pedidos/${id}`); return (data.data || data) as Pedido },
  })
  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => { const { data } = await api.get<any>('/productos?disponible=true'); return (data.data || data) as Producto[] },
    enabled: modalP,
  })
  const actualizar = useMutation({
    mutationFn: (body: Record<string,unknown>) => api.patch(`/pedidos/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({queryKey:['pedido',id]}); qc.invalidateQueries({queryKey:['pedidos']}); qc.invalidateQueries({queryKey:['mesas']}) },
  })
  const agregarItems = useMutation({
    mutationFn: (items: {producto_id:string;cantidad:number}[]) => api.post(`/pedidos/${id}`, {items}),
    onSuccess: () => { qc.invalidateQueries({queryKey:['pedido',id]}); setModalP(false); toast.success('Agregado') },
    onError: () => toast.error('Error'),
  })
  const cobrar = async () => {
    try {
      const d = parseFloat(desc)||0; const p = parseFloat(prop)||0
      await actualizar.mutateAsync({estado:'cobrado', metodo_pago:metodo, descuento:d, propina:p})
      toast.success('Pedido cobrado'); setModalC(false); navigate('/app/pedidos')
    } catch { toast.error('Error al cobrar') }
  }

  if (isLoading) return <PageLoader />
  if (!pedido) return null
  const r = pedido as any; const activo = !['cobrado','cancelado'].includes(pedido.estado)

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-sm p-2"><ArrowLeft className="w-4 h-4"/></button>
        <div className="flex-1">
          <h1 className="page-title">Pedido #{pedido.numero || '-'}</h1>
          <p className="page-subtitle">{r.mesa_numero ? `Mesa ${r.mesa_numero} · ` : ''}{r.mesero_nombre || r.usuario_nombre || ''} · {formatDate(pedido.apertura_at,'HH:mm')}</p>
        </div>
        <span className={`badge ${pedido.estado==='abierto'?'badge-blue':pedido.estado==='listo'?'badge-green':pedido.estado==='cobrado'?'badge-gray':'badge-red'}`}>{pedido.estado.replace('_',' ')}</span>
      </div>
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold">Productos</h3>
          {activo && <button onClick={() => setModalP(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Agregar</button>}
        </div>
        <div className="divide-y divide-white/5">
          {pedido.items?.map(item => { const it = item as any; return (
            <div key={item.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-50">{it.nombre || item.producto_id}</p>
                {item.observaciones && <p className="text-xs text-surface-200/50 mt-0.5">{item.observaciones}</p>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-surface-200/60 w-5 text-right">{item.cantidad}×</span>
                <span className="font-semibold text-surface-50 w-24 text-right">{formatCurrency(item.subtotal)}</span>
              </div>
              <span className={`badge text-[10px] ${item.estado==='pendiente'?'badge-yellow':item.estado==='preparando'?'badge-blue':item.estado==='listo'?'badge-green':'badge-gray'}`}>{item.estado}</span>
            </div>
          )})}
          {(!pedido.items||pedido.items.length===0) && <div className="flex items-center justify-center h-20 text-sm text-surface-200/30">Sin productos</div>}
        </div>
        <div className="px-5 py-4 border-t border-white/5 space-y-2">
          <div className="flex justify-between text-sm text-surface-200/60"><span>Subtotal</span><span>{formatCurrency(pedido.subtotal)}</span></div>
          {pedido.impuestos>0 && <div className="flex justify-between text-sm text-surface-200/60"><span>Impuestos</span><span>{formatCurrency(pedido.impuestos)}</span></div>}
          {pedido.descuento>0 && <div className="flex justify-between text-sm text-emerald-400"><span>Descuento</span><span>-{formatCurrency(pedido.descuento)}</span></div>}
          <div className="flex justify-between text-base font-bold text-surface-50 pt-2 border-t border-white/5"><span>Total</span><span>{formatCurrency(pedido.total)}</span></div>
        </div>
      </div>
      {activo && <div className="flex gap-3">
        <button onClick={() => setConfirmCan(true)} className="btn-danger flex-1"><X className="w-4 h-4"/>Cancelar</button>
        <button onClick={() => setModalC(true)} className="btn-primary flex-1 py-3"><CreditCard className="w-5 h-5"/>Cobrar {formatCurrency(pedido.total)}</button>
      </div>}
      <Modal open={modalP} onClose={() => setModalP(false)} title="Agregar productos" size="lg">
        <ProductoSelector productos={productos} onAgregar={items => agregarItems.mutate(items)} loading={agregarItems.isPending}/>
      </Modal>
      <Modal open={modalC} onClose={() => setModalC(false)} title="Cobrar pedido" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setModalC(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={cobrar} className="btn-primary flex-1"><Check className="w-4 h-4"/>Confirmar</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Método de pago</label><select className="input" value={metodo} onChange={e => setMetodo(e.target.value)}>{['efectivo','tarjeta_credito','tarjeta_debito','transferencia','nequi','daviplata'].map(m => <option key={m} value={m} className="bg-surface-800 capitalize">{m.replace('_',' ')}</option>)}</select></div>
          <div><label className="label">Descuento</label><input type="number" min="0" className="input" value={desc} onChange={e => setDesc(e.target.value)}/></div>
          <div><label className="label">Propina</label><input type="number" min="0" className="input" value={prop} onChange={e => setProp(e.target.value)}/></div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="flex justify-between text-sm text-surface-200/60 mb-1"><span>Pedido</span><span>{formatCurrency(pedido.total)}</span></div>
            {parseFloat(desc)>0 && <div className="flex justify-between text-sm text-emerald-400 mb-1"><span>Descuento</span><span>-{formatCurrency(parseFloat(desc))}</span></div>}
            {parseFloat(prop)>0 && <div className="flex justify-between text-sm text-amber-400 mb-1"><span>Propina</span><span>+{formatCurrency(parseFloat(prop))}</span></div>}
            <div className="flex justify-between font-bold text-surface-50 mt-2 pt-2 border-t border-white/10"><span>Total</span><span>{formatCurrency(pedido.total-parseFloat(desc||'0')+parseFloat(prop||'0'))}</span></div>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmCan} onClose={() => setConfirmCan(false)}
        onConfirm={async () => { await actualizar.mutateAsync({estado:'cancelado'}); toast.success('Cancelado'); setConfirmCan(false); navigate('/app/pedidos') }}
        title="Cancelar pedido" message="¿Cancelar este pedido?" confirmLabel="Sí, cancelar" danger/>
    </div>
  )
}

function ProductoSelector({productos,onAgregar,loading}:{productos:Producto[];onAgregar:(items:{producto_id:string;cantidad:number}[])=>void;loading:boolean}) {
  const [carrito, setCarrito] = useState<Record<string,number>>({}); const [search, setSearch] = useState('')
  const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()))
  const add = (id: string) => setCarrito(c => ({...c,[id]:(c[id]||0)+1}))
  const rem = (id: string) => setCarrito(c => { const n=(c[id]||0)-1; if(n<=0){const{[id]:_,...r}=c;return r}; return{...c,[id]:n} })
  const total = Object.values(carrito).reduce((a,b) => a+b, 0)
  return (
    <div className="space-y-4">
      <input className="input" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}/>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {filtrados.map(p => { const q = carrito[p.id]||0; return (
          <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5">
            <div><p className="text-sm text-surface-50">{p.nombre}</p><p className="text-xs text-brand-400">{formatCurrency(p.precio_venta)}</p></div>
            <div className="flex items-center gap-2">
              {q>0 && <><button onClick={() => rem(p.id)} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center"><Minus className="w-3 h-3"/></button><span className="w-5 text-center text-sm font-semibold">{q}</span></>}
              <button onClick={() => add(p.id)} className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center"><Plus className="w-3 h-3"/></button>
            </div>
          </div>
        )})}
      </div>
      {total>0 && <button onClick={() => onAgregar(Object.entries(carrito).map(([pid,q]) => ({producto_id:pid,cantidad:q})))} disabled={loading} className="btn-primary w-full py-3">
        {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><ShoppingBag className="w-4 h-4"/>Agregar {total} ítem{total>1?'s':''}</>}
      </button>}
    </div>
  )
}
