import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import api from '@/lib/axios'
import type { Producto, Categoria } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export default function ProductosPage() {
  const qc=useQueryClient()
  const [modal,setModal]=useState(false)
  const [form,setForm]=useState({nombre:'',precio_venta:'',precio_costo:'',categoria_id:'',impuesto_pct:'0',disponible:true,controla_stock:true,destino:'ambos',stock_inicial:'0',stock_minimo:'0'})

  const {data:productos=[],isLoading}=useQuery({queryKey:['productos'],queryFn:async()=>{const {data}=await api.get<{data:Producto[]}>('/productos');return data.data}})
  const {data:cats=[]}=useQuery({queryKey:['categorias'],queryFn:async()=>{const {data}=await api.get<{data:Categoria[]}>('/categorias');return data.data},enabled:modal})

  const crear=useMutation({
    mutationFn:()=>api.post('/productos',{...form,precio_venta:parseFloat(form.precio_venta)||0,precio_costo:parseFloat(form.precio_costo)||0,impuesto_pct:parseFloat(form.impuesto_pct)||0,stock_inicial:parseFloat(form.stock_inicial)||0,stock_minimo:parseFloat(form.stock_minimo)||0,categoria_id:form.categoria_id||undefined}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['productos']});setModal(false);toast.success('Producto creado')},
    onError:(e:any)=>toast.error(e?.response?.data?.message??'Error'),
  })
  const toggle=useMutation({
    mutationFn:({id,disponible}:{id:string;disponible:boolean})=>api.patch(`/productos/${id}`,{disponible}),
    onSuccess:()=>qc.invalidateQueries({queryKey:['productos']}),
  })

  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Productos</h1><p className="page-subtitle">{productos.length} productos</p></div>
        <button onClick={()=>setModal(true)} className="btn-primary"><Plus className="w-4 h-4"/>Nuevo producto</button>
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Destino</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {productos.map(p=>{const pr=p as any;return(
            <tr key={p.id}>
              <td><div><p className="font-medium text-surface-50">{p.nombre}</p>{p.codigo&&<p className="text-xs text-surface-200/40">{p.codigo}</p>}</div></td>
              <td className="text-surface-200/60">{pr.categoria_nombre??'—'}</td>
              <td className="font-semibold text-brand-400">{formatCurrency(p.precio_venta)}</td>
              <td className={cn(pr.stock_actual===0?'text-red-400':'text-surface-200/70')}>{p.controla_stock?(pr.stock_actual??0):'∞'}</td>
              <td><span className="badge-gray capitalize">{p.destino}</span></td>
              <td><span className={p.disponible?'badge-green':'badge-red'}>{p.disponible?'Disponible':'No disponible'}</span></td>
              <td><button onClick={()=>toggle.mutate({id:p.id,disponible:!p.disponible})} className={`text-xs px-2 py-1 rounded font-medium ${p.disponible?'text-red-400 hover:bg-red-500/10':'text-emerald-400 hover:bg-emerald-500/10'}`}>{p.disponible?'Deshabilitar':'Habilitar'}</button></td>
            </tr>
          )})}
          {productos.length===0&&<tr><td colSpan={7} className="text-center py-12 text-surface-200/30">Sin productos</td></tr>}
        </tbody>
      </table></div></div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Nuevo producto" size="lg"
        footer={<div className="flex gap-3"><button onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={()=>crear.mutate()} disabled={crear.isPending||!form.nombre||!form.precio_venta} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear'}</button></div>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div><label className="label">Precio venta *</label><input type="number" min="0" className="input" value={form.precio_venta} onChange={e=>setForm(p=>({...p,precio_venta:e.target.value}))}/></div>
          <div><label className="label">Precio costo</label><input type="number" min="0" className="input" value={form.precio_costo} onChange={e=>setForm(p=>({...p,precio_costo:e.target.value}))}/></div>
          <div><label className="label">Categoría</label><select className="input" value={form.categoria_id} onChange={e=>setForm(p=>({...p,categoria_id:e.target.value}))}><option value="" className="bg-surface-800">Sin categoría</option>{cats.map(c=><option key={c.id} value={c.id} className="bg-surface-800">{c.nombre}</option>)}</select></div>
          <div><label className="label">Destino</label><select className="input" value={form.destino} onChange={e=>setForm(p=>({...p,destino:e.target.value}))}><option value="cocina" className="bg-surface-800">Cocina</option><option value="barra" className="bg-surface-800">Barra</option><option value="ambos" className="bg-surface-800">Ambos</option></select></div>
          <div><label className="label">Impuesto %</label><input type="number" min="0" max="100" className="input" value={form.impuesto_pct} onChange={e=>setForm(p=>({...p,impuesto_pct:e.target.value}))}/></div>
          <div><label className="label">Stock inicial</label><input type="number" min="0" className="input" value={form.stock_inicial} onChange={e=>setForm(p=>({...p,stock_inicial:e.target.value}))}/></div>
          <div><label className="label">Stock mínimo</label><input type="number" min="0" className="input" value={form.stock_minimo} onChange={e=>setForm(p=>({...p,stock_minimo:e.target.value}))}/></div>
        </div>
      </Modal>
    </div>
  )
}
