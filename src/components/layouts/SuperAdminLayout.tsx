import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Building2, LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

export default function SuperAdminLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="flex h-screen bg-surface-900">
      <div className="w-56 bg-surface-800 border-r border-white/5 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 32 32" fill="none" className="w-5 h-5"><rect x="3" y="8" width="10" height="16" rx="2" fill="white" fillOpacity="0.9"/><rect x="15" y="4" width="14" height="10" rx="2" fill="white" fillOpacity="0.6"/><rect x="15" y="16" width="14" height="8" rx="2" fill="white" fillOpacity="0.8"/></svg>
            </div>
            <div><p className="text-sm font-bold text-white">Super Admin</p><p className="text-[10px] text-surface-200/40">Control total</p></div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            {to:'/superadmin',label:'Dashboard',icon:LayoutDashboard,end:true},
            {to:'/superadmin/empresas',label:'Empresas',icon:Building2,end:false},
          ].map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({isActive}) => cn('sidebar-link', isActive && 'active')}>
              <item.icon className="w-4 h-4 flex-shrink-0"/>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-brand-600/30 flex items-center justify-center"><span className="text-[11px] font-bold text-brand-300">{user?.nombre?.[0]??'S'}</span></div>
            <div className="min-w-0"><p className="text-xs font-medium text-surface-50 truncate">{user?.nombre}</p><p className="text-[10px] text-surface-200/40">Superadmin</p></div>
          </div>
          <button onClick={logout} className="sidebar-link w-full text-red-400/60 hover:text-red-400 hover:bg-red-500/10">
            <LogOut className="w-4 h-4"/>Cerrar sesión
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6"><Outlet/></div>
    </div>
  )
}
