import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/navigation/Sidebar'
import TopBar from '@/components/navigation/TopBar'
import { useAuth } from '@/contexts/AuthContext'
export default function DashboardLayout(){
  const [open,setOpen]=useState(false)
  const { user } = useAuth()
  const fondo = user?.empresa?.fondo_url
  return <div className="app-shell relative flex h-screen overflow-hidden" style={fondo ? { backgroundImage:`linear-gradient(rgba(10,18,35,.82),rgba(10,18,35,.92)), url(${fondo})`, backgroundSize:'cover', backgroundPosition:'center', backgroundAttachment:'fixed' } : undefined}>
    <div className="brand-watermark" aria-hidden="true">{user?.empresa?.nombre}</div>
    <div className="hidden lg:flex flex-shrink-0"><Sidebar/></div>
    {open&&<div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)}/><div className="absolute left-0 top-0 h-full z-50"><Sidebar onClose={()=>setOpen(false)}/></div></div>}
    <div className="relative z-10 flex-1 flex flex-col overflow-hidden"><TopBar onMenuClick={()=>setOpen(true)}/><main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet/></main></div>
  </div>
}
