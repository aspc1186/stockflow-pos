import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/navigation/Sidebar'
import TopBar from '@/components/navigation/TopBar'
export default function DashboardLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">
      <aside className="hidden lg:flex lg:flex-shrink-0"><Sidebar /></aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 z-10"><Sidebar onClose={()=>setOpen(false)} /></aside>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={()=>setOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6"><div className="max-w-7xl mx-auto animate-fade-in"><Outlet /></div></main>
      </div>
    </div>
  )
}
