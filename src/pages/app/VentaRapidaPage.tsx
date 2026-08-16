import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Minus, PackageSearch, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import Scanner from '@/components/scanner/Scanner'
import { formatCurrency } from '@/lib/utils'

type Producto = { id:string; nombre:string; codigo?:string; id_producto?:string; precio_venta:number|string; impuesto_pct?:number|string; disponible?:boolean; stock_actual?:number|string; imagen_url?:string }
type Linea = Producto & { cantidad:number; descuento_pct:number }

export default function VentaRapidaPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [lineas, setLineas] = useState<Linea[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [recibido, setRecibido] = useState('')
  const [notas, setNotas] = useState('')
  const { data: productosData = [] } = useQuery({ queryKey:['productos-venta-rapida'], queryFn: async () => { const r=await api.get('/productos'); const respuesta=r.data?.data ?? r.data; return Array.isArray(respuesta) ? respuesta : [] }, staleTime: 20_000 })
  const productos = useMemo(() => (Array.isArray(productosData) ? productosData : [])
    .filter((producto): producto is Producto => !!producto && typeof producto === 'object' && producto.id != null)
    .map(producto => ({
      ...producto,
      id: String(producto.id),
      nombre: String(producto.nombre ?? ''),
      codigo: String(producto.codigo ?? ''),
      id_producto: String(producto.id_producto ?? ''),
    })), [productosData])
  const candidatos = useMemo(() => productos.filter(p => p.disponible !== false && `${p.nombre || ''} ${p.codigo || ''} ${p.id_producto || ''}`.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 8), [productos,busqueda])
  const agregar = (codigoOId:string) => {
    const valor=String(codigoOId).trim()
    const producto=productos.find(p => p.id===valor || p.codigo===valor || p.id_producto===valor) || productos.find(p => p.nombre.toLowerCase()===valor.toLowerCase())
    if (!producto) return toast.error('Producto no encontrado')
    if (producto.disponible === false) return toast.error('Producto no disponible')
    setLineas(actual => {
      const existente=actual.find(l => l.id===producto.id)
      if (existente) return actual.map(l => l.id===producto.id ? { ...l, cantidad:l.cantidad+1 } : l)
      return [...actual,{...producto,cantidad:1,descuento_pct:0}]
    })
    setBusqueda('')
    toast.success(`${producto.nombre} agregado`)
  }
  const totales = useMemo(() => lineas.reduce((acu, l) => { const bruto=Number(l.precio_venta||0)*l.cantidad; const descuento=bruto*l.descuento_pct/100; const base=bruto-descuento; const impuesto=base*Number(l.impuesto_pct||0)/100; return {subtotal:acu.subtotal+bruto,descuentos:acu.descuentos+descuento,impuestos:acu.impuestos+impuesto,total:acu.total+base+impuesto} }, {subtotal:0,descuentos:0,impuestos:0,total:0}), [lineas])
  const cobrar = useMutation({ mutationFn: async () => { const r=await api.post('/ventas-rapidas',{items:lineas.map(l=>({producto_id:l.id,cantidad:l.cantidad,descuento_pct:l.descuento_pct})),metodo_pago:metodoPago,notas}); return r.data?.data }, onSuccess: data => { toast.success(`Venta registrada: ${formatCurrency(Number(data.total || 0))}`); setLineas([]); setRecibido(''); setNotas(''); qc.invalidateQueries({queryKey:['dashboard-stats']}); qc.invalidateQueries({queryKey:['inventario']}); qc.invalidateQueries({queryKey:['productos-venta-rapida']}) }, onError:(error:any)=>{ const msg=error?.response?.data?.msg || error?.response?.data?.error || (error?.response?.status===404||error?.response?.status===405 ? 'La version publicada aun no tiene el servicio de venta rapida. Actualiza el despliegue.' : '') || 'No se pudo registrar la venta'; toast.error(msg) } })
  const efectivo=Number(String(recibido).replace(/[^0-9.-]/g,''))||0
  const cambio=Math.max(0,efectivo-totales.total)
  const actualizar=(id:string,cantidad:number)=>setLineas(actual=>actual.flatMap(l=>l.id===id?(cantidad>0?[{...l,cantidad}]:[]):[l]))
  return <div className="mx-auto max-w-7xl space-y-5"><div className="page-header"><div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-pink-300">Venta de mostrador</p><h1 className="page-title">Venta rapida</h1><p className="page-subtitle">Escanea productos, cobra y actualiza caja e inventario en una sola operacion.</p></div><button className="btn-secondary" onClick={()=>navigate('/app/inicio')}>Volver</button></div><div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><main className="space-y-5"><section className="card p-4"><h2 className="mb-3 font-semibold">Escanear productos</h2><Scanner modo="barras" continuo sugerencias={productos} onDetectar={agregar}/><div className="mt-4 flex gap-2"><div className="relative flex-1"><PackageSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-200/50"/><input className="input pl-10" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre, codigo o SKU"/></div></div>{busqueda && <div className="mt-2 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">{candidatos.map(p=><button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5" key={p.id} onClick={()=>agregar(p.id)}><span><strong>{p.nombre}</strong><small className="ml-2 text-surface-200/55">{p.codigo || p.id_producto}</small></span><strong>{formatCurrency(Number(p.precio_venta||0))}</strong></button>)}</div>}</section><section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-white/10 p-4"><div><h2 className="font-semibold">Carrito de venta</h2><p className="text-sm text-surface-200/60">{lineas.length} productos · {lineas.reduce((n,l)=>n+l.cantidad,0)} unidades</p></div><ShoppingCart className="h-5 w-5 text-pink-300"/></div>{lineas.length===0?<p className="p-8 text-center text-surface-200/55">Escanea o busca un producto para iniciar la venta.</p>:<div className="divide-y divide-white/10">{lineas.map(l=>{const bruto=Number(l.precio_venta)*l.cantidad;const descuento=bruto*l.descuento_pct/100;const impuesto=(bruto-descuento)*Number(l.impuesto_pct||0)/100;return <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"><div className="min-w-0"><p className="truncate font-semibold">{l.nombre}</p><p className="text-xs text-surface-200/60">{l.codigo || l.id_producto || 'Sin codigo'} · {formatCurrency(Number(l.precio_venta))} · IVA {Number(l.impuesto_pct||0)}%</p></div><div className="flex items-center justify-self-start rounded-lg bg-surface-900/65"><button className="p-2" onClick={()=>actualizar(l.id,l.cantidad-1)}><Minus className="h-4 w-4"/></button><input aria-label={`Cantidad ${l.nombre}`} className="w-12 bg-transparent text-center font-semibold outline-none" value={l.cantidad} onChange={e=>actualizar(l.id,Math.max(0,Number(e.target.value)||0))}/><button className="p-2" onClick={()=>actualizar(l.id,l.cantidad+1)}><Plus className="h-4 w-4"/></button></div><label className="flex items-center gap-1 text-xs text-surface-200/70">Desc.<input className="input h-9 w-16 px-2 text-right" type="number" min="0" max="100" value={l.descuento_pct||''} onChange={e=>setLineas(a=>a.map(i=>i.id===l.id?{...i,descuento_pct:Math.max(0,Math.min(100,Number(e.target.value)||0))}:i))}/>%</label><div className="flex items-center gap-3"><strong>{formatCurrency(bruto-descuento+impuesto)}</strong><button className="text-red-300" onClick={()=>actualizar(l.id,0)}><Trash2 className="h-4 w-4"/></button></div></div>})}</div>}</section></main><aside className="card sticky top-4 overflow-hidden"><div className="border-b border-white/10 p-5"><h2 className="font-semibold">Resumen del cobro</h2></div><div className="space-y-3 p-5 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>{formatCurrency(totales.subtotal)}</strong></div><div className="flex justify-between text-emerald-300"><span>Descuentos</span><strong>-{formatCurrency(totales.descuentos)}</strong></div><div className="flex justify-between"><span>Impuestos</span><strong>{formatCurrency(totales.impuestos)}</strong></div><div className="flex justify-between border-t border-white/10 pt-4 text-lg"><span>Total a pagar</span><strong className="text-brand-200">{formatCurrency(totales.total)}</strong></div><label className="label">Metodo de pago<select className="input mt-1" value={metodoPago} onChange={e=>setMetodoPago(e.target.value)}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option><option value="mixto">Pago mixto</option></select></label>{metodoPago==='efectivo'&&<><label className="label">Recibido<input className="input mt-1" inputMode="numeric" value={recibido} onChange={e=>setRecibido(e.target.value)} placeholder="$ 0"/></label><div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-emerald-200">Cambio: <strong className="float-right">{formatCurrency(cambio)}</strong></div></>}<textarea className="input min-h-20" value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Observaciones opcionales"/><button className="btn-primary min-h-12 w-full text-base" disabled={!lineas.length||cobrar.isPending||(metodoPago==='efectivo'&&efectivo>0&&efectivo<totales.total)} onClick={()=>cobrar.mutate()}><CreditCard className="h-5 w-5"/>{cobrar.isPending?'Procesando...':`Cobrar ${formatCurrency(totales.total)}`}</button></div></aside></div></div>
}
