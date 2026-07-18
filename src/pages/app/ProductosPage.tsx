import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileUp, Plus, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '@/lib/axios'
import type { Producto, Categoria } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

function clave(valor: unknown) {
  return String(valor ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function numero(valor: unknown) {
  if (typeof valor === 'number') return valor
  const texto = String(valor ?? '').trim().replace(/\s/g, '')
  if (!texto) return 0
  if (texto.includes(',') && texto.includes('.')) return Number(texto.replace(/\./g, '').replace(',', '.')) || 0
  return Number(texto.replace(',', '.')) || 0
}

export default function ProductosPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const esRestaurante = ['restaurante','restaurante_bar'].includes(String(user?.empresa?.tipo || ''))
  const [modal, setModal] = useState(false)
  const [productoEliminar, setProductoEliminar] = useState<Producto | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)
  const [form, setForm] = useState({nombre:'',codigo:'',descripcion:'',imagen_url:'',precio_venta:'',precio_costo:'',categoria_id:'',impuesto_pct:'0',impuesto_tipo:'iva',impuesto_incluido:false,unidad_medida:'unidad',disponible:true,controla_stock:true,destino:esRestaurante?'cocina':'barra',stock_inicial:'0',stock_minimo:'0',stock_maximo:''})
  const [receta, setReceta] = useState<{ingrediente_id:string;cantidad:string;unidad:string}[]>([])
  const { data: productos = [], isLoading } = useQuery({ queryKey: ['productos'], queryFn: async () => { const { data } = await api.get<any>('/productos'); return (data.data||data) as Producto[] } })
  const { data: cats = [] } = useQuery({ queryKey: ['categorias'], queryFn: async () => { const { data } = await api.get<any>('/categorias'); return (data.data||data) as Categoria[] } })
  const crear = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<any>('/productos', {...form,precio_venta:parseFloat(form.precio_venta)||0,precio_costo:parseFloat(form.precio_costo)||0,impuesto_pct:parseFloat(form.impuesto_pct)||0,stock_inicial:parseFloat(form.stock_inicial)||0,stock_minimo:parseFloat(form.stock_minimo)||0,stock_maximo:parseFloat(form.stock_maximo)||undefined,categoria_id:form.categoria_id||undefined})
      const creado = data.data || data
      if (esRestaurante && receta.length) await api.put(`/recetas?producto_id=${creado.id}`, {ingredientes:receta.map(item=>({...item,cantidad:Number(item.cantidad)}))})
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:['productos']}); qc.invalidateQueries({queryKey:['inventario']}); setModal(false); setReceta([]); toast.success('Producto creado') },
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
  const descargarPlantilla = () => {
    const hoja = XLSX.utils.json_to_sheet([{ nombre:'Cerveza ejemplo', codigo:'CER-001', precio_venta:8000, precio_costo:6000, categoria:'Cervezas', destino:'barra', impuesto_pct:0, stock_inicial:24, stock_minimo:6, controla_stock:'si' }])
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
        if (!nombre || precioVenta <= 0) return null
        const controla = !['no','false','0'].includes(clave(datos.controlastock || 'si'))
        return { nombre, codigo:String(datos.codigo || '').trim() || undefined, precio_venta:precioVenta, precio_costo:numero(datos.preciocosto), categoria_id:categorias.get(clave(datos.categoria)) || undefined, destino:['barra','cocina','ambos','directo'].includes(clave(datos.destino)) ? clave(datos.destino) : 'barra', impuesto_pct:numero(datos.impuestopct), stock_inicial:numero(datos.stockinicial), stock_minimo:numero(datos.stockminimo), controla_stock:controla, disponible:true }
      }).filter(Boolean) as any[]
      if (!validas.length) throw new Error('No hay filas validas. Se requiere nombre y precio_venta mayor que cero.')
      const resultados = await Promise.allSettled(validas.map(producto => api.post('/productos', producto)))
      const creados = resultados.filter(resultado => resultado.status === 'fulfilled').length
      const fallidos = resultados.length - creados
      qc.invalidateQueries({queryKey:['productos']}); qc.invalidateQueries({queryKey:['inventario']})
      toast.success(`${creados} productos importados${fallidos ? `, ${fallidos} con error` : ''}`)
    } catch (e:any) { toast.error(e?.message || 'No se pudo leer el archivo Excel') }
    finally { setImportando(false); if (archivoRef.current) archivoRef.current.value = '' }
  }
  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Productos</h1><p className="page-subtitle">{productos.length} productos</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={descargarPlantilla} className="btn-secondary btn-sm"><Download className="w-4 h-4"/>Plantilla Excel</button><button onClick={() => archivoRef.current?.click()} disabled={importando} className="btn-secondary btn-sm"><FileUp className="w-4 h-4"/>{importando ? 'Importando...' : 'Importar Excel'}</button><button onClick={() => setModal(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Nuevo producto</button></div>
      </div>
      <input ref={archivoRef} className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={e => importarArchivo(e.target.files?.[0])}/>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Destino</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {productos.map(p => { const pr = p as any; return (
            <tr key={p.id}>
              <td><div><p className="font-medium text-surface-50">{p.nombre}</p>{p.codigo&&<p className="text-xs text-surface-200/40">{p.codigo}</p>}</div></td>
              <td className="text-surface-200/60">{pr.categoria_nombre ?? '—'}</td>
              <td className="font-semibold text-brand-400">{formatCurrency(p.precio_venta)}</td>
              <td className={cn(pr.stock_actual===0?'text-red-400':'text-surface-200/70')}>{p.controla_stock?(pr.stock_actual??0):'∞'}</td>
              <td><span className="badge-gray capitalize">{p.destino}</span></td>
              <td><span className={p.disponible?'badge-green':'badge-red'}>{p.disponible?'Disponible':'No disponible'}</span></td>
              <td><div className="flex items-center justify-end gap-1"><button onClick={() => toggle.mutate({id:p.id,disponible:!p.disponible})} className={`text-xs px-2 py-1 rounded font-medium ${p.disponible?'text-red-400 hover:bg-red-500/10':'text-emerald-400 hover:bg-emerald-500/10'}`}>{p.disponible?'Deshabilitar':'Habilitar'}</button><button onClick={() => setProductoEliminar(p)} className="btn-ghost btn-sm text-red-400 hover:bg-red-500/10" title="Eliminar producto"><Trash2 className="w-4 h-4"/></button></div></td>
            </tr>
          )})}
          {productos.length===0&&<tr><td colSpan={7} className="text-center py-12 text-surface-200/30">Sin productos</td></tr>}
        </tbody>
      </table></div></div>
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo producto" size="lg"
        footer={<div className="flex gap-3"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => crear.mutate()} disabled={crear.isPending||!form.nombre||!form.precio_venta} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear'}</button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-2"><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div><label className="label">Codigo</label><input className="input" placeholder="Ej: PLA-001" value={form.codigo} onChange={e=>setForm(p=>({...p,codigo:e.target.value}))}/></div>
          <div><label className="label">Unidad</label><select className="input" value={form.unidad_medida} onChange={e=>setForm(p=>({...p,unidad_medida:e.target.value}))}>{['unidad','gramo','kilogramo','mililitro','litro','porcion'].map(unidad=><option key={unidad} value={unidad}>{unidad}</option>)}</select></div>
          <div className="col-span-2"><label className="label">Descripcion</label><textarea className="input min-h-20" value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} placeholder={esRestaurante ? 'Ingredientes, preparacion o alergenos' : 'Presentacion o detalle del producto'}/></div>
          <div className="col-span-2"><label className="label">URL de imagen</label><input className="input" value={form.imagen_url} onChange={e=>setForm(p=>({...p,imagen_url:e.target.value}))} placeholder="https://..."/></div>
          <div><label className="label">Precio venta *</label><input type="number" min="0" className="input" value={form.precio_venta} onChange={e=>setForm(p=>({...p,precio_venta:e.target.value}))}/></div>
          <div><label className="label">Precio costo</label><input type="number" min="0" className="input" value={form.precio_costo} onChange={e=>setForm(p=>({...p,precio_costo:e.target.value}))}/></div>
          <div><label className="label">Categoría</label><select className="input" value={form.categoria_id} onChange={e=>setForm(p=>({...p,categoria_id:e.target.value}))}><option value="" className="bg-surface-800">Sin categoría</option>{cats.map(c=><option key={c.id} value={c.id} className="bg-surface-800">{c.nombre}</option>)}</select></div>
          <div><label className="label">Destino</label><select className="input" value={form.destino} onChange={e=>setForm(p=>({...p,destino:e.target.value}))}><option value="barra" className="bg-surface-800">Barra</option><option value="cocina" className="bg-surface-800">Cocina</option><option value="ambos" className="bg-surface-800">Ambos</option><option value="directo" className="bg-surface-800">Directo</option></select></div>
          <div><label className="label">Impuesto</label><div className="flex gap-2"><select className="input w-24" value={form.impuesto_tipo} onChange={e=>setForm(p=>({...p,impuesto_tipo:e.target.value}))}><option value="iva">IVA</option><option value="inc">INC</option><option value="ninguno">Ninguno</option></select><input type="number" min="0" max="100" className="input" value={form.impuesto_pct} onChange={e=>setForm(p=>({...p,impuesto_pct:e.target.value}))}/></div></div>
          <div><label className="label">Stock inicial</label><input type="number" min="0" className="input" value={form.stock_inicial} onChange={e=>setForm(p=>({...p,stock_inicial:e.target.value}))}/></div>
          <div><label className="label">Stock mínimo</label><input type="number" min="0" className="input" value={form.stock_minimo} onChange={e=>setForm(p=>({...p,stock_minimo:e.target.value}))}/></div>
          <div><label className="label">Stock maximo</label><input type="number" min="0" className="input" value={form.stock_maximo} onChange={e=>setForm(p=>({...p,stock_maximo:e.target.value}))}/></div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-surface-200/70"><input type="checkbox" checked={form.controla_stock} onChange={e=>setForm(p=>({...p,controla_stock:e.target.checked}))}/>Controlar inventario</label>
          <label className="col-span-2 flex items-center gap-2 text-sm text-surface-200/70"><input type="checkbox" checked={form.impuesto_incluido} onChange={e=>setForm(p=>({...p,impuesto_incluido:e.target.checked}))}/>El precio ya incluye el impuesto</label>
        </div>
        {esRestaurante && <div className="mt-5 border-t border-white/10 pt-4"><div className="mb-3"><h4 className="text-sm font-semibold">Receta e ingredientes</h4><p className="text-xs text-surface-200/45">Al vender este plato se descuenta la cantidad indicada de cada ingrediente.</p></div><div className="space-y-2">{receta.map((item, indice)=><div key={indice} className="grid grid-cols-[1fr_85px_90px_auto] gap-2"><select className="input" value={item.ingrediente_id} onChange={e=>setReceta(lista=>lista.map((fila,i)=>i===indice?{...fila,ingrediente_id:e.target.value}:fila))}><option value="">Ingrediente</option>{productos.map(producto=><option key={producto.id} value={producto.id}>{producto.nombre}</option>)}</select><input className="input" type="number" min="0" step="0.001" placeholder="Cant." value={item.cantidad} onChange={e=>setReceta(lista=>lista.map((fila,i)=>i===indice?{...fila,cantidad:e.target.value}:fila))}/><select className="input" value={item.unidad} onChange={e=>setReceta(lista=>lista.map((fila,i)=>i===indice?{...fila,unidad:e.target.value}:fila))}>{['unidad','gramo','kilogramo','mililitro','litro','porcion'].map(unidad=><option key={unidad}>{unidad}</option>)}</select><button type="button" className="btn-ghost text-red-300" onClick={()=>setReceta(lista=>lista.filter((_,i)=>i!==indice))}>Quitar</button></div>)}</div><button type="button" className="btn-secondary btn-sm mt-3" onClick={()=>setReceta(lista=>[...lista,{ingrediente_id:'',cantidad:'',unidad:'unidad'}])}>Agregar ingrediente</button></div>}
      </Modal>
      <Modal open={!!productoEliminar} onClose={() => setProductoEliminar(null)} title="Eliminar producto" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setProductoEliminar(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => eliminar.mutate()} disabled={eliminar.isPending} className="btn-danger flex-1">{eliminar.isPending ? 'Eliminando...' : <><Trash2 className="w-4 h-4"/>Eliminar</>}</button></div>}>
        <p className="text-sm text-surface-200/70">Eliminarás <strong className="text-surface-50">{productoEliminar?.nombre}</strong>. Quedará fuera de nuevas ventas, pero se conservará su historial de pedidos e inventario.</p>
      </Modal>
    </div>
  )
}
