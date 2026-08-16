import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Download, FileUp, Plus, Printer, QrCode, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'
import * as XLSX from 'xlsx'
import api from '@/lib/axios'
import type { Producto, Categoria } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

async function prepararImagen(archivo: File) {
  const origen = await new Promise<string>((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result))
    lector.onerror = () => reject(new Error('No se pudo leer la imagen'))
    lector.readAsDataURL(archivo)
  })
  const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
    const elemento = new Image()
    elemento.onload = () => resolve(elemento)
    elemento.onerror = () => reject(new Error('El archivo no es una imagen valida'))
    elemento.src = origen
  })
  const escala = Math.min(1, 1000 / Math.max(imagen.width, imagen.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.max(1, Math.round(imagen.width * escala))
  lienzo.height = Math.max(1, Math.round(imagen.height * escala))
  lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  const resultado = lienzo.toDataURL('image/jpeg', 0.78)
  if (resultado.length > 1_500_000) throw new Error('La imagen sigue siendo muy grande. Usa una foto mas liviana.')
  return resultado
}

function clave(valor: unknown) {
  return String(valor ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function numero(valor: unknown) {
  if (typeof valor === 'number') return valor
  const texto = String(valor ?? '').trim().replace(/[^\d,.-]/g, '')
  if (!texto) return 0
  if (texto.includes(',') && texto.includes('.')) {
    const decimalEsComa = texto.lastIndexOf(',') > texto.lastIndexOf('.')
    return Number(decimalEsComa ? texto.replace(/\./g, '').replace(',', '.') : texto.replace(/,/g, '')) || 0
  }
  if (texto.includes('.')) return Number(/^[-+]?\d{1,3}(\.\d{3})+$/.test(texto) ? texto.replace(/\./g, '') : texto) || 0
  if (texto.includes(',')) return Number(/^[-+]?\d{1,3}(,\d{3})+$/.test(texto) ? texto.replace(/,/g, '') : texto.replace(',', '.')) || 0
  return Number(texto) || 0
}

function valorMoneda(valor: string) {
  const cantidad = numero(valor)
  return cantidad ? formatCurrency(cantidad) : ''
}

function textoSeguro(valor: unknown) {
  return String(valor ?? '').replace(/[&<>"']/g, caracter => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[caracter] || caracter))
}

function CodigoProductoQr({ producto }: { producto: Producto }) {
  const [src, setSrc] = useState('')
  const codigo = String(producto.codigo || '').trim()
  const ficha = useMemo(() => ({
    version: 1,
    tipo: 'stockflow_producto',
    producto_id: producto.id,
    id_producto: producto.id_producto || null,
    codigo,
    nombre: producto.nombre,
    cantidad: Number(producto.stock_actual || 0),
    unidad: producto.unidad_medida || 'unidad',
    ubicacion: producto.ubicacion || null,
    destino: producto.destino || null,
    generado_en: new Date().toISOString(),
  }), [producto.id, producto.id_producto, producto.nombre, producto.stock_actual, producto.unidad_medida, producto.ubicacion, producto.destino, codigo])
  const contenidoQr = useMemo(() => `SF1:${JSON.stringify(ficha)}`, [ficha])
  const ubicacion = ficha.ubicacion || ficha.destino
  useEffect(() => { if (codigo) QRCode.toDataURL(contenidoQr, { width:480, margin:3, errorCorrectionLevel:'M' }).then(setSrc).catch(() => setSrc('')) }, [codigo, contenidoQr])
  const imprimir = () => {
    if (!src) return
    const ventana = window.open('', '_blank', 'width=420,height=560')
    if (!ventana) return toast.error('Permite las ventanas emergentes para imprimir el codigo')
    ventana.document.write(`<html><head><title>QR ${textoSeguro(producto.nombre)}</title><style>body{font-family:Arial,sans-serif;padding:22px;color:#111}h1{font-size:19px;margin:0 0 6px;text-align:center}img{display:block;width:250px;height:250px;margin:16px auto}.meta{border-top:1px dashed #555;border-bottom:1px dashed #555;padding:10px 0;font-size:13px;line-height:1.65}.meta b{display:inline-block;min-width:120px}.note{font-size:11px;color:#444;text-align:center;margin-top:16px}</style></head><body><h1>${textoSeguro(producto.nombre)}</h1><div class="meta"><div><b>ID producto:</b> ${textoSeguro(ficha.id_producto || 'No asignado')}</div><div><b>Código:</b> ${textoSeguro(codigo)}</div><div><b>Stock al imprimir:</b> ${textoSeguro(ficha.cantidad)} ${textoSeguro(ficha.unidad)}</div>${ubicacion ? `<div><b>${ficha.ubicacion ? 'Ubicación' : 'Destino'}:</b> ${textoSeguro(ubicacion)}</div>` : ''}</div><img src="${src}" alt="QR ${textoSeguro(codigo)}"/><p class="note">Escanea este QR en Conteos de inventario. El stock indicado es una referencia al momento de imprimir la etiqueta.</p></body></html>`)
    ventana.document.close(); ventana.focus(); ventana.print()
  }
  return <div className="space-y-4 text-center">{codigo ? <><p className="text-sm text-surface-200/65">Este QR identifica el producto y conserva su ficha para conteos: código, nombre, ID, unidad, cantidad al imprimir y ubicación cuando exista.</p><div className="rounded-lg border border-white/10 bg-black/10 p-3 text-left text-sm"><p><span className="text-surface-200/55">Código:</span> <strong className="font-mono">{codigo}</strong></p><p><span className="text-surface-200/55">ID:</span> {ficha.id_producto || 'No asignado'}</p><p><span className="text-surface-200/55">Stock al imprimir:</span> {ficha.cantidad} {ficha.unidad}</p>{ubicacion && <p><span className="text-surface-200/55">{ficha.ubicacion ? 'Ubicación' : 'Destino'}:</span> {ubicacion}</p>}</div>{src && <img className="mx-auto w-64 max-w-full rounded-lg bg-white p-2" src={src} alt={`Código QR ${codigo}`}/>}<button className="btn-primary w-full" onClick={imprimir}><Printer className="h-4 w-4"/>Imprimir etiqueta QR</button></> : <p className="text-red-200">Este producto no tiene código. Edítalo o créalo nuevamente para generar su QR.</p>}</div>
}

export default function ProductosPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const tipoNegocio = String(user?.empresa?.tipo || '').toLowerCase()
  const esRestaurante = tipoNegocio === 'restaurante'
  const [modal, setModal] = useState(false)
  const [productoEliminar, setProductoEliminar] = useState<Producto | null>(null)
  const [productoQr, setProductoQr] = useState<Producto | null>(null)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const archivoRef = useRef<HTMLInputElement>(null)
  const imagenArchivoRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)
  const [cargandoImagen, setCargandoImagen] = useState(false)
  const [camaraAbierta, setCamaraAbierta] = useState(false)
  const [errorCamara, setErrorCamara] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [monedaEditando, setMonedaEditando] = useState<'precio_venta' | 'precio_costo' | null>(null)
  const [form, setForm] = useState({nombre:'',id_producto:'',marca:'',codigo:'',descripcion:'',imagen_url:'',imagenes_urls:[] as string[],precio_venta:'',precio_costo:'',categoria_id:'',impuesto_pct:'0',impuesto_tipo:'iva',impuesto_incluido:false,unidad_medida:'unidad',disponible:true,controla_stock:true,controla_lote:false,controla_vencimiento:false,controla_serial:false,destino:esRestaurante?'cocina':'barra',stock_inicial:'0',stock_minimo:'0',stock_maximo:''})
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [receta, setReceta] = useState<{ingrediente_id:string;cantidad:string;unidad:string}[]>([])
  const { data: productos = [], isLoading } = useQuery({ queryKey: ['productos'], queryFn: async () => { const { data } = await api.get<any>('/productos'); return (data.data||data) as Producto[] } })
  const { data: ingredientes = [] } = useQuery({ queryKey: ['ingredientes-receta'], queryFn: async () => { const { data } = await api.get<any>('/ingredientes'); return data.data || data }, enabled: esRestaurante })
  const { data: cats = [] } = useQuery({ queryKey: ['categorias'], queryFn: async () => { const { data } = await api.get<any>('/categorias'); return (data.data||data) as Categoria[] } })
  const destinos = esRestaurante
    ? [{ valor:'cocina', texto:'Cocina' }, { valor:'barra', texto:'Barra' }, { valor:'inventario', texto:'Inventario' }, { valor:'bodega', texto:'Bodega' }, { valor:'ambos', texto:'Cocina y barra' }, { valor:'directo', texto:'Venta directa' }]
    : tipoNegocio === 'discoteca'
      ? [{ valor:'barra', texto:'Barra' }, { valor:'bodega', texto:'Bodega' }, { valor:'inventario', texto:'Inventario' }, { valor:'piso', texto:'Piso / mesas' }, { valor:'directo', texto:'Venta directa' }]
      : [{ valor:'barra', texto:'Barra' }, { valor:'bodega', texto:'Bodega' }, { valor:'inventario', texto:'Inventario' }, { valor:'cocina', texto:'Cocina' }, { valor:'directo', texto:'Venta directa' }]
  const productosFiltrados = productos.filter((producto: any) => clave([producto.nombre, producto.codigo, producto.categoria_nombre, producto.destino].join(' ')).includes(clave(busqueda)))
  useEffect(() => {
    if (!camaraAbierta) return
    let activa = true
    setErrorCamara('')
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(stream => {
        if (!activa) return stream.getTracks().forEach(track => track.stop())
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setErrorCamara('No se pudo abrir la cámara. Revisa el permiso del navegador o usa Subir archivo.'))
    return () => {
      activa = false
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [camaraAbierta])
  const crear = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<any>('/productos', {...form,precio_venta:numero(form.precio_venta),precio_costo:numero(form.precio_costo),impuesto_pct:parseFloat(form.impuesto_pct)||0,stock_inicial:parseFloat(form.stock_inicial)||0,stock_minimo:parseFloat(form.stock_minimo)||0,stock_maximo:parseFloat(form.stock_maximo)||undefined,categoria_id:form.categoria_id||undefined})
      const creado = data.data || data
      if (esRestaurante && receta.length) await api.put(`/recetas?producto_id=${creado.id}`, { porciones:1, ingredientes:receta.map(item=>({ingrediente_id:item.ingrediente_id,cantidad_neta:Number(item.cantidad),unidad:item.unidad})) })
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:['productos']}); qc.invalidateQueries({queryKey:['inventario']}); setModal(false); setMonedaEditando(null); setReceta([]); toast.success('Producto creado') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? e?.response?.data?.message ?? 'Error'),
  })
  const toggle = useMutation({
    mutationFn: ({id,disponible}:{id:string;disponible:boolean}) => api.patch(`/productos/${id}`,{disponible}),
    onSuccess: () => qc.invalidateQueries({queryKey:['productos']}),
  })
  const eliminar = useMutation({
    mutationFn: () => api.delete(`/productos/${productoEliminar?.id}`),
    onSuccess: () => { qc.invalidateQueries({queryKey:['productos']}); qc.invalidateQueries({queryKey:['inventario']}); setProductoEliminar(null); toast.success('Producto eliminado') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudo eliminar el producto'),
  })
  const eliminarSeleccionados = useMutation({
    mutationFn: () => api.delete('/productos', { data: { ids: [...seleccionados] } }),
    onSuccess: (respuesta: any) => {
      qc.invalidateQueries({queryKey:['productos']}); qc.invalidateQueries({queryKey:['inventario']})
      const cantidad = respuesta?.data?.data?.eliminados || seleccionados.size
      setSeleccionados(new Set())
      toast.success(`${cantidad} producto${cantidad===1?'':'s'} eliminado${cantidad===1?'':'s'}`)
    },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudieron eliminar los productos'),
  })
  const descargarPlantilla = () => {
    const hoja = XLSX.utils.json_to_sheet([{ id_producto:'PROD-001', nombre:'Cerveza ejemplo', marca:'Marca ejemplo', codigo:'CER-001', precio_venta:8000, precio_costo:6000, categoria:'Cervezas', destino:'barra', impuesto_pct:0, stock_inicial:24, stock_minimo:6, estado:'activo', controla_stock:'si' }])
    const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, hoja, 'Productos')
    XLSX.writeFile(libro, 'plantilla_productos_stockflow.xlsx')
  }
  const importarArchivo = async (archivo?: File) => {
    if (!archivo) return
    setImportando(true)
    try {
      const buffer = await archivo.arrayBuffer()
      const libro = XLSX.read(buffer, { type:'array' })
      const hoja = libro.Sheets[libro.SheetNames[0]]
      const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval:'' })
      const categorias = new Map(cats.map(c => [clave(c.nombre), c.id]))
      const validas = filas.map(fila => {
        const datos = Object.fromEntries(Object.entries(fila).map(([k,v]) => [clave(k), v])) as Record<string, unknown>
        const nombre = String(datos.nombre || '').trim()
        const precioVenta = numero(datos.precioventa)
        if (!nombre) return null
        const controla = !['no','false','0'].includes(clave(datos.controlastock || 'si'))
        return { id_producto:String(datos.idproducto || '').trim() || undefined, nombre, marca:String(datos.marca || '').trim() || undefined, codigo:String(datos.codigo || '').trim() || undefined, precio_venta:precioVenta, precio_costo:numero(datos.preciocosto), categoria_id:categorias.get(clave(datos.categoria)) || undefined, destino:['barra','cocina','ambos','directo','inventario','bodega','piso'].includes(clave(datos.destino)) ? clave(datos.destino) : 'barra', impuesto_pct:numero(datos.impuestopct), stock_inicial:numero(datos.stockinicial), stock_minimo:numero(datos.stockminimo), controla_stock:controla, disponible:!['inactivo','no','false','0'].includes(clave(datos.estado || 'activo')) }
      }).filter(Boolean) as any[]
      if (!validas.length) throw new Error('No hay filas validas. Cada fila debe tener al menos el nombre del producto.')
      if (validas.some(producto => !producto.codigo)) throw new Error('Cada fila debe tener codigo para actualizar la lista sin duplicados.')
      if (!window.confirm('La plantilla creara o actualizara productos por codigo. Los productos que no esten en el archivo se conservaran. Deseas continuar?')) return
      const { data } = await api.post<any>('/productos?sincronizar=true', { productos: validas })
      const resultado = data.data || data
      qc.invalidateQueries({queryKey:['productos']}); qc.invalidateQueries({queryKey:['inventario']})
      toast.success(`${resultado.creados || 0} creados y ${resultado.actualizados || 0} actualizados`)
    } catch (e:any) { toast.error(e?.message || 'No se pudo leer el archivo Excel') }
    finally { setImportando(false); if (archivoRef.current) archivoRef.current.value = '' }
  }
  const agregarImagenes = async (archivos?: FileList | File[]) => {
    const lista = Array.from(archivos || []).filter(archivo => archivo.type.startsWith('image/'))
    if (!lista.length) return toast.error('Selecciona un archivo de imagen')
    const disponibles = 5 - form.imagenes_urls.length
    if (!disponibles) return toast.error('Cada producto admite máximo 5 fotos')
    setCargandoImagen(true)
    try {
      const nuevas = await Promise.all(lista.slice(0, disponibles).map(prepararImagen))
      setForm(actual => {
        const imagenes_urls = [...actual.imagenes_urls, ...nuevas].slice(0, 5)
        return { ...actual, imagenes_urls, imagen_url: imagenes_urls[0] || '' }
      })
      toast.success(`${nuevas.length} foto${nuevas.length === 1 ? '' : 's'} lista${nuevas.length === 1 ? '' : 's'} para guardar`)
    } catch (e:any) { toast.error(e?.message || 'No se pudo preparar la imagen') }
    finally { setCargandoImagen(false); if (imagenArchivoRef.current) imagenArchivoRef.current.value = '' }
  }
  const capturarFoto = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return setErrorCamara('La cámara aún no está lista.')
    if (form.imagenes_urls.length >= 5) return toast.error('Cada producto admite máximo 5 fotos')
    const lienzo = document.createElement('canvas')
    lienzo.width = video.videoWidth
    lienzo.height = video.videoHeight
    lienzo.getContext('2d')?.drawImage(video, 0, 0)
    const imagen = lienzo.toDataURL('image/jpeg', 0.78)
    setForm(actual => {
      const imagenes_urls = [...actual.imagenes_urls, imagen]
      return { ...actual, imagenes_urls, imagen_url: imagenes_urls[0] }
    })
    toast.success('Foto agregada')
  }
  const sugerirCategoria = (nombre: string) => {
    const palabras = esRestaurante
      ? [['pizza','Platos fuertes'], ['hamburg','Platos fuertes'], ['arroz','Platos fuertes'], ['sopa','Entradas'], ['empan','Entradas'], ['postre','Postres'], ['jugo','Bebidas'], ['gaseosa','Bebidas'], ['cafe','Bebidas']]
      : [['cerveza','Cervezas'], ['aguardiente','Licores'], ['ron','Licores'], ['whisky','Licores'], ['vodka','Licores'], ['coctel','Cocteles'], ['snack','Snacks'], ['papa','Snacks'], ['gaseosa','Bebidas'], ['cola','Bebidas'], ['azucar','Abarrotes'], ['arroz','Abarrotes'], ['aceite','Abarrotes'], ['cuaderno','Papeleria'], ['lapiz','Papeleria']]
    const texto = clave(nombre)
    const categoria = palabras.map(([palabra, categoria]) => texto.includes(clave(palabra)) ? categoria : '').find(Boolean)
    const encontrada = categoria ? cats.find(item => clave(item.nombre) === clave(categoria)) : undefined
    setForm(actual => ({ ...actual, nombre, categoria_id: encontrada?.id || actual.categoria_id || cats.find(item => clave(item.nombre) === 'general')?.id || cats[0]?.id || '' }))
  }
  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Productos</h1><p className="page-subtitle">{productos.length} productos</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={descargarPlantilla} className="btn-secondary btn-sm"><Download className="w-4 h-4"/>Plantilla Excel</button><button onClick={() => archivoRef.current?.click()} disabled={importando} className="btn-secondary btn-sm"><FileUp className="w-4 h-4"/>{importando ? 'Importando...' : 'Importar Excel'}</button>{seleccionados.size>0&&<button onClick={()=>{if(window.confirm(`Eliminar ${seleccionados.size} producto(s) seleccionados? Se conservara el historial.`))eliminarSeleccionados.mutate()}} disabled={eliminarSeleccionados.isPending} className="btn-danger btn-sm"><Trash2 className="w-4 h-4"/>{eliminarSeleccionados.isPending?'Eliminando...':`Eliminar (${seleccionados.size})`}</button>}<button onClick={() => setModal(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Nuevo producto</button></div>
      </div>
      <input ref={archivoRef} className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={e => importarArchivo(e.target.files?.[0])}/>
      <input ref={imagenArchivoRef} className="hidden" type="file" accept="image/*" multiple onChange={e => agregarImagenes(e.target.files)}/>
      <input className="input max-w-md" value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar por nombre, codigo, categoria o destino..." />
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th className="w-10"><input aria-label="Seleccionar todos los productos" type="checkbox" checked={productos.length>0&&seleccionados.size===productos.length} onChange={e=>setSeleccionados(e.target.checked?new Set(productos.map(producto=>producto.id)):new Set())}/></th><th>Producto</th><th>Marca</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Destino</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {productosFiltrados.map(p => { const pr = p as any; return (
            <tr key={p.id}>
              <td><input aria-label={`Seleccionar ${p.nombre}`} type="checkbox" checked={seleccionados.has(p.id)} onChange={e=>setSeleccionados(actual=>{const siguiente=new Set(actual);if(e.target.checked)siguiente.add(p.id);else siguiente.delete(p.id);return siguiente})}/></td>
              <td><div><p className="font-medium text-surface-50">{p.nombre}</p><p className="text-xs text-surface-200/55">{(pr as any).id_producto ? `${(pr as any).id_producto} · ` : ''}{p.codigo || 'Código pendiente'}</p></div></td>
              <td className="text-surface-200/60">{(pr as any).marca || '—'}</td>
              <td className="text-surface-200/60">{pr.categoria_nombre ?? '—'}</td>
              <td className="font-semibold text-brand-400">{formatCurrency(p.precio_venta)}</td>
              <td className={cn(pr.stock_actual===0?'text-red-400':'text-surface-200/70')}>{p.controla_stock?(pr.stock_actual??0):'∞'}</td>
              <td><span className="badge-gray capitalize">{p.destino}</span></td>
              <td><span className={p.disponible?'badge-green':'badge-red'}>{p.disponible?'Disponible':'No disponible'}</span></td>
              <td><div className="flex items-center justify-end gap-1"><button onClick={() => setProductoQr(p)} className="btn-ghost btn-sm p-2 text-brand-200" title="Ver e imprimir QR"><QrCode className="w-4 h-4"/></button><button onClick={() => toggle.mutate({id:p.id,disponible:!p.disponible})} className={`text-xs px-2 py-1 rounded font-medium ${p.disponible?'text-red-400 hover:bg-red-500/10':'text-emerald-400 hover:bg-emerald-500/10'}`}>{p.disponible?'Deshabilitar':'Habilitar'}</button><button onClick={() => setProductoEliminar(p)} className="btn-ghost btn-sm text-red-400 hover:bg-red-500/10" title="Eliminar producto"><Trash2 className="w-4 h-4"/></button></div></td>
            </tr>
          )})}
          {productosFiltrados.length===0&&<tr><td colSpan={9} className="text-center py-12 text-surface-200/30">{busqueda?'No se encontraron productos':'Sin productos'}</td></tr>}
        </tbody>
      </table></div></div>
      <Modal open={modal} onClose={() => setModal(false)} title={esRestaurante ? 'Nuevo producto de restaurante' : 'Nuevo producto'} size="lg"
        footer={<div className="flex gap-3"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => crear.mutate()} disabled={crear.isPending||!form.nombre||!form.codigo||!form.precio_venta} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear'}</button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-2"><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>sugerirCategoria(e.target.value)}/><p className="mt-1 text-xs text-surface-200/45">La categoría se asigna automáticamente según el nombre; puedes ajustarla antes de guardar.</p></div>
           <div><label className="label">ID producto</label><input className="input font-mono" placeholder="Se genera automaticamente al guardar" value={form.id_producto} disabled/><p className="mt-1 text-xs text-surface-200/45">Identificador interno consecutivo.</p></div>
          <div><label className="label">Marca</label><input className="input" placeholder="Ej: Postobón" value={form.marca} onChange={e=>setForm(p=>({...p,marca:e.target.value}))}/></div>
           <div className="col-span-2"><label className="label">Código de barras o SKU</label><input className="input font-mono" placeholder="Escanea o escribe el código del proveedor" value={form.codigo} onChange={e=>setForm(p=>({...p,codigo:e.target.value.trim()}))}/><p className="mt-1 text-xs text-surface-200/45">Dato manual: usa el código de barras impreso por el proveedor o un SKU propio.</p></div>
          {esRestaurante && <><div><label className="label">Unidad</label><select className="input" value={form.unidad_medida} onChange={e=>setForm(p=>({...p,unidad_medida:e.target.value}))}>{['unidad','gramo','kilogramo','mililitro','litro','porcion'].map(unidad=><option key={unidad} value={unidad}>{unidad}</option>)}</select></div>
          <div className="col-span-2"><label className="label">Descripcion</label><textarea className="input min-h-20" value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} placeholder={esRestaurante ? 'Ingredientes, preparacion o alergenos' : 'Presentacion o detalle del producto'}/></div>
          <div className="col-span-2"><label className="label">Imagen del producto</label><div className="flex flex-wrap items-center gap-3"><button type="button" className="btn-secondary btn-sm" onClick={()=>setCamaraAbierta(true)} disabled={cargandoImagen}><Camera className="w-4 h-4"/>{cargandoImagen?'Preparando...':'Tomar foto'}</button><button type="button" className="btn-secondary btn-sm" onClick={()=>imagenArchivoRef.current?.click()} disabled={cargandoImagen}>Subir archivo</button><span className="text-xs text-surface-200/50">{form.imagenes_urls.length}/5 fotos</span></div>{form.imagenes_urls.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{form.imagenes_urls.map((imagen, indice)=><div key={imagen.slice(-20)+indice} className="relative"><img src={imagen} alt={`Foto ${indice + 1}`} className="h-16 w-16 rounded-lg border border-white/10 object-cover"/><button type="button" aria-label="Quitar foto" className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-red-500 text-xs" onClick={()=>setForm(actual=>{const imagenes_urls=actual.imagenes_urls.filter((_,i)=>i!==indice);return {...actual,imagenes_urls,imagen_url:imagenes_urls[0]||''}})}>x</button></div>)}</div>}<input className="input mt-3" value={form.imagen_url.startsWith('data:') ? 'Fotos cargadas desde dispositivo' : form.imagen_url} onChange={e=>setForm(p=>({...p,imagen_url:e.target.value,imagenes_urls:e.target.value?[e.target.value]:[]}))} placeholder="O pega una URL de imagen"/></div>
          </>}<div><label className="label">Precio venta *</label><input inputMode="numeric" className="input" placeholder="$ 43.200" value={monedaEditando==='precio_venta' ? form.precio_venta : valorMoneda(form.precio_venta)} onFocus={()=>setMonedaEditando('precio_venta')} onBlur={()=>setMonedaEditando(null)} onChange={e=>setForm(p=>({...p,precio_venta:e.target.value.replace(/\D/g,'')}))}/></div>
          <div><label className="label">Precio costo</label><input inputMode="numeric" className="input" placeholder="$ 30.000" value={monedaEditando==='precio_costo' ? form.precio_costo : valorMoneda(form.precio_costo)} onFocus={()=>setMonedaEditando('precio_costo')} onBlur={()=>setMonedaEditando(null)} onChange={e=>setForm(p=>({...p,precio_costo:e.target.value.replace(/\D/g,'')}))}/></div>
           <div><label className="label">Categoría automática</label><select className="input" value={form.categoria_id} onChange={e=>setForm(p=>({...p,categoria_id:e.target.value}))}><option value="" className="bg-surface-800">Sin categoría</option>{cats.map(c=><option key={c.id} value={c.id} className="bg-surface-800">{c.nombre}</option>)}</select><p className="mt-1 text-xs text-surface-200/45">Se propone al escribir el nombre; puedes corregirla.</p></div>
          <div><label className="label">Destino</label><select className="input" value={form.destino} onChange={e=>setForm(p=>({...p,destino:e.target.value}))}>{destinos.map(destino=><option key={destino.valor} value={destino.valor} className="bg-surface-800">{destino.texto}</option>)}</select></div>
          <div><label className="label">Estado</label><select className="input" value={form.disponible ? 'activo' : 'inactivo'} onChange={e=>setForm(p=>({...p,disponible:e.target.value==='activo'}))}><option value="activo">Activo / disponible</option><option value="inactivo">Inactivo / no disponible</option></select></div>
          {esRestaurante ? <div><label className="label">Impuesto</label><div className="flex gap-2"><select className="input w-24" value={form.impuesto_tipo} onChange={e=>setForm(p=>({...p,impuesto_tipo:e.target.value}))}><option value="iva">IVA</option><option value="inc">INC</option><option value="ninguno">Ninguno</option></select><input type="number" min="0" max="100" className="input" value={form.impuesto_pct} onChange={e=>setForm(p=>({...p,impuesto_pct:e.target.value}))}/></div></div> : <div><label className="label">Impuesto %</label><input type="number" min="0" max="100" className="input" value={form.impuesto_pct} onChange={e=>setForm(p=>({...p,impuesto_pct:e.target.value}))}/></div>}
          <div><label className="label">Stock inicial</label><input type="number" min="0" className="input" value={form.stock_inicial} onChange={e=>setForm(p=>({...p,stock_inicial:e.target.value}))}/></div>
          <div><label className="label">Stock mínimo</label><input type="number" min="0" className="input" value={form.stock_minimo} onChange={e=>setForm(p=>({...p,stock_minimo:e.target.value}))}/></div>
          {esRestaurante && <div><label className="label">Stock maximo</label><input type="number" min="0" className="input" value={form.stock_maximo} onChange={e=>setForm(p=>({...p,stock_maximo:e.target.value}))}/></div>}
          <div className="col-span-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="mb-2 text-sm font-medium">Controles de trazabilidad opcionales</p><p className="mb-3 text-xs text-surface-200/50">Se aplican solo a este producto de esta empresa. Si estan apagados, el flujo sigue siendo producto y cantidad.</p><div className="flex flex-wrap gap-x-5 gap-y-2"><label className="flex items-center gap-2 text-sm text-surface-200/75"><input type="checkbox" checked={form.controla_stock} onChange={e=>setForm(p=>({...p,controla_stock:e.target.checked}))}/>Controlar inventario</label><label className="flex items-center gap-2 text-sm text-surface-200/75"><input type="checkbox" checked={form.controla_lote} onChange={e=>setForm(p=>({...p,controla_lote:e.target.checked}))}/>Controlar lote</label><label className="flex items-center gap-2 text-sm text-surface-200/75"><input type="checkbox" checked={form.controla_vencimiento} onChange={e=>setForm(p=>({...p,controla_vencimiento:e.target.checked}))}/>Controlar vencimiento</label><label className="flex items-center gap-2 text-sm text-surface-200/75"><input type="checkbox" checked={form.controla_serial} onChange={e=>setForm(p=>({...p,controla_serial:e.target.checked}))}/>Controlar serial</label><label className="flex items-center gap-2 text-sm text-surface-200/75"><input type="checkbox" checked={form.impuesto_incluido} onChange={e=>setForm(p=>({...p,impuesto_incluido:e.target.checked}))}/>Precio con impuesto incluido</label></div></div>
        </div>
        {esRestaurante && <div className="mt-5 border-t border-white/10 pt-4"><div className="mb-3"><h4 className="text-sm font-semibold">Receta e ingredientes</h4><p className="text-xs text-surface-200/45">Al vender este plato se descuenta la cantidad indicada de cada ingrediente.</p></div><div className="space-y-2">{receta.map((item, indice)=><div key={indice} className="grid grid-cols-[1fr_85px_90px_auto] gap-2"><select className="input" value={item.ingrediente_id} onChange={e=>setReceta(lista=>lista.map((fila,i)=>i===indice?{...fila,ingrediente_id:e.target.value}:fila))}><option value="">Ingrediente</option>{ingredientes.map((ingrediente:any)=><option key={ingrediente.id} value={ingrediente.id}>{ingrediente.nombre}</option>)}</select><input className="input" type="number" min="0" step="0.001" placeholder="Cant." value={item.cantidad} onChange={e=>setReceta(lista=>lista.map((fila,i)=>i===indice?{...fila,cantidad:e.target.value}:fila))}/><select className="input" value={item.unidad} onChange={e=>setReceta(lista=>lista.map((fila,i)=>i===indice?{...fila,unidad:e.target.value}:fila))}>{['unidad','gramo','kilogramo','mililitro','litro','porcion'].map(unidad=><option key={unidad}>{unidad}</option>)}</select><button type="button" className="btn-ghost text-red-300" onClick={()=>setReceta(lista=>lista.filter((_,i)=>i!==indice))}>Quitar</button></div>)}</div><button type="button" className="btn-secondary btn-sm mt-3" onClick={()=>setReceta(lista=>[...lista,{ingrediente_id:'',cantidad:'',unidad:'unidad'}])}>Agregar ingrediente</button></div>}
      </Modal>
      <Modal open={camaraAbierta} onClose={() => setCamaraAbierta(false)} title="Tomar fotos del producto" size="md"
        footer={<div className="flex gap-3"><button onClick={() => setCamaraAbierta(false)} className="btn-secondary flex-1">Terminar</button><button onClick={capturarFoto} disabled={form.imagenes_urls.length >= 5 || !!errorCamara} className="btn-primary flex-1"><Camera className="w-4 h-4"/>Capturar foto</button></div>}>
        <div className="space-y-3"><div className="overflow-hidden rounded-lg bg-black"><video ref={videoRef} className="aspect-video w-full object-cover" autoPlay muted playsInline/></div>{errorCamara && <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-200">{errorCamara}</p>}<p className="text-sm text-surface-200/60">Toma hasta cinco fotos. La primera será la imagen principal del producto.</p>{form.imagenes_urls.length > 0 && <div className="flex gap-2">{form.imagenes_urls.map((imagen, indice)=><img key={imagen.slice(-20)+indice} src={imagen} alt={`Foto ${indice + 1}`} className="h-12 w-12 rounded object-cover"/>)}</div>}</div>
      </Modal>
      <Modal open={!!productoQr} onClose={() => setProductoQr(null)} title={`QR · ${productoQr?.nombre || ''}`} size="sm">{productoQr && <CodigoProductoQr producto={productoQr}/>}</Modal>
      <Modal open={!!productoEliminar} onClose={() => setProductoEliminar(null)} title="Eliminar producto" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setProductoEliminar(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => eliminar.mutate()} disabled={eliminar.isPending} className="btn-danger flex-1">{eliminar.isPending ? 'Eliminando...' : <><Trash2 className="w-4 h-4"/>Eliminar</>}</button></div>}>
        <p className="text-sm text-surface-200/70">Eliminarás <strong className="text-surface-50">{productoEliminar?.nombre}</strong>. Quedará fuera de nuevas ventas, pero se conservará su historial de pedidos e inventario.</p>
      </Modal>
    </div>
  )
}
