import { useRef, useState } from 'react'
import { Building2, ChevronDown, ImageUp, Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/axios'
import toast from 'react-hot-toast'
export default function TopBar({onMenuClick}:{onMenuClick:()=>void}){
  const {user,isAdmin,refreshUser}=useAuth()
  const inputRef=useRef<HTMLInputElement>(null)
  const [uploading,setUploading]=useState(false)
  const [clientOpen,setClientOpen]=useState(false)
  const cargarLogo=(archivo?:File)=>{
    if(!archivo) return
    if(!archivo.type.startsWith('image/')) return toast.error('Selecciona un archivo de imagen')
    if(archivo.size>1500*1024) return toast.error('El logo debe pesar menos de 1.5 MB')
    const reader=new FileReader()
    setUploading(true)
    reader.onload=async()=>{
      try {
        await api.patch(`/empresas/${user?.empresa?.id}`,{logo_url:String(reader.result||'')})
        await refreshUser()
        toast.success('Logo del negocio actualizado')
      } catch(e:any) { toast.error(e?.response?.data?.msg??'No se pudo guardar el logo') }
      finally { setUploading(false); if(inputRef.current) inputRef.current.value='' }
    }
    reader.onerror=()=>{setUploading(false);toast.error('No se pudo leer la imagen')}
    reader.readAsDataURL(archivo)
  }
  const empresa=user?.empresa
  const logo=empresa?.logo_url
  return <header className="relative flex h-14 flex-shrink-0 items-center justify-between border-b border-white/5 bg-surface-800 px-4"><button onClick={onMenuClick} className="rounded-lg p-2 text-surface-200/60 hover:bg-white/5 lg:hidden"><Menu className="w-5 h-5"/></button><div className="flex-1"/><div className="flex items-center gap-2.5">
    <span className="hidden text-sm text-surface-200/60 sm:block">{user?.nombre}</span>
    <button type="button" onClick={()=>setClientOpen(!clientOpen)} aria-expanded={clientOpen} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white/5" title="Informacion del negocio">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-600/30">{logo?<img src={logo} alt="Logo del negocio" className="h-full w-full object-cover"/>:<span className="text-[11px] font-bold text-brand-300">{empresa?.nombre?.[0]??'E'}</span>}</div>
      <span className="hidden max-w-32 truncate text-xs font-medium text-surface-100 md:block">{empresa?.nombre??'Mi negocio'}</span>
      <ChevronDown className={clientOpen?'h-3.5 w-3.5 rotate-180 text-surface-200/50 transition-transform':'h-3.5 w-3.5 text-surface-200/50 transition-transform'}/>
    </button>
  </div>
  {clientOpen&&<div className="absolute right-4 top-12 z-30 w-72 rounded-lg border border-white/10 bg-surface-800 p-3 shadow-2xl">
    <div className="flex items-center gap-3 border-b border-white/10 pb-3">
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-600/20">{logo?<img src={logo} alt="Logo del negocio" className="h-full w-full object-cover"/>:<Building2 className="h-6 w-6 text-brand-300"/>}</div>
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{empresa?.nombre??'Mi negocio'}</p><p className="mt-0.5 text-xs capitalize text-surface-200/50">{empresa?.tipo?.replace(/_/g,' ')??'Negocio'}</p></div>
    </div>
    <div className="space-y-1.5 py-3 text-xs text-surface-200/60">
      {empresa?.ciudad&&<p>{empresa.ciudad}</p>}
      {empresa?.telefono&&<p>{empresa.telefono}</p>}
      {empresa?.email&&<p className="truncate">{empresa.email}</p>}
      {!empresa?.ciudad&&!empresa?.telefono&&!empresa?.email&&<p>Informacion del negocio pendiente de completar.</p>}
    </div>
    {isAdmin&&<><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>cargarLogo(e.target.files?.[0])}/><button type="button" onClick={()=>inputRef.current?.click()} disabled={uploading} className="btn-secondary btn-sm w-full justify-center"><ImageUp className="h-4 w-4"/>{uploading?'Guardando logo...':'Cambiar logo del negocio'}</button></>}
  </div>}
  </header>
}
