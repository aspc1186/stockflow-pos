import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, LogOut, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
const nav = [
  { to: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/superadmin/empresas', label: 'Empresas', icon: Building2 },
]
export default function SuperAdminLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">
      <aside className="w-56 flex-shrink-0 bg-surface-800 border-r border-white/5 flex flex-col">
        <div className="p-5 border-b border-white/5 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center"><Shield className="w-4 h-4 text-white" /></div>
          <div><p className="text-sm font-bold text-white">Super Admin</p><p className="text-[10px] text-surface-200/40">POS Manager</p></div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({isActive})=>cn('sidebar-link',isActive&&'active')}><item.icon className="w-4 h-4" />{item.label}</NavLink>)}
        </nav>
        <div className="p-3 border-t border-white/5">
          <div className="px-3 py-2 mb-1"><p className="text-xs font-medium text-surface-50 truncate">{user?.nombre}</p><p className="text-[10px] text-surface-200/40 truncate">{user?.email}</p></div>
          <button onClick={logout} className="sidebar-link w-full text-red-400/70 hover:text-red-400"><LogOut className="w-4 h-4" />Cerrar sesión</button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6"><div className="max-w-6xl mx-auto animate-fade-in"><Outlet /></div></main>
    </div>
  )
}
