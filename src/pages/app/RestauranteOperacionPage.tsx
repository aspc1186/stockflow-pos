import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileUp, Plus } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '@/lib/axios'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const unidades = ['kilogramo', 'gramo', 'litro', 'mililitro', 'unidad', 'porcion', 'caja', 'bolsa', 'paquete', 'botella', 'lata']

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

export default function RestauranteOperacionPage({ modo }: { modo: Modo }) {
  const queryClient = useQueryClient()
  const archivoRef = useRef<HTMLInputElement>(null)
  const [modal, setModal] = useState(false)
  const [importando, setImportando] = useState(false)
  const [ingrediente, setIngrediente] = useState({
    nombre: '', codigo: '', categoria: '', unidad_compra: 'kilogramo', unidad_consumo: 'gramo',
    factor_conversion: '1000', stock_minimo: '0', stock_maximo: '', punto_reorden: '', proveedor_principal: '',
  })
  const [compra, setCompra] = useState({ proveedor: '', numero_factura: '', ingrediente_id: '', cantidad_compra: '', factor_conversion: '1', precio_unitario: '', transporte: '0' })
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
        const unidadCompra = normalizar(datos.unidadcompra || 'unidad')
        const unidadConsumo = normalizar(datos.unidadconsumo || 'unidad')
        if (!unidades.includes(unidadCompra) || !unidades.includes(unidadConsumo)) {
          throw new Error(`Fila ${indice + 2}: unidad de compra o consumo no valida`)
        }
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

  const guardar = useMutation({
    mutationFn: () => {
      if (modo === 'ingredientes') return api.post('/ingredientes', ingrediente)
      if (modo === 'compras') return api.post('/compras-ingredientes', {
        proveedor: compra.proveedor,
        numero_factura: compra.numero_factura,
        transporte: Number(compra.transporte) || 0,
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
    <div className="page-header"><div><h1 className="page-title">Recetas</h1><p className="page-subtitle">Crea o ajusta la receta desde cada plato.</p></div></div>
    <div className="card overflow-hidden"><table className="table-base"><thead><tr><th>Plato</th><th>Costo actual</th><th>Precio venta</th><th>Margen</th></tr></thead><tbody>{productos.map((producto: any) => {
      const margen = Number(producto.precio_venta || 0) - Number(producto.precio_costo || 0)
      return <tr key={producto.id}><td className="font-medium">{producto.nombre}</td><td>{formatCurrency(producto.precio_costo || 0)}</td><td>{formatCurrency(producto.precio_venta || 0)}</td><td className="text-emerald-400">{formatCurrency(margen)}</td></tr>
    })}</tbody></table></div>
    <p className="text-sm text-surface-200/50">En Productos, crea o edita un plato y agrega sus ingredientes en la seccion de receta.</p>
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
      <thead>{modo === 'ingredientes' ? <tr><th>Ingrediente</th><th>Unidad consumo</th><th>Stock</th><th>Costo unit.</th><th>Reorden</th><th>Estado</th></tr> : modo === 'compras' ? <tr><th>Fecha</th><th>Proveedor</th><th>Factura</th><th>Items</th><th>Total</th></tr> : <tr><th>Fecha</th><th>Ingrediente</th><th>Tipo</th><th>Salida</th><th>Motivo</th></tr>}</thead>
      <tbody>{registros.map((registro: any) => {
        if (modo === 'ingredientes') return <tr key={registro.id}><td><p className="font-medium">{registro.nombre}</p><p className="text-xs text-surface-200/40">{registro.codigo || 'Sin codigo'}</p></td><td>{registro.unidad_consumo}</td><td className={Number(registro.stock_actual) <= Number(registro.stock_minimo) ? 'text-red-400' : 'text-surface-50'}>{Number(registro.stock_actual || 0).toFixed(3)}</td><td>{formatCurrency(registro.costo_unitario || 0)}</td><td>{registro.punto_reorden || registro.stock_minimo || 0}</td><td><span className={registro.activo ? 'badge-green' : 'badge-gray'}>{registro.activo ? 'Activo' : 'Inactivo'}</span></td></tr>
        if (modo === 'compras') return <tr key={registro.id}><td>{formatDate(registro.fecha_compra, 'dd/MM/yy')}</td><td>{registro.proveedor || '-'}</td><td>{registro.numero_factura || '-'}</td><td>{registro.items}</td><td className="font-semibold">{formatCurrency(registro.total)}</td></tr>
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
      </div> : <div className="space-y-3">
        <div><label className="label">Ingrediente</label><select className="input" value={merma.ingrediente_id} onChange={(event) => setMerma((actual) => ({ ...actual, ingrediente_id: event.target.value }))}><option value="">Seleccionar</option>{ingredientes.map((item: any) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Tipo</label><select className="input" value={merma.tipo} onChange={(event) => setMerma((actual) => ({ ...actual, tipo: event.target.value }))}>{['merma', 'vencido', 'dano', 'derrame', 'consumo_interno', 'cortesia', 'ajuste_positivo', 'ajuste_negativo'].map((tipo) => <option key={tipo}>{tipo}</option>)}</select></div><div><label className="label">Cantidad</label><input type="number" className="input" value={merma.cantidad} onChange={(event) => setMerma((actual) => ({ ...actual, cantidad: event.target.value }))} /></div></div>
        <div><label className="label">Motivo</label><input className="input" value={merma.motivo} onChange={(event) => setMerma((actual) => ({ ...actual, motivo: event.target.value }))} /></div><div><label className="label">Observacion</label><textarea className="input" value={merma.observaciones} onChange={(event) => setMerma((actual) => ({ ...actual, observaciones: event.target.value }))} /></div>
      </div>}
    </Modal>
  </div>
}
