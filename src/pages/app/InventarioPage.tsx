import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus } from 'lucide-react'
import api from '@/lib/axios'
import Modal from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export default function InventarioPage() {
  const qc = useQueryClient()
  const [critico, setCritico] = useState(false); const [search, setSearch] = useState(''); const [modal, setModal] = useState(false)
  const [form, setForm] = useState({producto_id:'',tipo:'entrada',cantidad:'',notas:''})
  const { data: inv = [], isLoading } = useQuery({
    queryKey: ['inventario',critico,search],
    queryFn: async () => { const p = new URLSearchParams(); if(critico)p.set('critico','true'); if(search)p.set('search',search); const { data } = await api.get<any>(`/inventario?${p}`); return (data.data||data) as any[] },
    refetchInterval: 20_000,
  })
  const { data: productos = [] } = useQuery({ queryKey: ['prods-inv'], queryFn: async () => { const { data } = await api.get<any>('/productos'); return (data.data||data) as any[] }, enabled: modal })
  const ajustar = useMutation({
    mutationFn: () => api.post('/inventario', {...form,cantidad:parseFloat(form.cantidad)||0}),
    onSuccess: () => { qc.invalidateQueries({queryKey:['inventario']}); setModal(false); setForm({producto_id:'',tipo:'entrada',cantidad:'',notas:''}); toast.success('Ajuste registrado') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'Error'),
  })
  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Inventario</h1><p className="page-subtitle">{inv.length} productos</p></div>
        <button onClick={() => setModal(true)} className="btn-primary"><Plus className="w-4 h-4"/>Ajuste</button>
      </div>
      <div className="flex gap-3">
        <input className="input max-w-xs" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}/>
        <button onClick={() => setCritico(v => !v)} className={cn('btn btn-sm',critico?'btn-primary':'btn-secondary')}><AlertTriangle className="w-4 h-4"/>Solo críticos</button>
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Producto</th><th>Stock actual</th><th>Mínimo</th><th>Estado</th></tr></thead>
        <tbody>
          {inv.map((item:any) => { const c = Number(item.stock_actual)<=Number(item.stock_minimo)&&Number(item.stock_minimo)>0; return (
            <tr key={item.producto_id}>
              <td><p className="font-medium text-surface-50">{item.producto_nombre}</p><p className="text-xs text-surface-200/40">{item.codigo}</p></td>
              <td className={cn('font-bold',c?'text-red-400':'text-surface-50')}>{Number(item.stock_actual).toFixed(1)}</td>
              <td className="text-surface-200/60">{Number(item.stock_minimo).toFixed(1)}</td>
              <td>{c?<span className="badge-red">⚠ Crítico</span>:<span className="badge-green">OK</span>}</td>
            </tr>
          )})}
          {inv.length===0&&<tr><td colSpan={4} className="text-center py-12 text-surface-200/30">Sin resultados</td></tr>}
        </tbody>
      </table></div></div>
      <Modal open={modal} onClose={() => setModal(false)} title="Ajuste de inventario" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => ajustar.mutate()} disabled={ajustar.isPending||!form.producto_id||!form.cantidad} className="btn-primary flex-1">{ajustar.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Guardar'}</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Producto *</label><select className="input" value={form.producto_id} onChange={e=>setForm(p=>({...p,producto_id:e.target.value}))}><option value="" className="bg-surface-800">Selecciona un producto</option>{productos.map((p:any)=><option key={p.id} value={p.id} className="bg-surface-800">{p.nombre}</option>)}</select></div>
          <div><label className="label">Tipo</label><select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>{['entrada','salida','ajuste','merma','rotura'].map(t=><option key={t} value={t} className="bg-surface-800 capitalize">{t}</option>)}</select></div>
          <div><label className="label">Cantidad *</label><input type="number" min="0" className="input" value={form.cantidad} onChange={e=>setForm(p=>({...p,cantidad:e.target.value}))}/></div>
          <div><label className="label">Notas</label><input className="input" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))}/></div>
        </div>
      </Modal>
    </div>
  )
}
