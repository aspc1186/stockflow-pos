import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/navigation/Sidebar'
import TopBar from '@/components/navigation/TopBar'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar/>
      </div>
      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)}/>
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar onClose={() => setSidebarOpen(false)}/>
          </div>
        </div>
      )}
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)}/>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet/>
        </main>
      </div>
    </div>
  )
}
