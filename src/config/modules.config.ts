import type { LucideIcon } from 'lucide-react'
import { BarChart3, Boxes, Building2, CalendarDays, ClipboardList, Cog, FileText, HandCoins, History, LayoutDashboard, MapPin, Package, QrCode, ReceiptText, ScanLine, Settings2, ShieldCheck, ShoppingBag, ShoppingCart, Users, Warehouse } from 'lucide-react'

export type PlanModulo = 'free' | 'pro' | 'enterprise'
export type GrupoModulo = 'Operacion' | 'Puestos y atencion' | 'Inventario y WMS' | 'Restaurante y recetas' | 'Administracion' | 'Sistema'
export interface ModuloPlataforma { id:string; nombre:string; grupo:GrupoModulo; icono:LucideIcon; ruta?:string; planes:PlanModulo[]; negocios?:string[]; disponible:boolean; descripcion:string }

// Fuente unica para ROOT. Las tarjetas sin pantalla propia son visibles pero no
// crean enlaces rotos: quedan indicadas como proximamente.
export const MODULOS_PLATAFORMA: ModuloPlataforma[] = [
  {id:'dashboard',nombre:'Dashboard',grupo:'Operacion',icono:LayoutDashboard,ruta:'/app/dashboard',planes:['free','pro','enterprise'],disponible:true,descripcion:'Operacion'},
  {id:'productos',nombre:'Productos y servicios',grupo:'Operacion',icono:Package,ruta:'/app/productos',planes:['free','pro','enterprise'],disponible:true,descripcion:'Operacion'},
  {id:'caja',nombre:'Ventas y caja',grupo:'Operacion',icono:ReceiptText,ruta:'/app/caja',planes:['free','pro','enterprise'],disponible:true,descripcion:'Operacion'},
  {id:'pedidos',nombre:'Pedidos',grupo:'Operacion',icono:ClipboardList,ruta:'/app/pedidos',planes:['free','pro','enterprise'],disponible:true,descripcion:'Operacion'},
  {id:'clientes',nombre:'Clientes',grupo:'Operacion',icono:Users,ruta:'/app/clientes',planes:['free','pro','enterprise'],disponible:true,descripcion:'Operacion'},
  {id:'compras',nombre:'Compras',grupo:'Operacion',icono:ShoppingCart,planes:['pro','enterprise'],disponible:false,descripcion:'Proximamente'},
  {id:'proveedores',nombre:'Proveedores',grupo:'Operacion',icono:Building2,planes:['pro','enterprise'],disponible:false,descripcion:'Proximamente'},
  {id:'mesas',nombre:'Mesas o estaciones',grupo:'Puestos y atencion',icono:MapPin,ruta:'/app/mesas',planes:['free','pro','enterprise'],disponible:true,descripcion:'Puestos'},
  {id:'responsables',nombre:'Responsables',grupo:'Puestos y atencion',icono:Users,ruta:'/app/usuarios',planes:['free','pro','enterprise'],disponible:true,descripcion:'Usuarios'},
  {id:'servicios',nombre:'Servicios activos',grupo:'Puestos y atencion',icono:HandCoins,ruta:'/app/pedidos',planes:['pro','enterprise'],disponible:true,descripcion:'Pedidos activos'},
  {id:'reservas',nombre:'Reservas',grupo:'Puestos y atencion',icono:CalendarDays,ruta:'/app/reservas',planes:['pro','enterprise'],disponible:true,descripcion:'Puestos'},
  {id:'agenda',nombre:'Agenda',grupo:'Puestos y atencion',icono:CalendarDays,ruta:'/app/reservas',planes:['pro','enterprise'],disponible:true,descripcion:'Reservas'},
  {id:'eventos',nombre:'Eventos y promociones',grupo:'Puestos y atencion',icono:ShoppingBag,ruta:'/app/eventos',planes:['pro','enterprise'],disponible:true,descripcion:'Puestos'},
  {id:'inventario',nombre:'Inventario',grupo:'Inventario y WMS',icono:Boxes,ruta:'/app/inventario',planes:['free','pro','enterprise'],disponible:true,descripcion:'Inventario'},
  {id:'kardex',nombre:'Kardex y movimientos',grupo:'Inventario y WMS',icono:History,ruta:'/app/inventario',planes:['pro','enterprise'],disponible:true,descripcion:'Inventario'},
  {id:'conteos',nombre:'Conteos ciclicos',grupo:'Inventario y WMS',icono:ClipboardList,planes:['enterprise'],disponible:false,descripcion:'Proximamente'},
  {id:'conciliacion',nombre:'Conciliacion',grupo:'Inventario y WMS',icono:Settings2,planes:['enterprise'],disponible:false,descripcion:'Proximamente'},
  {id:'bodegas',nombre:'Bodegas y ubicaciones',grupo:'Inventario y WMS',icono:Warehouse,planes:['enterprise'],disponible:false,descripcion:'Proximamente'},
  {id:'traslados',nombre:'Traslados entre bodegas',grupo:'Inventario y WMS',icono:Warehouse,planes:['enterprise'],disponible:false,descripcion:'Proximamente'},
  {id:'qr',nombre:'Escanear QR',grupo:'Inventario y WMS',icono:QrCode,ruta:'/app/escanear/qr',planes:['pro','enterprise'],disponible:true,descripcion:'Inventario'},
  {id:'barras',nombre:'Escanear codigo de barras',grupo:'Inventario y WMS',icono:ScanLine,ruta:'/app/escanear/barras',planes:['pro','enterprise'],disponible:true,descripcion:'Inventario'},
  {id:'indicadores-inventario',nombre:'Indicadores de inventario',grupo:'Inventario y WMS',icono:BarChart3,ruta:'/app/inventario',planes:['pro','enterprise'],disponible:true,descripcion:'Inventario'},
  {id:'recetas',nombre:'Recetas',grupo:'Restaurante y recetas',icono:FileText,ruta:'/app/recetas',planes:['pro','enterprise'],negocios:['restaurante'],disponible:true,descripcion:'Restaurante'},
  {id:'ingredientes',nombre:'Ingredientes',grupo:'Restaurante y recetas',icono:Package,ruta:'/app/ingredientes',planes:['pro','enterprise'],negocios:['restaurante'],disponible:true,descripcion:'Restaurante'},
  {id:'costeo',nombre:'Costos',grupo:'Restaurante y recetas',icono:BarChart3,ruta:'/app/costeo',planes:['pro','enterprise'],negocios:['restaurante'],disponible:true,descripcion:'Restaurante'},
  {id:'mermas',nombre:'Mermas',grupo:'Restaurante y recetas',icono:History,ruta:'/app/mermas-ingredientes',planes:['pro','enterprise'],negocios:['restaurante'],disponible:true,descripcion:'Restaurante'},
  {id:'usuarios',nombre:'Usuarios',grupo:'Administracion',icono:Users,ruta:'/app/usuarios',planes:['free','pro','enterprise'],disponible:true,descripcion:'Administracion'},
  {id:'roles',nombre:'Roles y permisos',grupo:'Administracion',icono:ShieldCheck,ruta:'/app/usuarios',planes:['pro','enterprise'],disponible:true,descripcion:'Administracion'},
  {id:'reportes',nombre:'Reportes',grupo:'Administracion',icono:BarChart3,ruta:'/app/reportes',planes:['free','pro','enterprise'],disponible:true,descripcion:'Administracion'},
  {id:'configuracion',nombre:'Configuracion',grupo:'Administracion',icono:Cog,ruta:'/app/configuracion',planes:['free','pro','enterprise'],disponible:true,descripcion:'Administracion'},
  {id:'erp',nombre:'Integraciones ERP',grupo:'Administracion',icono:Settings2,ruta:'/app/integraciones',planes:['pro','enterprise'],disponible:true,descripcion:'Administracion'},
  {id:'respaldos',nombre:'Respaldos',grupo:'Administracion',icono:History,planes:['enterprise'],disponible:false,descripcion:'Sistema'},
  {id:'auditoria',nombre:'Auditoria',grupo:'Administracion',icono:ShieldCheck,planes:['enterprise'],disponible:false,descripcion:'Proximamente'},
  {id:'pruebas',nombre:'Centro de pruebas',grupo:'Sistema',icono:Settings2,planes:['enterprise'],disponible:false,descripcion:'Sistema'},
  {id:'salud',nombre:'Salud del sistema',grupo:'Sistema',icono:ShieldCheck,planes:['enterprise'],disponible:false,descripcion:'Sistema'},
  {id:'actualizaciones',nombre:'Actualizaciones',grupo:'Sistema',icono:History,planes:['free','pro','enterprise'],disponible:false,descripcion:'Sistema'},
  {id:'facturacion',nombre:'Facturacion electronica',grupo:'Sistema',icono:ReceiptText,planes:['pro','enterprise'],disponible:false,descripcion:'Proximamente'},
]

export const GRUPOS_MODULOS: GrupoModulo[] = ['Operacion','Puestos y atencion','Inventario y WMS','Restaurante y recetas','Administracion','Sistema']
export function planNormalizado(plan?: string): PlanModulo { const p=String(plan||'').toLowerCase(); return ['premium','enterprise','wms'].includes(p)?'enterprise':['profesional','pro'].includes(p)?'pro':'free' }
