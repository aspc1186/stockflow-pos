import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import api from '@/lib/axios'
import type { Cliente } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function ClientesPage() {
  const qc=useQueryClient()
  const [search,setSearch]=useState(''); const [modal,setModal]=useState(false)
  const [form,setForm]=useState({nombre:'',telefono:'',email:'',documento:''})

  const {data:clientes=[],isLoading}=useQuery({
    queryKey:['clientes',search],
    queryFn:async()=>{const {data}=await api.get<{data:Cliente[]}>(`/clientes${search?`?search=${search}`:''}`);return data.data},
  })
  const crear=useMutation({
    mutationFn:()=>api.post('/clientes',form),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['clientes']});setModal(false);setForm({nombre:'',telefono:'',email:'',documento:''});toast.success('Cliente registrado')},
    onError:()=>toast.error('Error'),
  })

  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Clientes</h1><p className="page-subtitle">{clientes.length} clientes</p></div>
        <button onClick={()=>setModal(true)} className="btn-primary"><Plus className="w-4 h-4"/>Nuevo cliente</button>
      </div>
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30"/>
        <input className="input pl-9" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Cliente</th><th>Teléfono</th><th>Visitas</th><th>Total</th><th>Última visita</th></tr></thead>
        <tbody>
          {clientes.map(c=>(
            <tr key={c.id}>
              <td><div><p className="font-medium text-surface-50">{c.nombre}</p>{c.email&&<p className="text-xs text-surface-200/40">{c.email}</p>}</div></td>
              <td className="text-surface-200/70">{c.telefono??'—'}</td>
              <td className="text-surface-200/70">{c.visitas}</td>
              <td className="font-semibold text-brand-400">{formatCurrency(c.total_gastado)}</td>
              <td className="text-xs text-surface-200/50">{c.ultima_visita?formatDate(c.ultima_visita,'dd/MM/yyyy'):'Nunca'}</td>
            </tr>
          ))}
          {clientes.length===0&&<tr><td colSpan={5} className="text-center py-12 text-surface-200/30">Sin clientes</td></tr>}
        </tbody>
      </table></div></div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Nuevo cliente" size="sm"
        footer={<div className="flex gap-3"><button onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={()=>crear.mutate()} disabled={crear.isPending||!form.nombre} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Guardar'}</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/></div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></div>
          <div><label className="label">Documento</label><input className="input" value={form.documento} onChange={e=>setForm(p=>({...p,documento:e.target.value}))}/></div>
        </div>
      </Modal>
    </div>
  )
}
