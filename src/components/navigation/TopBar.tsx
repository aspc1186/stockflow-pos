import { useRef, useState } from 'react'
import { ImageUp, Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/axios'
import toast from 'react-hot-toast'
export default function TopBar({onMenuClick}:{onMenuClick:()=>void}){
  const {user,isAdmin,refreshUser}=useAuth()
  const inputRef=useRef<HTMLInputElement>(null)
  const [uploading,setUploading]=useState(false)
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
  const logo=user?.empresa?.logo_url
  return <header className="h-14 bg-surface-800 border-b border-white/5 flex items-center justify-between px-4 flex-shrink-0"><button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-surface-200/60"><Menu className="w-5 h-5"/></button><div className="flex-1"/><div className="flex items-center gap-2.5">
    {isAdmin&&<><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>cargarLogo(e.target.files?.[0])}/><button type="button" onClick={()=>inputRef.current?.click()} disabled={uploading} className="btn-ghost btn-sm h-8 w-8 p-0" title="Cambiar logo del negocio"><ImageUp className="h-4 w-4"/></button></>}
    <div className="h-7 w-7 overflow-hidden rounded-full bg-brand-600/30 flex items-center justify-center">{logo?<img src={logo} alt="Logo del negocio" className="h-full w-full object-cover"/>:<span className="text-[11px] font-bold text-brand-300">{user?.nombre?.[0]??'U'}</span>}</div><span className="text-sm text-surface-200/70 hidden sm:block">{user?.nombre}</span></div></header>
}
