import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/navigation/Sidebar'
import TopBar from '@/components/navigation/TopBar'
export default function DashboardLayout(){
  const [open,setOpen]=useState(false)
  return <div className="flex h-screen bg-surface-900 overflow-hidden">
    <div className="hidden lg:flex flex-shrink-0"><Sidebar/></div>
    {open&&<div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)}/><div className="absolute left-0 top-0 h-full z-50"><Sidebar onClose={()=>setOpen(false)}/></div></div>}
    <div className="flex-1 flex flex-col overflow-hidden"><TopBar onMenuClick={()=>setOpen(true)}/><main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet/></main></div>
  </div>
}
