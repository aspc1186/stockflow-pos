import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CheckCircle, X } from 'lucide-react'
import Sidebar from '@/components/navigation/Sidebar'
import TopBar from '@/components/navigation/TopBar'
import { useAuth } from '@/contexts/AuthContext'
export default function DashboardLayout(){
  const [open,setOpen]=useState(false)
  const { user } = useAuth()
  const fondo = user?.empresa?.fondo_url
  const [ocultarPago, setOcultarPago] = useState(false)
  const avisoPago = user?.empresa?.notificacion_pago
  return <div className="app-shell relative flex h-screen overflow-hidden" style={fondo ? { backgroundImage:`linear-gradient(rgba(10,18,35,.82),rgba(10,18,35,.92)), url(${fondo})`, backgroundSize:'cover', backgroundPosition:'center', backgroundAttachment:'fixed' } : undefined}>
    <div className="brand-watermark" aria-hidden="true">{user?.empresa?.nombre}</div>
    <div className="hidden lg:flex flex-shrink-0"><Sidebar/></div>
    {open&&<div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)}/><div className="absolute left-0 top-0 h-full z-50"><Sidebar onClose={()=>setOpen(false)}/></div></div>}
    <div className="relative z-10 flex-1 flex flex-col overflow-hidden"><TopBar onMenuClick={()=>setOpen(true)}/><main className="flex-1 overflow-y-auto p-4 lg:p-6">{avisoPago && !ocultarPago && <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-emerald-50"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/><div className="flex-1"><p className="font-semibold text-sm">Pago confirmado</p><p className="text-sm text-emerald-100/80">{avisoPago}</p></div><button type="button" className="text-emerald-100/70 hover:text-white" onClick={()=>setOcultarPago(true)} title="Cerrar notificación"><X className="h-4 w-4"/></button></div>}<Outlet/></main></div>
  </div>
}
