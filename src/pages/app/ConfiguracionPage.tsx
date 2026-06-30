import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import api from '@/lib/axios'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

export default function ConfiguracionPage() {
  const { user, refreshUser } = useAuth()
  const e=user?.empresa as any
  const [form,setForm]=useState({nombre:e?.nombre??'',telefono:e?.telefono??'',email:e?.email??'',ciudad:e?.ciudad??'',tipo:e?.tipo??'restaurante'})
  const guardar=useMutation({
    mutationFn:()=>api.patch(`/empresas/${e?.id}`,form),
    onSuccess:async()=>{await refreshUser();toast.success('Configuración guardada')},
    onError:()=>toast.error('Error al guardar'),
  })
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="page-header"><h1 className="page-title">Configuración</h1></div>
      <div className="card p-6 space-y-5">
        <h3 className="text-sm font-semibold text-surface-200/70 uppercase tracking-wide">Información del negocio</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Nombre del establecimiento</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div><label className="label">Tipo</label><select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>{['restaurante','bar','discoteca','mixto'].map(t=><option key={t} value={t} className="bg-surface-800 capitalize">{t}</option>)}</select></div>
          <div><label className="label">Ciudad</label><input className="input" value={form.ciudad} onChange={e=>setForm(p=>({...p,ciudad:e.target.value}))}/></div>
          <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/></div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></div>
        </div>
        <button onClick={()=>guardar.mutate()} disabled={guardar.isPending} className="btn-primary">
          {guardar.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<><Save className="w-4 h-4"/>Guardar cambios</>}
        </button>
      </div>
    </div>
  )
}
