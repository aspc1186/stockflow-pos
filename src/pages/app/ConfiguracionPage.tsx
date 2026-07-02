import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import api from '@/lib/axios'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

export default function ConfiguracionPage() {
  const { user, refreshUser } = useAuth()
  const empresa = user?.empresa as any
  const [form, setForm] = useState({ nombre:empresa?.nombre??'', telefono:empresa?.telefono??'', email:empresa?.email??'', ciudad:empresa?.ciudad??'', tipo:empresa?.tipo??'bar' })
  const guardar = useMutation({
    mutationFn: () => api.patch(`/empresas/${empresa?.id}`, form),
    onSuccess: async () => { await refreshUser(); toast.success('Configuración guardada') },
    onError: () => toast.error('Error al guardar'),
  })
  if (!empresa) return <div className="flex items-center justify-center h-64"><p className="text-surface-200/40">Sin empresa configurada</p></div>
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="page-header"><h1 className="page-title">Configuración</h1></div>
      <div className="card p-6 space-y-5">
        <h3 className="text-sm font-semibold text-surface-200/70 uppercase tracking-wide">Información del negocio</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div><label className="label">Tipo</label><select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>{['bar','discoteca','bar_discoteca','restaurante_bar','restaurante'].map(t=><option key={t} value={t} className="bg-surface-800 capitalize">{t.replace('_',' ')}</option>)}</select></div>
          <div><label className="label">Ciudad</label><input className="input" value={form.ciudad} onChange={e=>setForm(p=>({...p,ciudad:e.target.value}))}/></div>
          <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/></div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></div>
        </div>
        <button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="btn-primary">
          {guardar.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<><Save className="w-4 h-4"/>Guardar cambios</>}
        </button>
      </div>
    </div>
  )
}
