import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Camera, CheckCircle2, ClipboardCheck, FileUp, PackageCheck, Pause, Trash2, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/axios'
import Scanner from '@/components/scanner/Scanner'

type Linea = {
  producto_id:string; codigo:string; nombre:string; cantidad:number; stock:number; costo_unit:string
  controla_lote?:boolean; controla_vencimiento?:boolean; controla_serial?:boolean; lote?:string; vencimiento?:string; serial?:string
}

type LecturaProducto = { codigo:string; productoId?:string }

function interpretarQrProducto(lectura: string): LecturaProducto {
  const valor = String(lectura || '').trim()
  if (!valor.startsWith('SF1:')) return { codigo: valor }
  try {
    const ficha = JSON.parse(valor.slice(4))
    return { codigo: String(ficha?.codigo || '').trim(), productoId: String(ficha?.producto_id || '').trim() || undefined }
  } catch {
    return { codigo: valor }
  }
}

export default function ScannerPage({ modo }:{modo:'qr'|'barras'}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [lote, setLote] = useState<Linea[]>([])
  const [historialLote, setHistorialLote] = useState<string[]>([])
  const [tipo, setTipo] = useState<'entrada'|'salida'>(searchParams.get('tipo') === 'salida' ? 'salida' : 'entrada')
  const [notas, setNotas] = useState('')
  const [soporteUrl, setSoporteUrl] = useState('')
  const [pagarDesdeCaja, setPagarDesdeCaja] = useState(false)
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const soporteRef = useRef<HTMLInputElement>(null)
  const videoSoporteRef = useRef<HTMLVideoElement>(null)
  const streamSoporteRef = useRef<MediaStream | null>(null)
  const [camaraSoporteActiva, setCamaraSoporteActiva] = useState(false)
  const [ultimo, setUltimo] = useState('')
  const [conteoId, setConteoId] = useState('')
  const [tipoConteo, setTipoConteo] = useState<'general'|'ciclico'>('general')
  const [conteosFisicos, setConteosFisicos] = useState<Linea[]>([])

  const { data: productosData = [] } = useQuery({
    queryKey:['productos-escaner'],
    queryFn: async () => { const { data } = await api.get<any>('/productos'); return Array.isArray(data.data || data) ? data.data || data : [] },
  })
  const { data: conteosData = [], isLoading: cargandoConteos, isError: errorConteos, refetch: recargarConteos } = useQuery({
    queryKey:['conteos-inventario'], enabled: modo === 'qr', retry:1,
    queryFn: async () => { const { data } = await api.get<any>('/conteos'); return Array.isArray(data.data || data) ? data.data || data : [] },
  })
  const productos = useMemo(() => (Array.isArray(productosData) ? productosData : [])
    .filter((producto:any) => !!producto && typeof producto === 'object' && producto.id != null)
    .map((producto:any) => ({
      ...producto,
      id: String(producto.id),
      nombre: String(producto.nombre ?? ''),
      codigo: String(producto.codigo ?? ''),
      id_producto: String(producto.id_producto ?? ''),
    })), [productosData])
  const conteos:any[] = conteosData

  useEffect(() => {
    const nuevoTipo = searchParams.get('tipo')
    if (nuevoTipo === 'entrada' || nuevoTipo === 'salida') { setTipo(nuevoTipo); setLote([]); setHistorialLote([]) }
  }, [searchParams])
  useEffect(() => { if (tipo === 'salida') setPagarDesdeCaja(false) }, [tipo])
  const detenerCamaraSoporte = () => { streamSoporteRef.current?.getTracks().forEach(track=>track.stop()); streamSoporteRef.current=null; setCamaraSoporteActiva(false) }
  useEffect(() => () => detenerCamaraSoporte(), [])

  const agregarAlLote = (codigo:string, destino:'lote'|'conteo') => {
    const lectura = interpretarQrProducto(codigo)
    const producto = productos.find((p:any) => lectura.productoId === p.id)
      || productos.find((p:any) => String(p.codigo || '').trim().toLowerCase() === lectura.codigo.toLowerCase())
      || productos.find((p:any) => String(p.nombre || '').trim().toLowerCase() === lectura.codigo.trim().toLowerCase())
    if (!producto) return toast.error(`Producto no registrado: ${lectura.codigo || codigo}`)
    const setter = destino === 'lote' ? setLote : setConteosFisicos
    let agregado = false
    setter(actual => {
      const existe = actual.find(item => item.producto_id === producto.id)
      if (destino === 'lote' && tipo === 'salida' && Number(existe?.cantidad || 0) + 1 > Number(producto.stock_actual || 0)) {
        toast.error(`Stock insuficiente: ${producto.nombre}`)
        return actual
      }
      agregado = true
      return existe
        ? actual.map(item => item.producto_id === producto.id ? { ...item, cantidad:item.cantidad + 1 } : item)
        : [...actual, { producto_id:producto.id, codigo:String(producto.codigo || lectura.codigo), nombre:producto.nombre, cantidad:1, stock:Number(producto.stock_actual || 0), costo_unit:String(Number(producto.precio_costo || 0)), controla_lote:!!producto.controla_lote, controla_vencimiento:!!producto.controla_vencimiento, controla_serial:!!producto.controla_serial }]
    })
    if (destino === 'lote' && agregado) setHistorialLote(actual => [...actual, producto.id])
    setUltimo(producto.nombre)
  }

  const deshacerUltimaLectura = () => {
    const id = historialLote[historialLote.length - 1]
    if (!id) return
    setLote(actual => actual.flatMap(item => item.producto_id !== id ? [item] : item.cantidad > 1 ? [{ ...item, cantidad:item.cantidad - 1 }] : []))
    setHistorialLote(actual => actual.slice(0, -1))
  }
  const guardarLote = useMutation({
    mutationFn: () => api.post('/inventario', { items:lote, tipo, notas, soporte_url:soporteUrl, pagar_desde_caja:pagarDesdeCaja, metodo_pago:metodoPago }),
    onSuccess: () => { qc.invalidateQueries({queryKey:['inventario']}); qc.invalidateQueries({queryKey:['dashboard-stats']}); setLote([]); setHistorialLote([]); setNotas(''); setSoporteUrl(''); setPagarDesdeCaja(false); toast.success('Movimiento registrado y trazable') },
    onError: (e:any) => toast.error(e?.response?.data?.msg || 'No se pudo guardar el movimiento'),
  })
  const crearConteo = useMutation({
    mutationFn: () => api.post('/conteos', { accion:'crear', tipo:tipoConteo, iniciar:true }),
    onSuccess: (r:any) => {
      const nuevo = r.data?.data
      qc.setQueryData(['conteos-inventario'], (actual:any[] = []) => nuevo ? [nuevo, ...actual] : actual)
      qc.invalidateQueries({queryKey:['conteos-inventario']})
      if (nuevo?.estado === 'en_proceso') setConteoId(nuevo.id)
      toast.success(`${nuevo?.nombre || 'Conteo'} iniciado`)
    },
    onError:(e:any) => toast.error(e?.response?.data?.msg || 'No se pudo crear el conteo'),
  })
  const iniciar = useMutation({
    mutationFn: (id:string) => api.post('/conteos', { accion:'iniciar', conteo_id:id }),
    onSuccess: (_:any, id) => { qc.invalidateQueries({queryKey:['conteos-inventario']}); setConteoId(id); toast.success('Conteo iniciado') },
    onError: (e:any) => toast.error(e?.response?.data?.msg || 'No se pudo iniciar el conteo'),
  })
  const pausar = useMutation({
    mutationFn: (id:string) => api.post('/conteos', { accion:'pausar', conteo_id:id }),
    onSuccess: () => { qc.invalidateQueries({queryKey:['conteos-inventario']}); setConteoId(''); toast.success('Conteo pausado') },
  })
  const guardarConteo = useMutation({
    mutationFn: async () => { for (const item of conteosFisicos) await api.post('/conteos', { accion:'registrar', conteo_id:conteoId, producto_id:item.producto_id, cantidad:item.cantidad }) },
    onSuccess: () => { qc.invalidateQueries({queryKey:['conteos-inventario']}); setConteosFisicos([]); toast.success('Lecturas del conteo guardadas') },
    onError:(e:any) => toast.error(e?.response?.data?.msg || 'No se pudieron guardar las lecturas'),
  })
  const cerrar = useMutation({
    mutationFn: (id:string) => api.post('/conteos', { accion:'cerrar', conteo_id:id }),
    onSuccess: () => { qc.invalidateQueries({queryKey:['conteos-inventario']}); setConteoId(''); setConteosFisicos([]); toast.success('Conteo enviado a conciliacion. El stock no fue modificado.') },
    onError:(e:any) => toast.error(e?.response?.data?.msg || 'No se pudo finalizar el conteo'),
  })

  const resumen = useMemo(() => ({ referencias:lote.length, unidades:lote.reduce((s,item) => s + item.cantidad, 0) }), [lote])
  const activos = conteos.filter(item => item.estado === 'en_proceso')
  const pendientes = conteos.filter(item => ['borrador','programado'].includes(item.estado))
  const seleccionado = conteos.find(item => item.id === conteoId)

  const lista = (items:Linea[], setItems:React.Dispatch<React.SetStateAction<Linea[]>>, esConteo = false) => (
    <div className="card overflow-hidden">
      <div className="border-b border-white/10 p-4"><h2 className="font-semibold">Productos escaneados</h2><p className="mt-1 text-sm text-surface-200/60">{items.length} referencias · {items.reduce((s,item) => s + item.cantidad, 0)} unidades</p></div>
      {items.length === 0 ? <p className="p-8 text-center text-surface-200/45">El lector esta listo. Escanea productos consecutivamente.</p> : <div className="divide-y divide-white/10">
        {items.map(item => <div key={item.producto_id} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-44 flex-1"><p className="font-medium">{item.nombre}</p><p className="font-mono text-xs text-surface-200/50">{item.codigo}</p>{tipo === 'salida' && !esConteo && <p className="text-xs text-amber-200">Disponible: {item.stock} · Restante: {item.stock - item.cantidad}</p>}</div>
          <div className="flex items-center gap-2"><button className="btn-secondary h-9 w-9 p-0" onClick={() => setItems(actual => actual.map(linea => linea.producto_id === item.producto_id ? { ...linea, cantidad:Math.max(esConteo ? 0 : 1, linea.cantidad - 1) } : linea))}>-</button><input className="input h-9 w-20 text-center" type="number" min={esConteo ? 0 : 1} value={item.cantidad} onChange={event => setItems(actual => actual.map(linea => linea.producto_id === item.producto_id ? { ...linea, cantidad:Math.max(esConteo ? 0 : 1, Number(event.target.value) || 0) } : linea))}/><button className="btn-secondary h-9 w-9 p-0" onClick={() => setItems(actual => actual.map(linea => linea.producto_id === item.producto_id ? { ...linea, cantidad:linea.cantidad + 1 } : linea))}>+</button><button className="btn-ghost h-9 w-9 p-0 text-red-300" onClick={() => setItems(actual => actual.filter(linea => linea.producto_id !== item.producto_id))}><Trash2 className="h-4 w-4"/></button></div>
          {tipo === 'entrada' && !esConteo && <div className="grid w-full gap-2 border-t border-white/10 pt-3 sm:grid-cols-2 lg:grid-cols-4"><div><label className="label">Costo unitario</label><input className="input" inputMode="decimal" value={item.costo_unit || ''} onChange={e => setItems(actual => actual.map(linea => linea.producto_id === item.producto_id ? { ...linea, costo_unit:e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.') } : linea))} placeholder="Costo de compra"/></div>{item.controla_lote && <div><label className="label">Lote</label><input className="input" value={item.lote || ''} onChange={e => setItems(actual => actual.map(linea => linea.producto_id === item.producto_id ? { ...linea, lote:e.target.value } : linea))} placeholder="Lote requerido"/></div>}{item.controla_vencimiento && <div><label className="label">Fecha de vencimiento</label><input className="input" type="date" value={item.vencimiento || ''} onChange={e => setItems(actual => actual.map(linea => linea.producto_id === item.producto_id ? { ...linea, vencimiento:e.target.value } : linea))}/></div>} {item.controla_serial && <div><label className="label">Serial</label><input className="input" value={item.serial || ''} onChange={e => setItems(actual => actual.map(linea => linea.producto_id === item.producto_id ? { ...linea, serial:e.target.value } : linea))} placeholder="Serial requerido"/></div>}</div>}
          {tipo === 'entrada' && !esConteo && items[0]?.producto_id === item.producto_id && <div className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={pagarDesdeCaja} onChange={e => setPagarDesdeCaja(e.target.checked)}/>Pagar esta compra desde caja</label>{pagarDesdeCaja && <select className="input h-9 min-w-40" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta_credito">Tarjeta crédito</option><option value="tarjeta_debito">Tarjeta débito</option></select>}</div>}
        </div>)}
      </div>}
    </div>
  )

  const adjuntarSoporte = async (archivo?: File) => { if (!archivo) return; if (archivo.size > 1_500_000) return toast.error('El archivo debe pesar maximo 1.5 MB'); try { const contenido=await new Promise<string>((resolve,reject)=>{const lector=new FileReader();lector.onload=()=>resolve(String(lector.result));lector.onerror=()=>reject();lector.readAsDataURL(archivo)}); setSoporteUrl(contenido); toast.success('Factura o soporte adjunto') } catch { toast.error('No se pudo leer el archivo') } }
  const abrirCamaraSoporte = async () => { try { detenerCamaraSoporte(); const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}); streamSoporteRef.current=stream; setCamaraSoporteActiva(true); window.setTimeout(async()=>{if(videoSoporteRef.current){videoSoporteRef.current.srcObject=stream;await videoSoporteRef.current.play()}},0) } catch { toast.error('No fue posible abrir la camara. Revisa el permiso de camara.') } }
  const capturarSoporte = () => { const video=videoSoporteRef.current; if(!video?.videoWidth) return toast.error('La camara aun no esta lista'); const canvas=document.createElement('canvas'); canvas.width=video.videoWidth; canvas.height=video.videoHeight; canvas.getContext('2d')?.drawImage(video,0,0); const soporte=canvas.toDataURL('image/jpeg',0.82); if(soporte.length>1_500_000*1.37) return toast.error('La foto es demasiado pesada; acercate al documento e intenta de nuevo'); setSoporteUrl(soporte); detenerCamaraSoporte(); toast.success('Foto de soporte capturada') }

  const sugerenciasProductos = useMemo(() => productos.map((producto:any) => ({
    id: String(producto.id),
    nombre: String(producto.nombre || ''),
    codigo: String(producto.codigo || ''),
    id_producto: String(producto.id_producto || ''),
    precio_venta: producto.precio_venta,
  })), [productos])

  if (modo === 'barras' && typeof window !== 'undefined') {
    const esEntrada = tipo === 'entrada'
    const valorEstimado = lote.reduce((total, item) => total + item.cantidad * Number(item.costo_unit || 0), 0)
    const limpiar = () => { setLote([]); setHistorialLote([]); setNotas(''); setSoporteUrl(''); detenerCamaraSoporte(); setUltimo('') }
    return <div className="mx-auto max-w-7xl space-y-5"><div className="page-header"><div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-300">{esEntrada ? 'Entrada de inventario' : 'Salida de inventario'}</p><h1 className="page-title">{esEntrada ? 'Registrar mercancía' : 'Registrar venta'}</h1><p className="page-subtitle">Escanea los productos consecutivamente; cada lectura suma una unidad a la lista.</p></div><button type="button" className="btn-secondary" onClick={() => navigate('/app')} >Cancelar</button></div><div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-5"><section className="card overflow-hidden"><div className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold">1. Escanear productos</h2><p className="mt-1 text-sm text-surface-200/60">Usa la cámara, un lector de barras o escribe el código.</p></div><div className="p-4"><Scanner modo="barras" continuo sugerencias={sugerenciasProductos} onDetectar={codigo => agregarAlLote(codigo, 'lote')}/>{ultimo && <p className="mt-3 text-sm text-emerald-300">Último producto: {ultimo}</p>}</div></section>{lista(lote, setLote)}<section className="card space-y-4 p-5"><div><h2 className="font-semibold">2. Información del {esEntrada ? 'movimiento' : 'registro de venta'}</h2><p className="mt-1 text-sm text-surface-200/60">{esEntrada ? 'Adjunta la factura o soporte de compra cuando esté disponible.' : 'La salida descuenta existencias. El cobro comercial por mesa se realiza desde Pedidos.'}</p></div><input className="input" value={notas} onChange={e => setNotas(e.target.value)} placeholder={esEntrada ? 'Observaciones, proveedor o número de factura (opcional)' : 'Observaciones de la venta (opcional)'}/>{esEntrada&&<div><input ref={soporteRef} className="hidden" type="file" accept="image/*,application/pdf" onChange={event=>adjuntarSoporte(event.target.files?.[0])}/>{camaraSoporteActiva&&<div className="mb-3 overflow-hidden rounded-lg border border-brand-400/30 bg-black"><video ref={videoSoporteRef} autoPlay playsInline muted className="h-52 w-full object-cover"/></div>}<div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary min-h-10" onClick={camaraSoporteActiva?capturarSoporte:abrirCamaraSoporte}><Camera className="h-4 w-4"/>{camaraSoporteActiva?'Capturar foto':'Tomar foto'}</button>{camaraSoporteActiva&&<button type="button" className="btn-secondary min-h-10" onClick={detenerCamaraSoporte}>Cancelar cámara</button>}<button type="button" className="btn-secondary min-h-10" onClick={()=>soporteRef.current?.click()}><FileUp className="h-4 w-4"/>{soporteUrl?'Soporte adjunto':'Adjuntar factura o soporte'}</button></div><p className="mt-1 text-xs text-surface-200/50">Foto, imagen o PDF, máximo 1.5 MB.</p></div>}<div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-4"><div className="flex gap-2"><button className="btn-secondary" disabled={!historialLote.length} onClick={deshacerUltimaLectura}><Undo2 className="h-4 w-4"/>Deshacer última lectura</button><button className="btn-secondary" disabled={!lote.length} onClick={limpiar}>Limpiar todo</button></div><button className="btn-primary" disabled={!lote.length || guardarLote.isPending} onClick={() => { if (window.confirm(`Confirmar ${esEntrada ? 'entrada' : 'salida'}: ${resumen.referencias} referencias y ${resumen.unidades} unidades`)) guardarLote.mutate() }}><PackageCheck className="h-4 w-4"/>{guardarLote.isPending ? 'Guardando...' : esEntrada ? 'Guardar movimiento' : 'Guardar venta'}</button></div></section></div><aside className="card sticky top-4 overflow-hidden"><div className="border-b border-white/10 p-5"><h2 className="font-semibold">Resumen de {esEntrada ? 'entrada' : 'venta'}</h2></div><div className="space-y-4 p-5"><div className="flex justify-between text-sm"><span className="text-surface-200/65">Productos</span><strong>{resumen.referencias}</strong></div><div className="flex justify-between text-sm"><span className="text-surface-200/65">Unidades</span><strong>{resumen.unidades}</strong></div><div className="border-t border-white/10 pt-4"><p className="text-sm text-surface-200/65">Valor al costo estimado</p><p className="mt-1 text-2xl font-bold text-brand-200">${valorEstimado.toLocaleString('es-CO')}</p></div>{esEntrada && <p className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-3 text-xs text-sky-100/85">El soporte adjunto quedará asociado a todos los productos de este movimiento.</p>}{!esEntrada && <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100/85">Esta salida es operativa. Para registrar pago, impuestos y comprobante usa Pedidos.</p>}</div></aside></div></div>
  }

  if (modo === 'barras') return <div className="mx-auto max-w-4xl space-y-5"><div className="page-header"><div><h1 className="page-title">{tipo === 'entrada' ? 'Entrada de mercancia' : 'Salida de inventario'}</h1><p className="page-subtitle">Escanea todos los productos y confirma una sola vez. Esta salida es operativa; las ventas comerciales se registran desde Pedidos.</p></div><select className="input w-56" value={tipo} onChange={e => setTipo(e.target.value as any)}><option value="entrada">Entrada de mercancia</option><option value="salida">Salida de inventario</option></select></div><div className="card p-4"><Scanner modo="barras" continuo onDetectar={codigo => agregarAlLote(codigo, 'lote')}/>{ultimo && <p className="mt-3 text-sm text-emerald-300">Ultimo producto: {ultimo}</p>}</div>{lista(lote, setLote)}<div className="card space-y-3 p-4"><input className="input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas del movimiento (opcional)"/>{tipo==='entrada'&&<div><input ref={soporteRef} className="hidden" type="file" accept="image/*,application/pdf" onChange={event=>adjuntarSoporte(event.target.files?.[0])}/>{camaraSoporteActiva&&<div className="mb-3 overflow-hidden rounded-lg border border-brand-400/30 bg-black"><video ref={videoSoporteRef} autoPlay playsInline muted className="h-52 w-full object-cover"/></div>}<div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary min-h-10" onClick={camaraSoporteActiva?capturarSoporte:abrirCamaraSoporte}><Camera className="h-4 w-4"/>{camaraSoporteActiva?'Capturar foto':'Tomar foto'}</button>{camaraSoporteActiva&&<button type="button" className="btn-secondary min-h-10" onClick={detenerCamaraSoporte}>Cancelar camara</button>}<button type="button" className="btn-secondary min-h-10" onClick={()=>soporteRef.current?.click()}><FileUp className="h-4 w-4"/>{soporteUrl?'Factura adjunta':'Adjuntar documento'}</button></div><p className="mt-1 text-xs text-surface-200/50">Foto, imagen o PDF, maximo 1.5 MB.</p></div>}<div className="flex flex-wrap justify-between gap-3"><button className="btn-secondary" disabled={!historialLote.length} onClick={deshacerUltimaLectura}><Undo2 className="h-4 w-4"/>Deshacer ultima lectura</button><button className="btn-primary" disabled={!lote.length || guardarLote.isPending} onClick={() => { if (window.confirm(`Confirmar ${tipo}: ${resumen.referencias} referencias y ${resumen.unidades} unidades`)) guardarLote.mutate() }}><PackageCheck className="h-4 w-4"/>{guardarLote.isPending ? 'Guardando...' : `Guardar ${tipo}`}</button></div></div></div>

  return <div className="mx-auto max-w-4xl space-y-5"><div className="page-header"><div><h1 className="page-title">Conteos de inventario</h1><p className="page-subtitle">El sistema captura el conteo, luego compara y solo ajusta con aprobacion.</p></div></div><div className="card grid gap-3 p-4 md:grid-cols-3"><div className="rounded-lg border border-brand-400/20 bg-brand-500/5 px-3 py-2 text-sm text-surface-200/70">Nombre automatico: <strong className="text-surface-50">{tipoConteo === 'general' ? 'INV-GEN' : 'INV-CC'}-###</strong></div><select className="input" value={tipoConteo} onChange={e => setTipoConteo(e.target.value as any)}><option value="general">Inventario general</option><option value="ciclico">Inventario ciclico</option></select><div className="rounded-lg border border-white/10 px-3 py-2 text-sm text-surface-200/70">Fecha automatica: <strong className="text-surface-50">{new Date().toLocaleDateString('es-CO')}</strong></div><button className="btn-primary md:col-span-3" disabled={crearConteo.isPending} onClick={() => crearConteo.mutate()}><ClipboardCheck className="h-4 w-4"/>Crear e iniciar conteo</button></div>{errorConteos ? <div className="card flex items-center justify-between gap-4 p-5"><p className="text-red-200">No se pudieron cargar los conteos.</p><button className="btn-secondary" onClick={() => recargarConteos()}>Reintentar</button></div> : <div className="card p-4"><label className="label">Conteo en proceso</label><div className="flex flex-wrap gap-2"><select disabled={cargandoConteos} className="input min-w-56 flex-1" value={conteoId} onChange={e => setConteoId(e.target.value)}><option value="">Selecciona un conteo</option>{activos.map(item => <option key={item.id} value={item.id}>{item.nombre} · {item.productos_contados} referencias</option>)}</select>{pendientes.map(item => <button key={item.id} className="btn-secondary" onClick={() => iniciar.mutate(item.id)}><CalendarClock className="h-4 w-4"/>Iniciar {item.nombre}</button>)}</div>{conteos.some(item => item.estado === 'pendiente_conciliacion') && <button className="mt-3 text-sm text-brand-200 underline" onClick={() => navigate('/app/inventario?tab=conciliacion')}>Ver conciliaciones pendientes</button>}</div>}{seleccionado && <><div className="card p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-semibold">{seleccionado.nombre}</p><p className="text-sm text-surface-200/60">Estado: {seleccionado.estado.replace('_', ' ')}</p></div><span className="badge-blue">{seleccionado.tipo}</span></div><Scanner modo="qr" continuo onDetectar={codigo => agregarAlLote(codigo, 'conteo')}/></div>{lista(conteosFisicos, setConteosFisicos, true)}<div className="flex flex-wrap justify-end gap-3"><button className="btn-secondary" disabled={!conteosFisicos.length || guardarConteo.isPending} onClick={() => guardarConteo.mutate()}><CheckCircle2 className="h-4 w-4"/>Guardar lecturas</button><button className="btn-secondary" onClick={() => pausar.mutate(seleccionado.id)}><Pause className="h-4 w-4"/>Pausar</button><button className="btn-danger" disabled={cerrar.isPending} onClick={() => { if (window.confirm('Finalizar el conteo lo enviara a conciliacion. El stock no se modificara hasta su aprobacion.')) cerrar.mutate(seleccionado.id) }}>Finalizar conteo</button></div></>}{!seleccionado && !errorConteos && <p className="card p-8 text-center text-surface-200/55">Crea o inicia un conteo para habilitar el lector QR.</p>}</div>
}
