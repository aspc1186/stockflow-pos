import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import { GRUPOS_MODULOS, MODULOS_PLATAFORMA, planNormalizado, type ModuloPlataforma } from '@/config/modules.config'
import { useAuth } from '@/contexts/AuthContext'

const nombresPlan: Record<string,string> = { free:'FREE', pro:'PRO', enterprise:'ENTERPRISE / WMS' }

export default function RootPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { startSupport } = useAuth()
  const [empresaId, setEmpresaId] = useState('')
  const { data: empresas = [] } = useQuery({ queryKey:['sa-empresas'], queryFn:async()=>{ const {data}=await api.get<any>('/superadmin/empresas'); return data.data||data } })
  const { data: extras = [] } = useQuery({ queryKey:['sa-root-extras'], queryFn:async()=>{ const {data}=await api.get<any>('/superadmin/root'); return data.data?.extras||[] } })
  const empresa = empresas.find((item:any)=>item.id===empresaId)
  const extrasEmpresa = useMemo(()=>new Set(extras.filter((item:any)=>item.empresa_id===empresaId&&item.activo).map((item:any)=>item.modulo_id)),[extras,empresaId])
  const abrirModulo = useMutation({
    mutationFn: async (modulo:ModuloPlataforma) => {
      if (!empresaId) throw new Error('Selecciona primero una empresa cliente')
      if (!modulo.ruta || !modulo.disponible) throw new Error('Este modulo aun no tiene una pantalla disponible')
      const plan = planNormalizado(empresa?.plan)
      if (!modulo.planes.includes(plan) && !extrasEmpresa.has(modulo.id)) throw new Error('Este modulo no esta incluido en el plan ni como extra de esta empresa')
      await startSupport(empresaId)
      return modulo.ruta
    },
    onSuccess:(ruta)=>navigate(ruta),
    onError:(error:any)=>toast.error(error?.message||'No fue posible abrir el modulo'),
  })
  const cambiarExtra = useMutation({
    mutationFn: ({moduloId,activo}:{moduloId:string;activo:boolean}) => api.patch('/superadmin/root',{empresa_id:empresaId,modulo_id:moduloId,activo}),
    onSuccess:()=>queryClient.invalidateQueries({queryKey:['sa-root-extras']}),
    onError:(error:any)=>toast.error(error?.response?.data?.msg||'No se pudo actualizar el modulo extra'),
  })
  const habilitado = (modulo:ModuloPlataforma) => {
    if (!empresa) return false
    return modulo.disponible && (modulo.planes.includes(planNormalizado(empresa.plan)) || extrasEmpresa.has(modulo.id)) && (!modulo.negocios || modulo.negocios.includes(String(empresa.tipo||'').toLowerCase()))
  }
  return <div className="space-y-5">
    <div className="page-header"><div><h1 className="page-title">ROOT</h1><p className="page-subtitle">Centro tecnico para modulos, planes y soporte de clientes.</p></div><button className="btn-secondary btn-sm" onClick={()=>queryClient.invalidateQueries({queryKey:['sa-empresas']})}><RefreshCw className="w-4 h-4"/>Actualizar empresas</button></div>
    <section className="card overflow-hidden"><div className="border-b border-white/10 px-4 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-surface-50">Modulos de plataforma</h2></div><div className="grid gap-3 p-3 xl:grid-cols-3">{GRUPOS_MODULOS.map(grupo=><div key={grupo} className="rounded-lg border border-brand-500/20 bg-surface-900/30 p-3"><h3 className="mb-3 text-sm font-semibold text-surface-50">{grupo}</h3><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{MODULOS_PLATAFORMA.filter(modulo=>modulo.grupo===grupo).map(modulo=>{const Icon=modulo.icono; const listo=habilitado(modulo); return <button key={modulo.id} type="button" onClick={()=>abrirModulo.mutate(modulo)} disabled={!listo||abrirModulo.isPending} className="flex min-h-14 items-center gap-3 rounded-lg border border-white/10 bg-surface-800/70 px-3 py-2 text-left transition hover:border-brand-400/60 disabled:cursor-not-allowed disabled:opacity-50"><Icon className="h-5 w-5 shrink-0 text-brand-300"/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-surface-50">{modulo.nombre}</span><span className="block text-xs text-surface-200/50">{!modulo.disponible?'Proximamente':listo?'Disponible':empresa?'Bloqueado por plan':'Selecciona empresa'}</span></span>{listo?<ExternalLink className="h-4 w-4 text-surface-200/50"/>:<LockKeyhole className="h-4 w-4 text-surface-200/30"/>}</button>})}</div></div>)}</div></section>
    <section className="card overflow-hidden"><div className="border-b border-white/10 px-4 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-surface-50">Empresa para soporte y modulos extra</h2></div><div className="grid gap-3 p-4 lg:grid-cols-[minmax(280px,1fr)_auto]"><select className="input" value={empresaId} onChange={event=>setEmpresaId(event.target.value)}><option value="">Seleccionar empresa cliente</option>{empresas.map((item:any)=><option value={item.id} key={item.id}>{item.nombre} - {item.plan||'basico'}</option>)}</select>{empresa&&<div className="rounded-lg border border-brand-400/25 bg-brand-500/10 px-3 py-2 text-sm text-brand-100"><ShieldCheck className="mr-2 inline h-4 w-4"/>Plan actual: {nombresPlan[planNormalizado(empresa.plan)]}</div>}</div>{empresaId&&<div className="border-t border-white/10 p-4"><p className="mb-3 text-sm text-surface-200/70">Activa modulos extra para esta empresa. Solo se habilitan si el modulo ya tiene una pantalla disponible.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{MODULOS_PLATAFORMA.filter(modulo=>modulo.disponible && (!modulo.negocios || modulo.negocios.includes(String(empresa?.tipo||'').toLowerCase()))).map(modulo=>{const incluido=modulo.planes.includes(planNormalizado(empresa?.plan)); const extra=extrasEmpresa.has(modulo.id); return <label key={modulo.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-white/10 px-3 text-sm"><input type="checkbox" checked={incluido||extra} disabled={incluido||cambiarExtra.isPending} onChange={event=>cambiarExtra.mutate({moduloId:modulo.id,activo:event.target.checked})}/><span className="flex-1">{modulo.nombre}</span><span className="text-xs text-surface-200/45">{incluido?'Incluido':extra?'Extra':''}</span></label>})}</div></div>}</section>
    <section className="card overflow-hidden"><div className="border-b border-white/10 px-4 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-surface-50">Matriz de planes y accesos</h2></div><div className="overflow-x-auto"><table className="table-base"><thead><tr><th>Modulo o capacidad</th><th>FREE</th><th>PRO</th><th>ENTERPRISE / WMS</th><th>Extra cliente</th></tr></thead><tbody>{MODULOS_PLATAFORMA.filter(modulo=>modulo.disponible).map(modulo=><tr key={modulo.id}><td className="font-medium">{modulo.nombre}</td>{(['free','pro','enterprise'] as const).map(plan=><td key={plan}>{modulo.planes.includes(plan)?<span className="text-emerald-400">Disponible</span>:'-'}</td>)}<td>{modulo.planes.length<3?'Puede activarse':'Incluido'}</td></tr>)}</tbody></table></div></section>
  </div>
}
