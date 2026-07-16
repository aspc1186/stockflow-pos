import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Plus } from 'lucide-react'
import api from '@/lib/axios'
import Modal from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { cn, formatCurrency } from '@/lib/utils'

export default function InventarioPage() {
  const qc = useQueryClient()
  const [critico, setCritico] = useState(false)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({producto_id:'',tipo:'entrada',cantidad:'',costo_unit:'',notas:''})
  const { data: inventarioData, isLoading } = useQuery({
    queryKey: ['inventario',critico,search],
    queryFn: async () => { const p = new URLSearchParams(); if(critico)p.set('critico','true'); if(search)p.set('search',search); const { data } = await api.get<any>(`/inventario?${p}`); return (data.data || data) as any[] },
    refetchInterval: 20_000,
  })
  const { data: productos = [] } = useQuery({ queryKey: ['prods-inv'], queryFn: async () => { const { data } = await api.get<any>('/productos'); return (data.data||data) as any[] }, enabled: modal })
  const ajustar = useMutation({
    mutationFn: () => api.post('/inventario', {...form,cantidad:parseFloat(form.cantidad)||0,costo_unit:form.costo_unit?parseFloat(form.costo_unit):undefined}),
    onSuccess: () => { qc.invalidateQueries({queryKey:['inventario']}); setModal(false); setForm({producto_id:'',tipo:'entrada',cantidad:'',costo_unit:'',notas:''}); toast.success('Movimiento registrado') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'Error'),
  })
  const descargarMovimientos = async () => {
    try {
      const { data } = await api.get<any>('/inventario?movimientos=true')
      const filas = (data.data || data) as any[]
      const escapar = (valor: unknown) => `"${String(valor ?? '').replace(/"/g, '""')}"`
      const contenido = [['Fecha','Producto','Tipo','Cantidad','Stock antes','Stock despues','Usuario','Notas'], ...filas.map(fila => [new Date(fila.created_at).toLocaleString('es-CO'),fila.producto,fila.tipo,fila.cantidad,fila.stock_antes,fila.stock_despues,fila.usuario,fila.notas])].map(fila => fila.map(escapar).join(';')).join('\n')
      const url = URL.createObjectURL(new Blob([`\uFEFF${contenido}`], {type:'text/csv;charset=utf-8'})); const enlace=document.createElement('a'); enlace.href=url; enlace.download='movimientos_inventario.csv'; enlace.click(); URL.revokeObjectURL(url)
    } catch { toast.error('No se pudieron descargar los movimientos') }
  }
  if (isLoading) return <PageLoader />
  const inv = inventarioData || []
  const valorTotal = inv.reduce((s:any, item:any) => s + Number(item.valor_costo || 0), 0)
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Inventario</h1><p className="page-subtitle">Valor total a costo: {formatCurrency(valorTotal)} - Saldo actual despues de ventas y salidas</p></div>
        <div className="flex gap-2"><button onClick={descargarMovimientos} className="btn-secondary btn-sm"><Download className="w-4 h-4"/>Movimientos</button><button onClick={() => setModal(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Movimiento</button></div>
      </div>
      <div className="flex gap-3">
        <input className="input max-w-xs" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}/>
        <button onClick={() => setCritico(v => !v)} className={cn('btn btn-sm',critico?'btn-primary':'btn-secondary')}><AlertTriangle className="w-4 h-4"/>Solo criticos</button>
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Producto</th><th>Saldo actual</th><th>Salidas hoy</th><th>Minimo</th><th>Costo unit.</th><th>Valor costo</th><th>Venta</th><th>Margen</th><th>Ult. salida</th><th>Estado</th></tr></thead>
        <tbody>
          {inv.map((item:any) => { const c = Number(item.stock_actual)<=Number(item.stock_minimo)&&Number(item.stock_minimo)>0; return (
            <tr key={item.producto_id}>
              <td><p className="font-medium text-surface-50">{item.producto_nombre}</p><p className="text-xs text-surface-200/40">{item.codigo}</p></td>
              <td className={cn('font-bold',c?'text-red-400':'text-surface-50')}>{Number(item.stock_actual).toFixed(1)}</td>
              <td className="font-semibold text-red-400">-{Number(item.salidas_hoy || 0).toFixed(1)}</td>
              <td className="text-surface-200/60">{Number(item.stock_minimo).toFixed(1)}</td>
              <td>{formatCurrency(item.precio_costo || 0)}</td>
              <td className="font-semibold text-surface-50">{formatCurrency(item.valor_costo || 0)}</td>
              <td>{formatCurrency(item.precio_venta || 0)}</td>
              <td className={Number(item.margen_unitario) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(item.margen_unitario || 0)}</td>
              <td className="text-xs text-surface-200/60">{item.ultima_salida_at ? new Date(item.ultima_salida_at).toLocaleString('es-CO') : '-'}</td>
              <td>{c?<span className="badge-red">Critico</span>:<span className="badge-green">OK</span>}</td>
            </tr>
          )})}
          {inv.length===0&&<tr><td colSpan={10} className="text-center py-12 text-surface-200/30">Sin resultados</td></tr>}
        </tbody>
      </table></div></div>
      <Modal open={modal} onClose={() => setModal(false)} title="Movimiento de inventario" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => ajustar.mutate()} disabled={ajustar.isPending||!form.producto_id||!form.cantidad} className="btn-primary flex-1">{ajustar.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Guardar'}</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Producto *</label><select className="input" value={form.producto_id} onChange={e=>setForm(p=>({...p,producto_id:e.target.value}))}><option value="" className="bg-surface-800">Selecciona un producto</option>{productos.map((p:any)=><option key={p.id} value={p.id} className="bg-surface-800">{p.nombre}</option>)}</select></div>
          <div><label className="label">Tipo</label><select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>{['entrada','compra','salida','ajuste','merma','rotura'].map(t=><option key={t} value={t} className="bg-surface-800 capitalize">{t}</option>)}</select></div>
          <div><label className="label">Cantidad *</label><input type="number" min="0" className="input" value={form.cantidad} onChange={e=>setForm(p=>({...p,cantidad:e.target.value}))}/></div>
          <div><label className="label">Costo unitario</label><input type="number" min="0" className="input" placeholder="Solo si cambia el costo" value={form.costo_unit} onChange={e=>setForm(p=>({...p,costo_unit:e.target.value}))}/></div>
          <div><label className="label">Notas</label><input className="input" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))}/></div>
        </div>
      </Modal>
    </div>
  )
}
