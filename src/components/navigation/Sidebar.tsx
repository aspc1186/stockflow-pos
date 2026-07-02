import { NavLink } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, ClipboardList, Package, Users, BarChart3, Settings, CreditCard, UserCheck, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const groups = [
  { label: 'Principal', items: [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [] },
    { to: '/app/mesas', label: 'Mesas', icon: UtensilsCrossed, roles: [] },
    { to: '/app/pedidos', label: 'Pedidos', icon: ClipboardList, roles: [] },
    { to: '/app/caja', label: 'Caja', icon: CreditCard, roles: ['admin','cajero','supervisor'] },
  ]},
  { label: 'Gestión', items: [
    { to: '/app/productos', label: 'Productos', icon: Package, roles: ['admin','supervisor'] },
    { to: '/app/inventario', label: 'Inventario', icon: Package, roles: ['admin','supervisor'] },
    { to: '/app/clientes', label: 'Clientes', icon: UserCheck, roles: [] },
  ]},
  { label: 'Admin', items: [
    { to: '/app/usuarios', label: 'Usuarios', icon: Users, roles: ['admin','supervisor'] },
    { to: '/app/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin','supervisor'] },
    { to: '/app/configuracion', label: 'Configuración', icon: Settings, roles: ['admin'] },
  ]},
]

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, isRole, logout } = useAuth()
  return (
    <div className="w-60 h-full bg-surface-800 border-r border-white/5 flex flex-col">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 32 32" fill="none" className="w-5 h-5">
              <rect x="3" y="8" width="10" height="16" rx="2" fill="white" fillOpacity="0.9"/>
              <rect x="15" y="4" width="14" height="10" rx="2" fill="white" fillOpacity="0.6"/>
              <rect x="15" y="16" width="14" height="8" rx="2" fill="white" fillOpacity="0.8"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{user?.empresa?.nombre ?? 'POS Manager'}</p>
            <p className="text-[10px] text-surface-200/40 capitalize">{user?.empresa?.tipo ?? 'plataforma'}</p>
          </div>
        </div>
        {onClose && <button onClick={onClose} className="p-1 rounded text-surface-200/50 hover:text-white"><X className="w-4 h-4"/></button>}
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-none">
        {groups.map(g => {
          const vis = g.items.filter(i => i.roles.length === 0 || isRole(...i.roles))
          if (!vis.length) return null
          return (
            <div key={g.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-surface-200/30 uppercase tracking-widest">{g.label}</p>
              <div className="space-y-0.5">
                {vis.map(item => (
                  <NavLink key={item.to} to={item.to} onClick={onClose}
                    className={({ isActive }) => cn('sidebar-link', isActive && 'active')}>
                    <item.icon className="w-4 h-4 flex-shrink-0"/>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-brand-600/30 flex items-center justify-center">
            <span className="text-[11px] font-bold text-brand-300">{user?.nombre?.[0] ?? 'U'}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-surface-50 truncate">{user?.nombre}</p>
            <p className="text-[10px] text-surface-200/40 capitalize">{user?.rol}</p>
          </div>
        </div>
        <button onClick={logout} className="sidebar-link w-full text-red-400/60 hover:text-red-400 hover:bg-red-500/10">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
