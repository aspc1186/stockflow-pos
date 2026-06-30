import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import api from '@/lib/axios'
import type { OrdenCompra } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

const badge:Record<string,string>={pendiente:'badge-yellow',aprobada:'badge-blue',recibida:'badge-green',cancelada:'badge-red'}

export default function ComprasPage() {
  const qc=useQueryClient()
  const {data:ordenes=[],isLoading}=useQuery({queryKey:['compras'],queryFn:async()=>{const {data}=await api.get<{data:OrdenCompra[]}>('/compras');return data.data}})
  const recibir=useMutation({
    mutationFn:(id:string)=>api.patch(`/compras/${id}`,{estado:'recibida'}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['compras']});qc.invalidateQueries({queryKey:['inventario']});toast.success('Compra recibida — inventario actualizado')},
    onError:()=>toast.error('Error'),
  })
  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Compras</h1><p className="page-subtitle">{ordenes.length} órdenes</p></div>
        <button className="btn-primary"><Plus className="w-4 h-4"/>Nueva orden</button>
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Orden</th><th>Proveedor</th><th>Estado</th><th>Total</th><th>Fecha esperada</th><th></th></tr></thead>
        <tbody>
          {(ordenes as (OrdenCompra&{proveedor_nombre?:string})[]).map(o=>(
            <tr key={o.id}>
              <td className="font-mono text-xs text-surface-200/60">{o.numero??o.id.slice(0,8)}</td>
              <td className="font-medium">{o.proveedor_nombre??'—'}</td>
              <td><span className={badge[o.estado]??'badge-gray'}>{o.estado}</span></td>
              <td className="font-semibold text-brand-400">{formatCurrency(o.total)}</td>
              <td className="text-xs text-surface-200/50">{o.fecha_esperada?formatDate(o.fecha_esperada,'dd/MM/yyyy'):'—'}</td>
              <td>{o.estado==='aprobada'&&<button onClick={()=>recibir.mutate(o.id)} className="text-xs px-2 py-1 rounded font-medium text-emerald-400 hover:bg-emerald-500/10">Recibir</button>}</td>
            </tr>
          ))}
          {ordenes.length===0&&<tr><td colSpan={6} className="text-center py-12 text-surface-200/30">Sin órdenes</td></tr>}
        </tbody>
      </table></div></div>
    </div>
  )
}
