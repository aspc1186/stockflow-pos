import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Download, FileImage, FileUp, Pencil, Plus } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '@/lib/axios'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const unidades = ['kilogramo', 'gramo', 'litro', 'mililitro', 'unidad', 'porcion', 'caja', 'bolsa', 'paquete', 'botella', 'lata', 'canasta', 'docena', 'bandeja', 'saco', 'bulto', 'galon', 'libra', 'onza', 'tira', 'atado', 'manojo', 'cubeta', 'vaso', 'tarro', 'frasco', 'rollo', 'sobre', 'garrafa']

type Modo = 'ingredientes' | 'compras' | 'mermas' | 'recetas'

const numero = (valor: unknown, porDefecto = 0) => {
  const n = Number(String(valor ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : porDefecto
}

const normalizar = (valor: unknown) => String(valor ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '')

const normalizarUnidad = (valor: unknown) => {
  const unidad = normalizar(valor)
  const equivalencias: Record<string, string> = {
    kilogramos: 'kilogramo', kilos: 'kilogramo', kg: 'kilogramo', gramos: 'gramo', gr: 'gramo',
    litros: 'litro', lt: 'litro', mililitros: 'mililitro', ml: 'mililitro', unidades: 'unidad',
    porciones: 'porcion', cajas: 'caja', bolsas: 'bolsa', paquetes: 'paquete', botellas: 'botella',
    latas: 'lata', canastas: 'canasta', docenas: 'docena', bandejas: 'bandeja', sacos: 'saco',
    bultos: 'bulto', galones: 'galon', libras: 'libra', onzas: 'onza', tiras: 'tira', atados: 'atado',
    manojos: 'manojo', cubetas: 'cubeta', vasos: 'vaso', tarros: 'tarro', frascos: 'frasco',
    rollos: 'rollo', sobres: 'sobre',
  }
  return equivalencias[unidad] || unidad
}

async function prepararImagen(archivo: File) {
  if (!archivo.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen')
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
  const escala = Math.min(1, 1200 / Math.max(imagen.width, imagen.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.max(1, Math.round(imagen.width * escala))
  lienzo.height = Math.max(1, Math.round(imagen.height * escala))
  lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  const resultado = lienzo.toDataURL('image/jpeg', 0.78)
  if (resultado.length > 1_500_000) throw new Error('La imagen es muy grande. Usa una foto mas liviana.')
  return resultado
}

export default function RestauranteOperacionPage({ modo }: { modo: Modo }) {
  const queryClient = useQueryClient()
  const archivoRef = useRef<HTMLInputElement>(null)
  const soporteCamaraRef = useRef<HTMLInputElement>(null)
  const soporteArchivoRef = useRef<HTMLInputElement>(null)
  const recetaArchivoRef = useRef<HTMLInputElement>(null)
  const [modal, setModal] = useState(false)
  const [importando, setImportando] = useState(false)
  const [importandoRecetas, setImportandoRecetas] = useState(false)
  const [cargandoSoporte, setCargandoSoporte] = useState(false)
  const [recetaModal, setRecetaModal] = useState<any>(null)
  const [recetaLineas, setRecetaLineas] = useState<{ ingrediente_id: string; cantidad_neta: string; unidad: string; merma_pct: string }[]>([])
  const [recetaDatos, setRecetaDatos] = useState({ porciones: '1', costos_adicionales: '0' })
  const [ingrediente, setIngrediente] = useState({
    nombre: '', codigo: '', categoria: '', unidad_compra: 'kilogramo', unidad_consumo: 'gramo',
    factor_conversion: '1000', stock_minimo: '0', stock_maximo: '', punto_reorden: '', proveedor_principal: '',
  })
  const [compra, setCompra] = useState({ proveedor: '', numero_factura: '', ingrediente_id: '', cantidad_compra: '', factor_conversion: '1', precio_unitario: '', transporte: '0', soporte_url: '' })
  const [merma, setMerma] = useState({ ingrediente_id: '', cantidad: '', tipo: 'merma', motivo: '', observaciones: '' })

  const { data: ingredientes = [], isLoading } = useQuery({
    queryKey: ['ingredientes'],
    queryFn: async () => {
      const { data } = await api.get<any>('/ingredientes')
      return data.data || data
    },
  })
  const { data: compras = [] } = useQuery({
    queryKey: ['compras-ingredientes'], enabled: modo === 'compras',
    queryFn: async () => {
      const { data } = await api.get<any>('/compras-ingredientes')
      return data.data || data
    },
  })
  const { data: mermas = [] } = useQuery({
    queryKey: ['mermas-ingredientes'], enabled: modo === 'mermas',
    queryFn: async () => {
      const { data } = await api.get<any>('/mermas-ingredientes')
      return data.data || data
    },
  })
  const { data: productos = [] } = useQuery({
    queryKey: ['productos'], enabled: modo === 'recetas',
    queryFn: async () => {
      const { data } = await api.get<any>('/productos')
      return data.data || data
    },
  })

  const actualizarListas = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ingredientes'] }),
      queryClient.invalidateQueries({ queryKey: ['compras-ingredientes'] }),
      queryClient.invalidateQueries({ queryKey: ['mermas-ingredientes'] }),
    ])
  }

  const descargarPlantilla = () => {
    const hoja = XLSX.utils.json_to_sheet([{
      nombre: 'Tomate chonto', codigo: 'ING-001', categoria: 'Verduras', descripcion: 'Ingrediente fresco',
      unidad_compra: 'kilogramo', unidad_consumo: 'gramo', factor_conversion: 1000,
      stock_minimo: 2, stock_maximo: 20, punto_reorden: 5, proveedor_principal: 'Proveedor ejemplo', merma_pct: 5, rendimiento: 0.95,
    }])
    hoja['!cols'] = [
      { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
      { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
    ]
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Ingredientes')
    XLSX.writeFile(libro, 'plantilla_ingredientes.xlsx')
  }

  const importarArchivo = async (archivo?: File) => {
    if (!archivo) return
    setImportando(true)
    try {
      const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' })
      const hoja = libro.Sheets[libro.SheetNames[0]]
      const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' })
      if (!filas.length) throw new Error('El archivo no contiene ingredientes')

      const filasPreparadas = filas.map((fila, indice) => {
        const datos = Object.fromEntries(Object.entries(fila).map(([clave, valor]) => [normalizar(clave), valor])) as Record<string, unknown>
        const nombre = String(datos.nombre || '').trim()
        if (!nombre) throw new Error(`Fila ${indice + 2}: el nombre es obligatorio`)
        const unidadCompra = normalizarUnidad(datos.unidadcompra || 'unidad')
        const unidadConsumo = normalizarUnidad(datos.unidadconsumo || 'unidad')
        if (!unidadCompra || !unidadConsumo) throw new Error(`Fila ${indice + 2}: unidad de compra y consumo son obligatorias`)
        const factorConversion = numero(datos.factorconversion, 1)
        if (factorConversion <= 0) throw new Error(`Fila ${indice + 2}: el factor de conversion debe ser mayor a cero`)
        return {
          nombre,
          codigo: String(datos.codigo || '').trim() || undefined,
          categoria: String(datos.categoria || '').trim() || undefined,
          descripcion: String(datos.descripcion || '').trim() || undefined,
          unidad_compra: unidadCompra,
          unidad_consumo: unidadConsumo,
          factor_conversion: factorConversion,
          stock_minimo: Math.max(0, numero(datos.stockminimo)),
          stock_maximo: datos.stockmaximo === '' ? undefined : Math.max(0, numero(datos.stockmaximo)),
          punto_reorden: datos.puntoreorden === '' ? undefined : Math.max(0, numero(datos.puntoreorden)),
          proveedor_principal: String(datos.proveedorprincipal || '').trim() || undefined,
          merma_pct: Math.max(0, Math.min(99.9, numero(datos.mermapct))),
          rendimiento: Math.max(0, Math.min(1, numero(datos.rendimiento, 1))),
        }
      })

      for (const fila of filasPreparadas) await api.post('/ingredientes', fila)
      await actualizarListas()
      toast.success(`${filasPreparadas.length} ingrediente${filasPreparadas.length === 1 ? '' : 's'} importado${filasPreparadas.length === 1 ? '' : 's'}`)
    } catch (error: any) {
      toast.error(error?.response?.data?.msg || error?.message || 'No se pudo importar el archivo')
    } finally {
      setImportando(false)
      if (archivoRef.current) archivoRef.current.value = ''
    }
  }

  const cargarSoporte = async (archivo?: File) => {
    if (!archivo) return
    setCargandoSoporte(true)
    try {
      const soporteUrl = await prepararImagen(archivo)
      setCompra((actual) => ({ ...actual, soporte_url: soporteUrl }))
      toast.success('Soporte listo para guardar con la compra')
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo preparar el soporte')
    } finally {
      setCargandoSoporte(false)
      if (soporteCamaraRef.current) soporteCamaraRef.current.value = ''
      if (soporteArchivoRef.current) soporteArchivoRef.current.value = ''
    }
  }

  const abrirReceta = async (producto: any) => {
    try {
      const { data } = await api.get<any>(`/recetas?producto_id=${producto.id}`)
      const receta = data.data
      setRecetaModal(producto)
      setRecetaDatos({ porciones: String(receta?.porciones || 1), costos_adicionales: String(receta?.costos_adicionales || 0) })
      setRecetaLineas((receta?.ingredientes || []).map((linea: any) => ({ ingrediente_id: linea.ingrediente_id, cantidad_neta: String(linea.cantidad_neta), unidad: linea.unidad || 'unidad', merma_pct: String(linea.merma_pct || 0) })))
    } catch (error: any) {
      toast.error(error?.response?.data?.msg || 'No se pudo cargar la receta')
    }
  }

  const guardarReceta = useMutation({
    mutationFn: () => api.put(`/recetas?producto_id=${recetaModal.id}`, {
      porciones: numero(recetaDatos.porciones, 1),
      costos_adicionales: numero(recetaDatos.costos_adicionales),
      ingredientes: recetaLineas.map((linea) => ({ ...linea, cantidad_neta: numero(linea.cantidad_neta), merma_pct: numero(linea.merma_pct) })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      setRecetaModal(null)
      toast.success('Receta guardada y costo recalculado')
    },
    onError: (error: any) => toast.error(error?.response?.data?.msg || 'No se pudo guardar la receta'),
  })

  const descargarPlantillaRecetas = () => {
    const hoja = XLSX.utils.json_to_sheet([{ producto_codigo: 'PLA-001', producto_nombre: 'Plato ejemplo', ingrediente_codigo: 'ING-001', ingrediente_nombre: 'Tomate chonto', cantidad_neta: 120, unidad: 'gramo', merma_pct: 5, porciones: 1, costos_adicionales: 0 }])
    hoja['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 20 }]
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Recetas')
    XLSX.writeFile(libro, 'plantilla_recetas_restaurante.xlsx')
  }

  const importarRecetas = async (archivo?: File) => {
    if (!archivo) return
    setImportandoRecetas(true)
    try {
      const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' })
      const hoja = libro.Sheets[libro.SheetNames[0]]
      const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' })
      if (!filas.length) throw new Error('El archivo no contiene recetas')
      const productosPorCodigo = new Map(productos.filter((producto: any) => normalizar(producto.codigo)).map((producto: any) => [normalizar(producto.codigo), producto]))
      const productosPorNombre = new Map(productos.map((producto: any) => [normalizar(producto.nombre), producto]))
      const ingredientesPorCodigo = new Map(ingredientes.filter((item: any) => normalizar(item.codigo)).map((item: any) => [normalizar(item.codigo), item]))
      const ingredientesPorNombre = new Map(ingredientes.map((item: any) => [normalizar(item.nombre), item]))
      const recetas = new Map<string, { producto: any; porciones: number; costos_adicionales: number; ingredientes: any[] }>()
      filas.forEach((fila, indice) => {
        const datos = Object.fromEntries(Object.entries(fila).map(([clave, valor]) => [normalizar(clave), valor])) as Record<string, unknown>
        const producto = productosPorCodigo.get(normalizar(datos.productocodigo)) || productosPorNombre.get(normalizar(datos.productonombre))
        const ingrediente = ingredientesPorCodigo.get(normalizar(datos.ingredientecodigo)) || ingredientesPorNombre.get(normalizar(datos.ingredientenombre))
        if (!producto || !ingrediente) throw new Error(`Fila ${indice + 2}: no se encontro el plato o ingrediente`)
        const cantidad = numero(datos.cantidadneta)
        if (cantidad <= 0) throw new Error(`Fila ${indice + 2}: cantidad_neta debe ser mayor que cero`)
        const receta = recetas.get(producto.id) || { producto, porciones: Math.max(1, numero(datos.porciones, 1)), costos_adicionales: Math.max(0, numero(datos.costosadicionales)), ingredientes: [] }
        receta.ingredientes.push({ ingrediente_id: ingrediente.id, cantidad_neta: cantidad, unidad: normalizarUnidad(datos.unidad || ingrediente.unidad_consumo || 'unidad'), merma_pct: Math.max(0, numero(datos.mermapct)) })
        recetas.set(producto.id, receta)
      })
      for (const receta of recetas.values()) await api.put(`/recetas?producto_id=${receta.producto.id}`, receta)
      await queryClient.invalidateQueries({ queryKey: ['productos'] })
      toast.success(`${recetas.size} receta${recetas.size === 1 ? '' : 's'} importada${recetas.size === 1 ? '' : 's'}`)
    } catch (error: any) {
      toast.error(error?.response?.data?.msg || error?.message || 'No se pudieron importar las recetas')
    } finally {
      setImportandoRecetas(false)
      if (recetaArchivoRef.current) recetaArchivoRef.current.value = ''
    }
  }

  const guardar = useMutation({
    mutationFn: () => {
      if (modo === 'ingredientes') return api.post('/ingredientes', ingrediente)
      if (modo === 'compras') return api.post('/compras-ingredientes', {
        proveedor: compra.proveedor,
        numero_factura: compra.numero_factura,
        transporte: Number(compra.transporte) || 0,
        soporte_url: compra.soporte_url || undefined,
        items: [{
          ingrediente_id: compra.ingrediente_id,
          cantidad_compra: Number(compra.cantidad_compra),
          factor_conversion: Number(compra.factor_conversion),
          cantidad_recibida: Number(compra.cantidad_compra),
          precio_unitario: Number(compra.precio_unitario),
        }],
      })
      return api.post('/mermas-ingredientes', merma)
    },
    onSuccess: async () => {
      await actualizarListas()
      setModal(false)
      toast.success('Registro guardado')
    },
    onError: (error: any) => toast.error(error?.response?.data?.msg || 'No se pudo guardar'),
  })

  if (isLoading) return <PageLoader />

  if (modo === 'recetas') return <div className="space-y-5">
    <div className="page-header">
      <div><h1 className="page-title">Recetas</h1><p className="page-subtitle">Ingredientes y cantidades requeridas por cada plato.</p></div>
      <div className="flex flex-wrap gap-2"><input ref={recetaArchivoRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={(event) => importarRecetas(event.target.files?.[0])} /><button className="btn-secondary btn-sm" onClick={descargarPlantillaRecetas}><Download className="w-4 h-4" />Plantilla Excel</button><button className="btn-secondary btn-sm" onClick={() => recetaArchivoRef.current?.click()} disabled={importandoRecetas}><FileUp className="w-4 h-4" />{importandoRecetas ? 'Importando...' : 'Importar Excel'}</button></div>
    </div>
    <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base"><thead><tr><th>Plato</th><th>Receta</th><th>Ingredientes</th><th>Costo por porcion</th><th></th></tr></thead><tbody>{productos.map((producto: any) => <tr key={producto.id}><td className="font-medium">{producto.nombre}</td><td><span className={producto.producto_tipo === 'receta' ? 'badge-green' : 'badge-gray'}>{producto.producto_tipo === 'receta' ? 'Configurada' : 'Sin receta'}</span></td><td>{producto.producto_tipo === 'receta' ? 'Ver y editar composicion' : '-'}</td><td>{formatCurrency(producto.precio_costo || 0)}</td><td><button className="btn-secondary btn-sm" onClick={() => abrirReceta(producto)}><Pencil className="w-4 h-4" />{producto.producto_tipo === 'receta' ? 'Editar receta' : 'Crear receta'}</button></td></tr>)}{productos.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-surface-200/40">Crea primero los platos en Productos.</td></tr>}</tbody></table></div></div>
    <Modal open={!!recetaModal} onClose={() => setRecetaModal(null)} title={recetaModal ? `Receta: ${recetaModal.nombre}` : 'Receta'} size="2xl" footer={<div className="flex gap-3"><button className="btn-secondary flex-1" onClick={() => setRecetaModal(null)}>Cancelar</button><button className="btn-primary flex-1" onClick={() => guardarReceta.mutate()} disabled={guardarReceta.isPending || !recetaLineas.length}>{guardarReceta.isPending ? 'Guardando...' : 'Guardar receta'}</button></div>}>
      <div className="grid grid-cols-2 gap-3"><div><label className="label">Porciones</label><input className="input" min="1" type="number" value={recetaDatos.porciones} onChange={(event) => setRecetaDatos((actual) => ({ ...actual, porciones: event.target.value }))} /></div><div><label className="label">Costos adicionales</label><input className="input" min="0" type="number" value={recetaDatos.costos_adicionales} onChange={(event) => setRecetaDatos((actual) => ({ ...actual, costos_adicionales: event.target.value }))} /></div></div>
      <div className="mt-5 space-y-3"><div className="hidden grid-cols-[minmax(260px,1fr)_120px_150px_110px_auto] gap-3 px-1 text-xs font-medium uppercase text-surface-200/55 sm:grid"><span>Ingrediente</span><span>Cantidad</span><span>Unidad</span><span>Merma %</span><span></span></div>{recetaLineas.map((linea, indice) => <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/5 bg-surface-900/30 p-2 sm:grid-cols-[minmax(260px,1fr)_120px_150px_110px_auto] sm:items-center sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0" key={indice}><select aria-label="Ingrediente" className="input col-span-2 sm:col-span-1" value={linea.ingrediente_id} onChange={(event) => setRecetaLineas((actual) => actual.map((fila, posicion) => posicion === indice ? { ...fila, ingrediente_id: event.target.value } : fila))}><option value="">Ingrediente</option>{ingredientes.map((item: any) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><input aria-label="Cantidad" className="input" type="number" min="0" step="0.001" placeholder="Cantidad" value={linea.cantidad_neta} onChange={(event) => setRecetaLineas((actual) => actual.map((fila, posicion) => posicion === indice ? { ...fila, cantidad_neta: event.target.value } : fila))} /><select aria-label="Unidad" className="input" value={linea.unidad} onChange={(event) => setRecetaLineas((actual) => actual.map((fila, posicion) => posicion === indice ? { ...fila, unidad: event.target.value } : fila))}>{unidades.map((unidad) => <option key={unidad}>{unidad}</option>)}</select><input aria-label="Merma porcentual" className="input" type="number" min="0" max="99" placeholder="Merma %" value={linea.merma_pct} onChange={(event) => setRecetaLineas((actual) => actual.map((fila, posicion) => posicion === indice ? { ...fila, merma_pct: event.target.value } : fila))} /><button className="btn-ghost text-red-300" type="button" onClick={() => setRecetaLineas((actual) => actual.filter((_, posicion) => posicion !== indice))}>Quitar</button></div>)}</div>
      <button className="btn-secondary btn-sm mt-4" type="button" onClick={() => setRecetaLineas((actual) => [...actual, { ingrediente_id: '', cantidad_neta: '', unidad: 'unidad', merma_pct: '0' }])}><Plus className="w-4 h-4" />Agregar ingrediente</button>
    </Modal>
  </div>

  const titulo = modo === 'ingredientes' ? 'Ingredientes' : modo === 'compras' ? 'Compras de ingredientes' : 'Mermas y ajustes'
  const registros = modo === 'ingredientes' ? ingredientes : modo === 'compras' ? compras : mermas

  return <div className="space-y-5">
    <div className="page-header">
      <div><h1 className="page-title">{titulo}</h1><p className="page-subtitle">{registros.length} registros</p></div>
      <div className="flex flex-wrap gap-2">
        {modo === 'ingredientes' && <>
          <input ref={archivoRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => importarArchivo(event.target.files?.[0])} />
          <button className="btn-secondary btn-sm" onClick={descargarPlantilla}><Download className="w-4 h-4" />Plantilla Excel</button>
          <button className="btn-secondary btn-sm" onClick={() => archivoRef.current?.click()} disabled={importando}><FileUp className="w-4 h-4" />{importando ? 'Importando...' : 'Importar Excel'}</button>
        </>}
        <button className="btn-primary btn-sm" onClick={() => setModal(true)}><Plus className="w-4 h-4" />{modo === 'ingredientes' ? 'Nuevo ingrediente' : modo === 'compras' ? 'Registrar compra' : 'Registrar movimiento'}</button>
      </div>
    </div>
    <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
      <thead>{modo === 'ingredientes' ? <tr><th>Ingrediente</th><th>Unidad consumo</th><th>Stock</th><th>Costo unit.</th><th>Reorden</th><th>Estado</th></tr> : modo === 'compras' ? <tr><th>Fecha</th><th>Proveedor</th><th>Factura</th><th>Items</th><th>Total</th><th>Soporte</th></tr> : <tr><th>Fecha</th><th>Ingrediente</th><th>Tipo</th><th>Salida</th><th>Motivo</th></tr>}</thead>
      <tbody>{registros.map((registro: any) => {
        if (modo === 'ingredientes') return <tr key={registro.id}><td><p className="font-medium">{registro.nombre}</p><p className="text-xs text-surface-200/40">{registro.codigo || 'Sin codigo'}</p></td><td>{registro.unidad_consumo}</td><td className={Number(registro.stock_actual) <= Number(registro.stock_minimo) ? 'text-red-400' : 'text-surface-50'}>{Number(registro.stock_actual || 0).toFixed(3)}</td><td>{formatCurrency(registro.costo_unitario || 0)}</td><td>{registro.punto_reorden || registro.stock_minimo || 0}</td><td><span className={registro.activo ? 'badge-green' : 'badge-gray'}>{registro.activo ? 'Activo' : 'Inactivo'}</span></td></tr>
        if (modo === 'compras') return <tr key={registro.id}><td>{formatDate(registro.fecha_compra, 'dd/MM/yy')}</td><td>{registro.proveedor || '-'}</td><td>{registro.numero_factura || '-'}</td><td>{registro.items}</td><td className="font-semibold">{formatCurrency(registro.total)}</td><td>{registro.soporte_url ? <a href={registro.soporte_url} target="_blank" rel="noreferrer" className="text-brand-300 underline">Ver foto</a> : '-'}</td></tr>
        return <tr key={registro.id}><td>{formatDate(registro.created_at, 'dd/MM/yy HH:mm')}</td><td>{registro.ingrediente_nombre}</td><td className="capitalize">{registro.tipo.replace('_', ' ')}</td><td className="text-red-400">-{registro.salida}</td><td>{registro.motivo || '-'}</td></tr>
      })}</tbody>
    </table></div></div>
    <Modal open={modal} onClose={() => setModal(false)} title={modo === 'ingredientes' ? 'Nuevo ingrediente' : modo === 'compras' ? 'Registrar compra' : 'Registrar merma o ajuste'} footer={<div className="flex gap-3"><button className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancelar</button><button className="btn-primary flex-1" onClick={() => guardar.mutate()} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando...' : 'Guardar'}</button></div>}>
      {modo === 'ingredientes' ? <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">Nombre *</label><input className="input" value={ingrediente.nombre} onChange={(event) => setIngrediente((actual) => ({ ...actual, nombre: event.target.value }))} /></div>
        <div><label className="label">Codigo</label><input className="input" value={ingrediente.codigo} onChange={(event) => setIngrediente((actual) => ({ ...actual, codigo: event.target.value }))} /></div>
        <div><label className="label">Categoria</label><input className="input" value={ingrediente.categoria} onChange={(event) => setIngrediente((actual) => ({ ...actual, categoria: event.target.value }))} /></div>
        <div><label className="label">Unidad compra</label><select className="input" value={ingrediente.unidad_compra} onChange={(event) => setIngrediente((actual) => ({ ...actual, unidad_compra: event.target.value }))}>{unidades.map((unidad) => <option key={unidad}>{unidad}</option>)}</select></div>
        <div><label className="label">Unidad consumo</label><select className="input" value={ingrediente.unidad_consumo} onChange={(event) => setIngrediente((actual) => ({ ...actual, unidad_consumo: event.target.value }))}>{unidades.map((unidad) => <option key={unidad}>{unidad}</option>)}</select></div>
        <div><label className="label">Factor conversion</label><input type="number" className="input" value={ingrediente.factor_conversion} onChange={(event) => setIngrediente((actual) => ({ ...actual, factor_conversion: event.target.value }))} /></div>
        <div><label className="label">Stock minimo</label><input type="number" className="input" value={ingrediente.stock_minimo} onChange={(event) => setIngrediente((actual) => ({ ...actual, stock_minimo: event.target.value }))} /></div>
        <div><label className="label">Proveedor principal</label><input className="input" value={ingrediente.proveedor_principal} onChange={(event) => setIngrediente((actual) => ({ ...actual, proveedor_principal: event.target.value }))} /></div>
      </div> : modo === 'compras' ? <div className="space-y-3">
        <div><label className="label">Ingrediente</label><select className="input" value={compra.ingrediente_id} onChange={(event) => setCompra((actual) => ({ ...actual, ingrediente_id: event.target.value }))}><option value="">Seleccionar</option>{ingredientes.map((item: any) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Proveedor</label><input className="input" value={compra.proveedor} onChange={(event) => setCompra((actual) => ({ ...actual, proveedor: event.target.value }))} /></div><div><label className="label">Factura</label><input className="input" value={compra.numero_factura} onChange={(event) => setCompra((actual) => ({ ...actual, numero_factura: event.target.value }))} /></div><div><label className="label">Cantidad comprada</label><input type="number" className="input" value={compra.cantidad_compra} onChange={(event) => setCompra((actual) => ({ ...actual, cantidad_compra: event.target.value }))} /></div><div><label className="label">Factor conversion</label><input type="number" className="input" value={compra.factor_conversion} onChange={(event) => setCompra((actual) => ({ ...actual, factor_conversion: event.target.value }))} /></div><div><label className="label">Valor compra</label><input type="number" className="input" value={compra.precio_unitario} onChange={(event) => setCompra((actual) => ({ ...actual, precio_unitario: event.target.value }))} /></div></div>
        <div><label className="label">Soporte de compra</label><div className="flex flex-wrap items-center gap-2"><input ref={soporteCamaraRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => cargarSoporte(event.target.files?.[0])} /><input ref={soporteArchivoRef} className="hidden" type="file" accept="image/*" onChange={(event) => cargarSoporte(event.target.files?.[0])} /><button className="btn-secondary btn-sm" type="button" disabled={cargandoSoporte} onClick={() => soporteCamaraRef.current?.click()}><Camera className="w-4 h-4" />Tomar foto</button><button className="btn-secondary btn-sm" type="button" disabled={cargandoSoporte} onClick={() => soporteArchivoRef.current?.click()}><FileImage className="w-4 h-4" />Subir archivo</button>{compra.soporte_url && <><a href={compra.soporte_url} target="_blank" rel="noreferrer" className="text-xs text-brand-300 underline">Ver soporte</a><button className="btn-ghost btn-sm text-red-300" type="button" onClick={() => setCompra((actual) => ({ ...actual, soporte_url: '' }))}>Quitar</button></>}</div></div>
      </div> : <div className="space-y-3">
        <div><label className="label">Ingrediente</label><select className="input" value={merma.ingrediente_id} onChange={(event) => setMerma((actual) => ({ ...actual, ingrediente_id: event.target.value }))}><option value="">Seleccionar</option>{ingredientes.map((item: any) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Tipo</label><select className="input" value={merma.tipo} onChange={(event) => setMerma((actual) => ({ ...actual, tipo: event.target.value }))}>{['merma', 'vencido', 'dano', 'derrame', 'consumo_interno', 'cortesia', 'ajuste_positivo', 'ajuste_negativo'].map((tipo) => <option key={tipo}>{tipo}</option>)}</select></div><div><label className="label">Cantidad</label><input type="number" className="input" value={merma.cantidad} onChange={(event) => setMerma((actual) => ({ ...actual, cantidad: event.target.value }))} /></div></div>
        <div><label className="label">Motivo</label><input className="input" value={merma.motivo} onChange={(event) => setMerma((actual) => ({ ...actual, motivo: event.target.value }))} /></div><div><label className="label">Observacion</label><textarea className="input" value={merma.observaciones} onChange={(event) => setMerma((actual) => ({ ...actual, observaciones: event.target.value }))} /></div>
      </div>}
    </Modal>
  </div>
}
