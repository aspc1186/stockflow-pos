import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CheckCircle, X } from 'lucide-react'
import Sidebar from '@/components/navigation/Sidebar'
import TopBar from '@/components/navigation/TopBar'
import { useAuth } from '@/contexts/AuthContext'
export default function DashboardLayout(){
  const [open,setOpen]=useState(false)
  const { user } = useAuth()
  const fondo = user?.empresa?.fondo_url
  const avisoPago = user?.empresa?.notificacion_pago
  const fechaPago = user?.empresa?.notificacion_pago_at
  const [mostrarPago, setMostrarPago] = useState(false)
  const partesFecha = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const fechaHoy = `${partesFecha.find(p=>p.type==='year')?.value}-${partesFecha.find(p=>p.type==='month')?.value}-${partesFecha.find(p=>p.type==='day')?.value}`
  const licenciaVencida = !!user?.empresa?.licencia_fin && String(user.empresa.licencia_fin).slice(0, 10) < fechaHoy
  useEffect(() => {
    if (!avisoPago || !fechaPago) { setMostrarPago(false); return }
    const instantePago = Date.parse(fechaPago)
    const transcurrido = Date.now() - instantePago
    if (!Number.isFinite(instantePago) || transcurrido < 0 || transcurrido >= 15_000) { setMostrarPago(false); return }
    const restante = 15_000 - transcurrido
    setMostrarPago(true)
    const temporizador = window.setTimeout(() => setMostrarPago(false), restante)
    return () => window.clearTimeout(temporizador)
  }, [avisoPago, fechaPago])
  return <div className="app-shell relative flex h-screen overflow-hidden" style={fondo ? { backgroundImage:`linear-gradient(rgba(10,18,35,.82),rgba(10,18,35,.92)), url(${fondo})`, backgroundSize:'cover', backgroundPosition:'center', backgroundAttachment:'fixed' } : undefined}>
    <div className="brand-watermark" aria-hidden="true">{user?.empresa?.nombre}</div>
    <div className="hidden lg:flex flex-shrink-0"><Sidebar/></div>
    {open&&<div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)}/><div className="absolute left-0 top-0 h-full z-50"><Sidebar onClose={()=>setOpen(false)}/></div></div>}
    <div className="relative z-10 flex-1 flex flex-col overflow-hidden"><TopBar onMenuClick={()=>setOpen(true)}/><main className="flex-1 overflow-y-auto p-4 lg:p-6">{licenciaVencida ? <div className="mx-auto mt-12 max-w-xl rounded-lg border border-red-400/40 bg-red-500/15 p-6 text-center text-red-50"><p className="text-lg font-bold">Servicio suspendido por mora</p><p className="mt-2 text-sm text-red-100/80">La licencia venció. Realiza el pago para reactivar el acceso.</p></div> : <>{mostrarPago && <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-emerald-50"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/><div className="flex-1"><p className="font-semibold text-sm">Pago confirmado</p><p className="text-sm text-emerald-100/80">{avisoPago}</p></div><button type="button" className="text-emerald-100/70 hover:text-white" onClick={()=>setMostrarPago(false)} title="Cerrar notificación"><X className="h-4 w-4"/></button></div>}<Outlet/></>}</main></div>
  </div>
}
