import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import api from '@/lib/axios'
import type { OrdenCompra, Proveedor } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

const badge: Record<string,string> = {pendiente:'badge-yellow',aprobada:'badge-blue',recibida:'badge-green',cancelada:'badge-red'}

export default function ComprasPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({proveedor_id:'',notas:'',fecha_esperada:''})

  const { data: ordenes = [], isLoading } = useQuery({
    queryKey: ['compras'],
    queryFn: async () => { const { data } = await api.get<any>('/compras'); return (data.data||data) as OrdenCompra[] }
  })
  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores'],
    queryFn: async () => { const { data } = await api.get<any>('/proveedores'); return (data.data||data) as Proveedor[] },
    enabled: modal,
  })
  const crear = useMutation({
    mutationFn: () => api.post('/compras', form),
    onSuccess: () => { qc.invalidateQueries({queryKey:['compras']}); setModal(false); toast.success('Orden creada') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'Error'),
  })

  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Compras</h1><p className="page-subtitle">{ordenes.length} órdenes</p></div>
        <button onClick={() => setModal(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Nueva orden</button>
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Proveedor</th><th>Estado</th><th>Total</th><th>Fecha esperada</th><th>Creada</th></tr></thead>
        <tbody>
          {ordenes.map(o => { const r = o as any; return (
            <tr key={o.id}>
              <td className="font-medium text-surface-50">{r.proveedor_nombre ?? '—'}</td>
              <td><span className={badge[o.estado]}>{o.estado}</span></td>
              <td className="font-semibold text-brand-400">{formatCurrency(o.total)}</td>
              <td className="text-surface-200/60 text-xs">{o.fecha_esperada ? formatDate(o.fecha_esperada,'dd/MM/yy') : '—'}</td>
              <td className="text-surface-200/50 text-xs">{formatDate(o.created_at,'dd/MM/yy')}</td>
            </tr>
          )})}
          {ordenes.length===0&&<tr><td colSpan={5} className="text-center py-12 text-surface-200/30">Sin órdenes de compra</td></tr>}
        </tbody>
      </table></div></div>
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva orden de compra" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => crear.mutate()} disabled={crear.isPending} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear'}</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Proveedor</label><select className="input" value={form.proveedor_id} onChange={e=>setForm(p=>({...p,proveedor_id:e.target.value}))}><option value="" className="bg-surface-800">Sin proveedor</option>{proveedores.map(p=><option key={p.id} value={p.id} className="bg-surface-800">{p.nombre}</option>)}</select></div>
          <div><label className="label">Fecha esperada</label><input type="date" className="input" value={form.fecha_esperada} onChange={e=>setForm(p=>({...p,fecha_esperada:e.target.value}))}/></div>
          <div><label className="label">Notas</label><textarea className="input" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))}/></div>
        </div>
      </Modal>
    </div>
  )
}
