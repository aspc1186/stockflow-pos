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
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({nombre:'',telefono:'',email:'',documento:'',tipo_cliente:'regular',notas:''})

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes', search],
    queryFn: async () => {
      const p = search ? `?search=${encodeURIComponent(search)}` : ''
      const { data } = await api.get<any>(`/clientes${p}`)
      return (data.data || data) as Cliente[]
    },
  })

  const crear = useMutation({
    mutationFn: () => api.post('/clientes', form),
    onSuccess: () => { qc.invalidateQueries({queryKey:['clientes']}); setModal(false); setForm({nombre:'',telefono:'',email:'',documento:'',tipo_cliente:'regular',notas:''}); toast.success('Cliente creado') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'Error'),
  })

  if (isLoading) return <PageLoader />
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Clientes</h1><p className="page-subtitle">{clientes.length} clientes</p></div>
        <button onClick={() => setModal(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4"/>Nuevo</button>
      </div>
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30"/>
        <input className="input pl-9" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table-base">
        <thead><tr><th>Cliente</th><th>Teléfono</th><th>Tipo</th><th>Visitas</th><th>Total consumo</th><th>Registro</th></tr></thead>
        <tbody>
          {clientes.map(c => (
            <tr key={c.id}>
              <td><div><p className="font-medium text-surface-50">{c.nombre}</p>{c.email&&<p className="text-xs text-surface-200/40">{c.email}</p>}</div></td>
              <td className="text-surface-200/70">{c.telefono ?? '—'}</td>
              <td><span className="badge-gray capitalize">{c.tipo_cliente ?? 'regular'}</span></td>
              <td className="text-surface-200/70">{c.total_visitas}</td>
              <td className="font-semibold text-brand-400">{formatCurrency(c.total_consumo)}</td>
              <td className="text-xs text-surface-200/50">{formatDate(c.created_at,'dd/MM/yy')}</td>
            </tr>
          ))}
          {clientes.length===0&&<tr><td colSpan={6} className="text-center py-12 text-surface-200/30">Sin clientes</td></tr>}
        </tbody>
      </table></div></div>
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo cliente" size="md"
        footer={<div className="flex gap-3"><button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => crear.mutate()} disabled={crear.isPending||!form.nombre} className="btn-primary flex-1">{crear.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Crear'}</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/></div>
            <div><label className="label">Documento</label><input className="input" value={form.documento} onChange={e=>setForm(p=>({...p,documento:e.target.value}))}/></div>
          </div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></div>
          <div><label className="label">Tipo</label><select className="input" value={form.tipo_cliente} onChange={e=>setForm(p=>({...p,tipo_cliente:e.target.value}))}>{['regular','vip','frecuente','corporativo'].map(t=><option key={t} value={t} className="bg-surface-800 capitalize">{t}</option>)}</select></div>
          <div><label className="label">Notas</label><textarea className="input min-h-[80px]" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))}/></div>
        </div>
      </Modal>
    </div>
  )
}
