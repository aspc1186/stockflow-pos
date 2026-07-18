import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, ClipboardList, Package, Users, BarChart3, Settings, CreditCard, X, ChevronDown, Phone, ContactRound, Plug, CookingPot, ShoppingCart, BadgeAlert, BookOpen } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
const groups=[
  {label:'Principal',items:[
    {to:'/app/dashboard',label:'Dashboard',icon:LayoutDashboard,roles:[]},
    {to:'/app/mesas',label:'Mesas',icon:UtensilsCrossed,roles:[]},
    {to:'/app/pedidos',label:'Pedidos',icon:ClipboardList,roles:[]},
    {to:'/app/caja',label:'Caja',icon:CreditCard,roles:['admin','cajero','supervisor']},
  ]},
  {label:'Gestión',items:[
    {to:'/app/productos',label:'Productos',icon:Package,roles:['admin','supervisor']},
    {to:'/app/inventario',label:'Inventario',icon:Package,roles:['admin','supervisor']},
    {to:'/app/clientes',label:'Clientes',icon:ContactRound,roles:['admin','supervisor']},
  ]},
  {label:'Admin',items:[
    {to:'/app/usuarios',label:'Usuarios',icon:Users,roles:['admin','supervisor']},
    {to:'/app/reportes',label:'Reportes',icon:BarChart3,roles:['admin','supervisor']},
    {to:'/app/configuracion',label:'Configuración',icon:Settings,roles:['admin']},
    {to:'/app/integraciones',label:'Integraciones ERP',icon:Plug,roles:['admin','supervisor']},
  ]},
]
export default function Sidebar({onClose}:{onClose?:()=>void}){
  const {user,isRole,logout}=useAuth()
  const esRestaurante = String(user?.empresa?.tipo || '').toLowerCase() === 'restaurante'
  const [providerOpen,setProviderOpen]=useState(false)
  return <div className="w-60 h-full bg-surface-800 border-r border-white/5 flex flex-col">
    <div className="relative border-b border-white/5">
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" onClick={()=>setProviderOpen(!providerOpen)} aria-expanded={providerOpen} className="flex min-w-0 items-center gap-2.5 text-left" title="Informacion de StockFlow">
            <span className="h-8 w-8 flex-shrink-0 rounded-lg border border-brand-400/30 bg-surface-950 bg-[url('/images/stockflow-login.png')] bg-[length:158px_auto] bg-center shadow-sm" aria-hidden="true" />
            <span className="min-w-0"><span className="block text-sm font-bold leading-tight text-white">StockFlow POS</span><span className="block text-[10px] text-surface-200/40">Proveedor del sistema</span></span>
            <ChevronDown className={cn('h-3.5 w-3.5 flex-shrink-0 text-surface-200/40 transition-transform',providerOpen&&'rotate-180')} />
        </button>
      </div>
      {providerOpen&&<div className="mx-3 mb-3 rounded-lg border border-white/10 bg-surface-900/70 px-3 py-2.5 text-xs">
        <img src="/images/stockflow-login.png" alt="StockFlow POS" className="mb-2 h-20 w-full rounded-md bg-surface-950 object-contain" />
        <p className="mb-1.5 font-semibold text-surface-50">StockFlow POS <span className="font-normal text-surface-200/40">V.01</span></p>
        <p className="text-surface-200/60">Creador: John F. Diaz</p>
        <a href="tel:+573189758780" className="mt-1 flex items-center gap-1.5 text-brand-300 hover:text-brand-200"><Phone className="h-3.5 w-3.5"/>318 975 8780</a>
      </div>}
      {onClose&&<button onClick={onClose} className="absolute right-3 top-3 rounded p-1 text-surface-200/50 hover:text-white"><X className="w-4 h-4"/></button>}
    </div>
    <nav className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-none">
      {groups.map(g=>{
        const vis=g.items.filter(i=>i.roles.length===0||isRole(...i.roles))
        if(!vis.length) return null
        return <div key={g.label}><p className="px-3 mb-1.5 text-[10px] font-semibold text-surface-200/30 uppercase tracking-widest">{g.label}</p><div className="space-y-0.5">{vis.map(item=><NavLink key={item.to} to={item.to} onClick={onClose} className={({isActive})=>cn('sidebar-link',isActive&&'active')}><item.icon className="w-4 h-4 flex-shrink-0"/><span className="truncate">{item.label}</span></NavLink>)}</div></div>
      })}
      {esRestaurante && <div><p className="px-3 mb-1.5 text-[10px] font-semibold text-surface-200/30 uppercase tracking-widest">Restaurante</p><div className="space-y-0.5">{[{to:'/app/ingredientes',label:'Ingredientes',icon:CookingPot},{to:'/app/recetas',label:'Recetas',icon:BookOpen},{to:'/app/compras-ingredientes',label:'Compras',icon:ShoppingCart},{to:'/app/mermas-ingredientes',label:'Mermas y ajustes',icon:BadgeAlert}].map(item=><NavLink key={item.to} to={item.to} onClick={onClose} className={({isActive})=>cn('sidebar-link',isActive&&'active')}><item.icon className="w-4 h-4 flex-shrink-0"/><span className="truncate">{item.label}</span></NavLink>)}</div></div>}
    </nav>
    <div className="p-3 border-t border-white/5">
      <div className="flex items-center gap-2.5 px-3 py-2 mb-1"><div className="w-7 h-7 rounded-full bg-brand-600/30 flex items-center justify-center"><span className="text-[11px] font-bold text-brand-300">{user?.nombre?.[0]??'U'}</span></div><div className="min-w-0"><p className="text-xs font-medium text-surface-50 truncate">{user?.nombre}</p><p className="text-[10px] text-surface-200/40 capitalize">{user?.rol}</p></div></div>
      <button onClick={logout} className="sidebar-link w-full text-red-400/60 hover:text-red-400 hover:bg-red-500/10"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/></svg>Cerrar sesión</button>
    </div>
  </div>
}
