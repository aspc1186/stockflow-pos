import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, ClipboardList, Package, Users, BarChart3, Settings, CreditCard, X, ChevronDown, Phone, Maximize2 } from 'lucide-react'
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
  ]},
  {label:'Admin',items:[
    {to:'/app/usuarios',label:'Usuarios',icon:Users,roles:['admin','supervisor']},
    {to:'/app/reportes',label:'Reportes',icon:BarChart3,roles:['admin','supervisor']},
    {to:'/app/configuracion',label:'Configuración',icon:Settings,roles:['admin']},
  ]},
]
export default function Sidebar({onClose}:{onClose?:()=>void}){
  const {user,isRole,logout}=useAuth()
  const [providerOpen,setProviderOpen]=useState(false)
  const [providerPreview,setProviderPreview]=useState(false)
  return <div className="w-60 h-full bg-surface-800 border-r border-white/5 flex flex-col">
    <div className="relative border-b border-white/5">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <button type="button" onClick={()=>setProviderPreview(true)} className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg border border-brand-400/30 bg-surface-950 bg-[url('/images/stockflow-login.png')] bg-[length:158px_auto] bg-center shadow-sm" title="Ampliar logo de StockFlow">
            <Maximize2 className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-white/80" />
          </button>
          <button type="button" onClick={()=>setProviderOpen(!providerOpen)} aria-expanded={providerOpen} className="flex min-w-0 items-center gap-1.5 text-left" title="Informacion del proveedor">
            <span className="min-w-0"><span className="block text-sm font-bold leading-tight text-white">{user?.empresa?.nombre??'POS Manager'}</span><span className="block text-[10px] capitalize text-surface-200/40">{user?.empresa?.tipo??'plataforma'}</span></span>
            <ChevronDown className={cn('h-3.5 w-3.5 flex-shrink-0 text-surface-200/40 transition-transform',providerOpen&&'rotate-180')} />
          </button>
        </div>
      </div>
      {providerOpen&&<div className="mx-3 mb-3 rounded-lg border border-white/10 bg-surface-900/70 px-3 py-2.5 text-xs">
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
    </nav>
    <div className="p-3 border-t border-white/5">
      <div className="flex items-center gap-2.5 px-3 py-2 mb-1"><div className="w-7 h-7 rounded-full bg-brand-600/30 flex items-center justify-center"><span className="text-[11px] font-bold text-brand-300">{user?.nombre?.[0]??'U'}</span></div><div className="min-w-0"><p className="text-xs font-medium text-surface-50 truncate">{user?.nombre}</p><p className="text-[10px] text-surface-200/40 capitalize">{user?.rol}</p></div></div>
      <button onClick={logout} className="sidebar-link w-full text-red-400/60 hover:text-red-400 hover:bg-red-500/10"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/></svg>Cerrar sesión</button>
    </div>
    {providerPreview&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-5" role="dialog" aria-modal="true" aria-label="Logo de StockFlow">
      <button type="button" className="absolute inset-0 cursor-default" onClick={()=>setProviderPreview(false)} aria-label="Cerrar vista ampliada" />
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-lg border border-brand-400/20 bg-surface-950 shadow-2xl">
        <button type="button" onClick={()=>setProviderPreview(false)} className="absolute right-3 top-3 z-10 rounded-md bg-surface-950/80 p-2 text-white hover:bg-surface-800" title="Cerrar"><X className="h-5 w-5" /></button>
        <img src="/images/stockflow-login.png" alt="StockFlow POS" className="max-h-[80vh] w-full object-contain" />
      </div>
    </div>}
  </div>
}
