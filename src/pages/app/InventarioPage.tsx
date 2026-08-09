import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Camera, CheckCircle2, Download, FileUp, Pencil, Plus, ScanLine } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '@/lib/axios'
import Modal from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { cn, formatCurrency } from '@/lib/utils'

export default function InventarioPage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conteoConciliacion, setConteoConciliacion] = useState('')
  const [filtroConciliacion, setFiltroConciliacion] = useState<'todos'|'correcto'|'faltante'|'sobrante'>('todos')
  const [critico, setCritico] = useState(false)
  const [search, setSearch] = useState('')
  const [searchApi, setSearchApi] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({producto_id:'',tipo:'entrada',cantidad:'',costo_unit:'',notas:'',soporte_url:'',pagar_desde_caja:false,metodo_pago:'efectivo'})
  const [codigo, setCodigo] = useState('')
  const [registroContinuo, setRegistroContinuo] = useState(true)
  const [productoBloqueado, setProductoBloqueado] = useState(false)
  const lectorRef = useRef<HTMLInputElement>(null)
  const soporteRef = useRef<HTMLInputElement>(null)
  const videoSoporteRef = useRef<HTMLVideoElement>(null)
  const streamSoporteRef = useRef<MediaStream | null>(null)
  const [camaraSoporteActiva, setCamaraSoporteActiva] = useState(false)
  const [cargandoSoporte, setCargandoSoporte] = useState(false)
  const detenerCamaraSoporte = () => {
    streamSoporteRef.current?.getTracks().forEach(track => track.stop())
    streamSoporteRef.current = null
    setCamaraSoporteActiva(false)
  }
  useEffect(() => () => detenerCamaraSoporte(), [])
  useEffect(() => {
    const espera = window.setTimeout(() => setSearchApi(search.trim()), 300)
    return () => window.clearTimeout(espera)
  }, [search])
  const { data: inventarioData, isLoading } = useQuery({
    queryKey: ['inventario',critico,searchApi],
    queryFn: async () => { const p = new URLSearchParams(); if(critico)p.set('critico','true'); if(searchApi)p.set('search',searchApi); const { data } = await api.get<any>(`/inventario?${p}`); return (data.data || data) as any[] },
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  })
  const { data: productos = [] } = useQuery({ queryKey: ['prods-inv'], queryFn: async () => { const { data } = await api.get<any>('/productos'); return (data.data||data) as any[] }, enabled: modal })
  const { data: conteos = [] } = useQuery({ queryKey:['conteos-inventario'], queryFn:async()=>{ const {data}=await api.get<any>('/conteos'); return (data.data||data) as any[] } })
  const { data: conciliacionData, isLoading: cargandoConciliacion } = useQuery({ queryKey:['conciliacion-inventario',conteoConciliacion], enabled:!!conteoConciliacion, queryFn:async()=>{ const {data}=await api.get<any>(`/conteos?conteo_id=${conteoConciliacion}`); return data.data || data } })
  const aprobarConciliacion = useMutation({ mutationFn:(id:string)=>api.post('/conteos',{accion:'aprobar_ajustes',conteo_id:id}), onSuccess:(respuesta:any)=>{ qc.invalidateQueries({queryKey:['conteos-inventario']}); qc.invalidateQueries({queryKey:['conciliacion-inventario']}); qc.invalidateQueries({queryKey:['inventario']}); toast.success(`${respuesta.data?.data?.ajustes || 0} ajustes aprobados y registrados`) }, onError:(e:any)=>toast.error(e?.response?.data?.msg || 'No se pudieron aprobar los ajustes') })
  const ajustar = useMutation({
    mutationFn: () => api.post('/inventario', {...form,cantidad:parseFloat(form.cantidad)||0,costo_unit:form.costo_unit?parseFloat(form.costo_unit):undefined}),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({queryKey:['inventario']}), qc.invalidateQueries({queryKey:['caja']}), qc.invalidateQueries({queryKey:['dashboard-stats']})])
      setCodigo('')
      if (registroContinuo) {
        setProductoBloqueado(false)
        setForm({producto_id:'',tipo:'entrada',cantidad:'',costo_unit:'',notas:'',soporte_url:'',pagar_desde_caja:false,metodo_pago:'efectivo'})
        window.setTimeout(() => lectorRef.current?.focus(), 0)
      } else setModal(false)
      toast.success('Movimiento registrado y saldo actualizado')
    },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'Error'),
  })
  const descargarMovimientos = async () => {
    try {
      const { data } = await api.get<any>('/inventario?movimientos=true')
      const filas = (data.data || data) as any[]
      const escapar = (valor: unknown) => `"${String(valor ?? '').replace(/"/g, '""')}"`
      const contenido = [['Fecha','Producto','Tipo','Cantidad','Stock antes','Stock despues','Usuario','Notas','Soporte'], ...filas.map(fila => [new Date(fila.created_at).toLocaleString('es-CO'),fila.producto,fila.tipo,fila.cantidad,fila.stock_antes,fila.stock_despues,fila.usuario,fila.notas,fila.soporte_url ? 'Adjunto' : ''])].map(fila => fila.map(escapar).join(';')).join('\n')
      const url = URL.createObjectURL(new Blob([`\uFEFF${contenido}`], {type:'text/csv;charset=utf-8'})); const enlace=document.createElement('a'); enlace.href=url; enlace.download='movimientos_inventario.csv'; enlace.click(); URL.revokeObjectURL(url)
    } catch { toast.error('No se pudieron descargar los movimientos') }
  }
  if (isLoading) return <PageLoader />
  const inv = inventarioData || []
  const valorTotal = inv.reduce((s:any, item:any) => s + Number(item.valor_costo || 0), 0)
  const verConciliacion = searchParams.get('tab') === 'conciliacion'
  const conteosConciliables = (conteos as any[]).filter(item => ['pendiente_conciliacion','reconteo','ajustado'].includes(item.estado))
  const resumenConciliacion = conciliacionData?.resumen
  const lineasConciliacion = ((conciliacionData?.items || []) as any[]).filter(item => {
    if (!item.contado) return false
    const diferencia=Number(item.diferencia||0)
    return filtroConciliacion==='todos' || (filtroConciliacion==='correcto'&&diferencia===0) || (filtroConciliacion==='faltante'&&diferencia<0) || (filtroConciliacion==='sobrante'&&diferencia>0)
  })
  const abrirCorreccion = (item:any) => {
    setForm({ producto_id:item.producto_id, tipo:'ajuste', cantidad:String(Number(item.stock_actual || 0)), costo_unit:String(Number(item.precio_costo || 0)), notas:'Correccion de inventario', soporte_url:'', pagar_desde_caja:false, metodo_pago:'efectivo' })
    setCodigo(String(item.codigo || ''))
    setProductoBloqueado(true)
    setModal(true)
  }
  const abrirMovimiento = () => {
    setCodigo('')
    setProductoBloqueado(false)
    setForm({producto_id:'',tipo:'entrada',cantidad:'',costo_unit:'',notas:'',soporte_url:'',pagar_desde_caja:false,metodo_pago:'efectivo'})
    setModal(true)
    window.setTimeout(() => lectorRef.current?.focus(), 0)
  }
  const seleccionarPorCodigo = () => {
    const valor = codigo.trim().toLowerCase()
    if (!valor) return toast.error('Lee o escribe un codigo de barras')
    const producto = productos.find((item:any) => String(item.codigo || '').trim().toLowerCase() === valor)
    if (!producto) return toast.error('No existe un producto activo con este codigo')
    if (productoBloqueado && form.producto_id && form.producto_id !== producto.id) return toast.error('Desbloquea el producto actual para escanear otro')
    setForm(actual => ({ ...actual, producto_id: producto.id, costo_unit: String(Number(producto.precio_costo || 0)) }))
    toast.success(`${producto.nombre} seleccionado`)
  }
  const productoSeleccionado = productos.find((producto:any) => producto.id === form.producto_id) as any
  const adjuntarSoporte = async (archivo?: File) => {
    if (!archivo) return
    if (archivo.size > 1_500_000) return toast.error('El archivo debe pesar maximo 1.5 MB')
    setCargandoSoporte(true)
    try {
      const soporte_url = await new Promise<string>((resolve, reject) => { const lector = new FileReader(); lector.onload=()=>resolve(String(lector.result)); lector.onerror=()=>reject(new Error('No se pudo leer el archivo')); lector.readAsDataURL(archivo) })
      setForm(actual => ({ ...actual, soporte_url }))
      toast.success('Factura o soporte adjunto')
    } catch { toast.error('No se pudo adjuntar el archivo') } finally { setCargandoSoporte(false) }
  }
  const abrirCamaraSoporte = async () => {
    try {
      detenerCamaraSoporte()
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamSoporteRef.current = stream
      setCamaraSoporteActiva(true)
      window.setTimeout(async () => {
        if (videoSoporteRef.current) {
          videoSoporteRef.current.srcObject = stream
          await videoSoporteRef.current.play()
        }
      }, 0)
    } catch { toast.error('No fue posible abrir la camara. Revisa el permiso de camara.') }
  }
  const capturarSoporte = () => {
    const video = videoSoporteRef.current
    if (!video?.videoWidth) return toast.error('La camara aun no esta lista')
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const soporte_url = canvas.toDataURL('image/jpeg', 0.82)
    if (soporte_url.length > 1_500_000 * 1.37) return toast.error('La foto es demasiado pesada; acercate al documento e intenta de nuevo')
    setForm(actual => ({ ...actual, soporte_url }))
    detenerCamaraSoporte()
    toast.success('Foto de soporte capturada')
  }
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Inventario</h1><p className="page-subtitle">Valor total a costo: {formatCurrency(valorTotal)} - Saldo actual despues de ventas y salidas</p></div>
        <div className="flex gap-2"><button onClick={()=>setSearchParams(verConciliacion ? {} : {tab:'conciliacion'})} className={verConciliacion?'btn-primary btn-sm':'btn-secondary btn-sm'}>Conciliacion</button><button onClick={descargarMovimientos} className="btn-secondary btn-sm"><Download className="w-4 h-4"/>Movimientos</button><button onClick={abrirMovimiento} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Movimiento</button></div>
      </div>
      {verConciliacion && <div className="space-y-4">
        <div className="card grid gap-3 p-4 md:grid-cols-[1fr_auto]"><div><label className="label">Conteo para conciliar</label><select className="input" value={conteoConciliacion} onChange={e=>setConteoConciliacion(e.target.value)}><option value="">Selecciona un conteo cerrado</option>{conteosConciliables.map((item:any)=><option key={item.id} value={item.id}>{item.nombre} · {item.estado.replace('_',' ')}</option>)}</select></div>{conteoConciliacion&&<div className="flex items-end"><button className="btn-secondary" onClick={()=>setConteoConciliacion('')}>Limpiar</button></div>}</div>
        {!conteoConciliacion ? <div className="card p-10 text-center text-surface-200/55">No hay una conciliacion seleccionada. Finaliza primero un conteo de inventario.</div> : cargandoConciliacion ? <div className="card p-10 text-center text-surface-200/55">Cargando conciliacion...</div> : <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[['Exactitud por referencias',resumenConciliacion?.exactitud == null ? '-' : `${resumenConciliacion.exactitud}%`],['Referencias contadas',resumenConciliacion?.referencias||0],['Correctas',resumenConciliacion?.correctos||0],['Faltantes',resumenConciliacion?.faltantes||0],['Sobrantes',resumenConciliacion?.sobrantes||0]].map(([titulo,valor])=><div className="card p-4" key={String(titulo)}><p className="text-xs text-surface-200/55">{titulo}</p><p className="mt-1 text-xl font-bold">{valor}</p></div>)}</div>
          <div className="flex flex-wrap gap-2">{([['todos','Todos'],['correcto','Sin diferencia'],['faltante','Faltantes'],['sobrante','Sobrantes']] as const).map(([id,label])=><button key={id} className={filtroConciliacion===id?'btn-primary btn-sm':'btn-secondary btn-sm'} onClick={()=>setFiltroConciliacion(id)}>{label}</button>)}</div>
          <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base"><thead><tr><th>SKU</th><th>Producto</th><th>Sistema</th><th>Fisico</th><th>Diferencia</th><th>Estado</th><th>Contado por</th></tr></thead><tbody>{lineasConciliacion.map((item:any)=>{const diferencia=Number(item.diferencia||0); const estado=diferencia===0?'Correcto':diferencia<0?'Faltante':'Sobrante'; return <tr key={item.id}><td className="font-mono text-xs">{item.codigo||'-'}</td><td>{item.nombre}</td><td>{Number(item.stock_sistema||0).toFixed(3)}</td><td>{Number(item.cantidad_contada||0).toFixed(3)}</td><td className={diferencia===0?'text-emerald-300':diferencia<0?'text-red-300':'text-amber-300'}>{diferencia>0?'+':''}{diferencia.toFixed(3)}</td><td><span className={diferencia===0?'badge-green':diferencia<0?'badge-red':'badge-yellow'}>{estado}</span></td><td>{item.contado_por||'-'}</td></tr>})}{lineasConciliacion.length===0&&<tr><td colSpan={7} className="py-10 text-center text-surface-200/45">No hay referencias contadas para este filtro.</td></tr>}</tbody></table></div></div>
          {conciliacionData?.conteo?.estado==='pendiente_conciliacion'&&<div className="flex justify-end"><button className="btn-primary" disabled={aprobarConciliacion.isPending} onClick={()=>{if(window.confirm('Aprobar aplicara solo las diferencias contadas y generara movimientos de ajuste trazables.'))aprobarConciliacion.mutate(conciliacionData.conteo.id)}}><CheckCircle2 className="h-4 w-4"/>{aprobarConciliacion.isPending?'Aprobando...':'Aprobar diferencias y ajustar'}</button></div>}
        </>}
      </div>}
      {!verConciliacion && <>
      <div className="flex gap-3">
        <input className="input max-w-xs" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}/>
        <button onClick={() => setCritico(v => !v)} className={cn('btn btn-sm',critico?'btn-primary':'btn-secondary')}><AlertTriangle className="w-4 h-4"/>Solo criticos</button>
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Producto</th><th>Saldo actual</th><th>Entradas hoy</th><th>Salidas hoy</th><th>Minimo</th><th>Costo unit.</th><th>Valor costo</th><th>Venta</th><th>Margen</th><th>Ult. salida</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {inv.map((item:any) => { const c = Number(item.stock_actual)<=Number(item.stock_minimo)&&Number(item.stock_minimo)>0; return (
            <tr key={item.producto_id}>
              <td><p className="font-medium text-surface-50">{item.producto_nombre}</p><p className="text-xs text-surface-200/55">ID: {item.id_producto || 'Pendiente'} · Código: {item.codigo || 'Sin código'}</p><p className="text-xs text-surface-200/40">Categoría: {item.categoria_nombre || 'General'}</p></td>
              <td className={cn('font-bold',c?'text-red-400':'text-surface-50')}>{Number(item.stock_actual).toFixed(1)}</td>
              <td className="font-semibold text-emerald-400">+{Number(item.entradas_hoy || 0).toFixed(1)}</td>
              <td className="font-semibold text-red-400">-{Number(item.salidas_hoy || 0).toFixed(1)}</td>
              <td className="text-surface-200/60">{Number(item.stock_minimo).toFixed(1)}</td>
              <td>{formatCurrency(item.precio_costo || 0)}</td>
              <td className="font-semibold text-surface-50">{formatCurrency(item.valor_costo || 0)}</td>
              <td>{formatCurrency(item.precio_venta || 0)}</td>
              <td className={Number(item.margen_unitario) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(item.margen_unitario || 0)}</td>
              <td className="text-xs text-surface-200/60">{item.ultima_salida_at ? new Date(item.ultima_salida_at).toLocaleString('es-CO') : '-'}</td>
              <td>{c?<span className="badge-red">Critico</span>:<span className="badge-green">OK</span>}</td>
              <td><button type="button" className="btn-ghost btn-sm p-2" title="Corregir inventario" onClick={() => abrirCorreccion(item)}><Pencil className="h-4 w-4"/></button></td>
            </tr>
          )})}
          {inv.length===0&&<tr><td colSpan={12} className="text-center py-12 text-surface-200/30">Sin resultados</td></tr>}
        </tbody>
      </table></div></div>
      <Modal open={modal} onClose={() => setModal(false)} title={form.tipo === 'ajuste' ? 'Correccion de inventario' : 'Movimiento de inventario'} size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => ajustar.mutate()} disabled={ajustar.isPending||!form.producto_id||!form.cantidad} className="btn-primary flex-1">{ajustar.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Guardar'}</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Escanear codigo de barras</label><div className="flex gap-2"><input ref={lectorRef} autoFocus disabled={productoBloqueado} className="input font-mono" inputMode="numeric" value={codigo} onChange={e=>setCodigo(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();seleccionarPorCodigo()}}} placeholder="Lee con la pistola o escribe el codigo"/><button type="button" disabled={productoBloqueado} onClick={seleccionarPorCodigo} className="btn-secondary min-h-11 shrink-0" title="Buscar producto por codigo"><ScanLine className="h-4 w-4"/>Buscar</button></div><p className="mt-1 text-xs text-surface-200/45">Cada lectura selecciona el producto creado con ese codigo.</p></div>
          <div><label className="label">Producto *</label><select disabled={productoBloqueado} className="input" value={form.producto_id} onChange={e=>{const producto=productos.find((item:any)=>item.id===e.target.value) as any;setForm(p=>({...p,producto_id:e.target.value,costo_unit:String(Number(producto?.precio_costo||0))}))}}><option value="" className="bg-surface-800">Selecciona un producto</option>{productos.map((p:any)=><option key={p.id} value={p.id} className="bg-surface-800">{p.codigo ? `[${p.codigo}] ` : ''}{p.nombre}</option>)}</select></div>
          {productoSeleccionado&&<div className="rounded-lg border border-brand-400/20 bg-brand-500/5 p-3 text-sm sm:col-span-2"><p className="font-semibold text-surface-50">{productoSeleccionado.nombre}</p><div className="mt-2 grid grid-cols-3 gap-2 text-xs text-surface-200/60"><span>Codigo: <b className="font-mono text-surface-100">{productoSeleccionado.codigo||'-'}</b></span><span>Saldo: <b className="text-surface-100">{Number(productoSeleccionado.stock_actual||0).toFixed(2)}</b></span><span>Costo: <b className="text-surface-100">{formatCurrency(productoSeleccionado.precio_costo||0)}</b></span></div></div>}
          <div><label className="label">Tipo</label><select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value,pagar_desde_caja:e.target.value==='entrada'?p.pagar_desde_caja:false}))}><option value="entrada" className="bg-surface-800">Entrada de producto</option>{['salida','ajuste','merma','rotura'].map(t=><option key={t} value={t} className="bg-surface-800 capitalize">{t}</option>)}</select></div>
          <div><label className="label">{form.tipo === 'ajuste' ? 'Saldo final contado *' : 'Cantidad *'}</label><input type="number" min="0" className="input" value={form.cantidad} onChange={e=>setForm(p=>({...p,cantidad:e.target.value}))}/>{form.tipo === 'ajuste' && <p className="mt-1 text-xs text-surface-200/50">La correccion queda registrada como movimiento de ajuste.</p>}</div>
          <div><label className="label">Costo unitario</label><input type="number" min="0" className="input" placeholder="Solo si cambia el costo" value={form.costo_unit} onChange={e=>setForm(p=>({...p,costo_unit:e.target.value}))}/></div>
          {form.tipo==='entrada' && <div className="space-y-3 rounded-lg border border-white/10 bg-surface-900/40 p-3"><label className="flex cursor-pointer items-center gap-3 text-sm text-surface-100"><input type="checkbox" checked={form.pagar_desde_caja} onChange={e=>setForm(p=>({...p,pagar_desde_caja:e.target.checked}))}/><span>Pagado desde caja</span></label>{form.pagar_desde_caja && <div><label className="label">Metodo de pago</label><select className="input" value={form.metodo_pago} onChange={e=>setForm(p=>({...p,metodo_pago:e.target.value}))}>{['efectivo','tarjeta_credito','tarjeta_debito','transferencia','nequi','daviplata'].map(m=><option key={m} value={m} className="bg-surface-800 capitalize">{m.replace('_',' ')}</option>)}</select></div>}<div><label className="label">Factura o soporte de compra</label><input ref={soporteRef} className="hidden" type="file" accept="image/*,application/pdf" onChange={event=>adjuntarSoporte(event.target.files?.[0])}/>{camaraSoporteActiva&&<div className="mb-3 overflow-hidden rounded-lg border border-brand-400/30 bg-black"><video ref={videoSoporteRef} autoPlay playsInline muted className="h-52 w-full object-cover"/></div>}<div className="flex flex-wrap items-center gap-2"><button type="button" className="btn-secondary min-h-10" onClick={camaraSoporteActiva?capturarSoporte:abrirCamaraSoporte}><Camera className="h-4 w-4"/>{camaraSoporteActiva?'Capturar foto':'Tomar foto'}</button>{camaraSoporteActiva&&<button type="button" className="btn-secondary min-h-10" onClick={detenerCamaraSoporte}>Cancelar camara</button>}<button type="button" className="btn-secondary min-h-10" onClick={()=>soporteRef.current?.click()} disabled={cargandoSoporte}><FileUp className="h-4 w-4"/>{cargandoSoporte?'Cargando...':'Adjuntar documento'}</button>{form.soporte_url&&<span className="text-xs text-emerald-300">Documento adjunto</span>}</div><p className="mt-1 text-xs text-surface-200/45">Foto, imagen o PDF, maximo 1.5 MB.</p></div></div>}
          <div><label className="label">Notas</label><input className="input" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))}/></div>
          <div className="space-y-2 rounded-lg border border-white/10 bg-surface-900/40 p-3 sm:col-span-2"><label className="flex cursor-pointer items-center gap-3 text-sm text-surface-100"><input type="checkbox" checked={productoBloqueado} disabled={!form.producto_id} onChange={e=>{setProductoBloqueado(e.target.checked);if(!e.target.checked)window.setTimeout(()=>lectorRef.current?.focus(),0)}}/><span>Bloquear este producto para registrar varias cantidades consecutivas</span></label><label className="flex cursor-pointer items-center gap-3 text-sm text-surface-100"><input type="checkbox" checked={registroContinuo} onChange={e=>setRegistroContinuo(e.target.checked)}/><span>Registrar otro producto sin cerrar esta ventana</span></label></div>
        </div>
      </Modal>
      </>}
    </div>
  )
}
