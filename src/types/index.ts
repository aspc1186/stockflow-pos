export interface Empresa {
  id: string; nombre: string; slug: string; nit?: string; telefono?: string
  email?: string; direccion?: string; ciudad?: string; pais?: string
  logo_url?: string; tipo: 'restaurante'|'bar'|'discoteca'|'mixto'
  activa: boolean; licencia_inicio?: string; licencia_fin?: string
  created_at: string; updated_at: string
}
export interface Rol { id: number; nombre: string; descripcion?: string }
export interface Usuario {
  id: string; empresa_id?: string; rol_id: number; rol?: Rol
  nombre: string; email: string; username: string; telefono?: string
  activo: boolean; ultimo_acceso?: string; created_at: string; updated_at: string
}
export interface AuthUser extends Usuario { empresa?: Empresa; token: string }
export interface Zona { id: string; empresa_id: string; nombre: string; descripcion?: string; orden: number; activa: boolean }
export type EstadoMesa = 'libre'|'ocupada'|'preparando'|'lista_cobrar'|'pendiente_pago'|'cerrada'
export interface Mesa {
  id: string; empresa_id: string; zona_id?: string; zona?: Zona
  numero: string; nombre?: string; capacidad: number
  pos_x: number; pos_y: number; estado: EstadoMesa; activa: boolean
  pedido_activo?: Pedido; mesero?: Usuario
}
export interface Categoria {
  id: string; empresa_id: string; nombre: string; descripcion?: string
  icono?: string; color?: string; tipo: 'cocina'|'barra'|'ambos'
  orden: number; activa: boolean
}
export interface Producto {
  id: string; empresa_id: string; categoria_id?: string; categoria?: Categoria
  nombre: string; descripcion?: string; codigo?: string
  precio_venta: number; precio_costo: number; impuesto_pct: number
  unidad_medida: string; imagen_url?: string; disponible: boolean
  controla_stock: boolean; destino: 'cocina'|'barra'|'ambos'; stock_actual?: number
}
export type EstadoPedido = 'abierto'|'en_preparacion'|'listo'|'cobrado'|'cancelado'
export type EstadoItem = 'pendiente'|'en_preparacion'|'listo'|'entregado'|'cancelado'
export interface PedidoItem {
  id: string; pedido_id: string; empresa_id: string; producto_id: string; producto?: Producto
  cantidad: number; precio_unit: number; impuesto_pct: number; descuento: number
  subtotal: number; observaciones?: string; estado: EstadoItem
  destino: 'cocina'|'barra'|'ambos'; created_at: string
}
export interface Pedido {
  id: string; empresa_id: string; mesa_id?: string; mesa?: Mesa
  cliente_id?: string; cliente?: Cliente; usuario_id?: string; usuario?: Usuario
  numero: number; estado: EstadoPedido
  subtotal: number; impuestos: number; descuento: number; propina: number; total: number
  notas?: string; tipo: 'mesa'|'barra'|'domicilio'|'llevar'
  apertura_at: string; cierre_at?: string; items?: PedidoItem[]
  created_at: string; updated_at: string
}
export interface Cliente {
  id: string; empresa_id: string; nombre: string; telefono?: string
  email?: string; documento?: string; notas?: string
  visitas: number; total_gastado: number; ultima_visita?: string; created_at: string
}
export interface Proveedor {
  id: string; empresa_id: string; nombre: string; nit?: string
  telefono?: string; email?: string; direccion?: string; contacto?: string; activo: boolean
}
export interface OrdenCompra {
  id: string; empresa_id: string; proveedor_id?: string; proveedor?: Proveedor
  usuario_id?: string; numero?: string
  estado: 'pendiente'|'aprobada'|'recibida'|'cancelada'
  subtotal: number; impuestos: number; total: number; notas?: string
  fecha_esperada?: string; items?: OrdenCompraItem[]; created_at: string
}
export interface OrdenCompraItem {
  id: string; orden_id: string; producto_id: string; producto?: Producto
  cantidad: number; precio_unit: number; subtotal: number
}
export interface Caja {
  id: string; empresa_id: string; usuario_id?: string; usuario?: Usuario
  estado: 'abierta'|'cerrada'; saldo_inicial: number; saldo_final?: number
  total_ventas: number; total_ingresos: number; total_egresos: number
  apertura_at: string; cierre_at?: string; notas?: string
}
export interface CajaMovimiento {
  id: string; empresa_id: string; caja_id: string; usuario_id?: string; pedido_id?: string
  tipo: 'ingreso'|'egreso'|'venta'|'propina'
  metodo_pago: 'efectivo'|'tarjeta'|'transferencia'|'nequi'|'daviplata'|'mixto'
  monto: number; descripcion?: string; created_at: string
}
export interface DashboardStats {
  ventas_hoy: number; ventas_mes: number; pedidos_activos: number
  mesas_ocupadas: number; mesas_libres: number; inventario_critico: number
  caja_actual: number; usuarios_conectados: number
  productos_mas_vendidos: {nombre:string;total:number}[]
  ventas_por_hora: {hora:string;total:number}[]
}
export interface ApiResponse<T=unknown> { success: boolean; data?: T; message?: string }
