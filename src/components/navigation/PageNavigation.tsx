import { Home, ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const TITULOS: Record<string, string> = {
  '/app/dashboard':'Dashboard', '/app/mesas':'Mesas', '/app/pedidos':'Pedidos', '/app/caja':'Caja',
  '/app/productos':'Productos', '/app/inventario':'Inventario', '/app/clientes':'Clientes',
  '/app/reservas':'Reservas', '/app/eventos':'Eventos y promociones', '/app/usuarios':'Usuarios',
  '/app/reportes':'Reportes', '/app/configuracion':'Configuracion', '/app/integraciones':'Integraciones ERP',
  '/app/ingredientes':'Ingredientes', '/app/recetas':'Recetas', '/app/costeo':'Costeo y precios',
  '/app/compras-ingredientes':'Compras de ingredientes', '/app/mermas-ingredientes':'Mermas y ajustes',
  '/app/escanear/qr':'Escanear QR', '/app/escanear/barras':'Escanear codigo de barras',
}

function detalleDeRuta(pathname: string) {
  const rutaBase = Object.keys(TITULOS).find(ruta => pathname === ruta || pathname.startsWith(`${ruta}/`))
  return { rutaBase: rutaBase || '/app/inicio', titulo: TITULOS[rutaBase || ''] || 'StockFlow' }
}

export default function PageNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { rutaBase, titulo } = detalleDeRuta(location.pathname)
  if (location.pathname === '/app/inicio') return null

  const volver = () => {
    // React Router registra idx en el historial propio. Si no existe, una URL
    // abierta directamente vuelve al inicio de la empresa y nunca a otro sitio.
    const indice = Number(window.history.state?.idx ?? 0)
    if (indice > 0 && document.referrer.startsWith(window.location.origin)) navigate(-1)
    else navigate('/app/inicio', { replace: true })
  }
  const migas = rutaBase === '/app/dashboard' ? ['Inicio', 'Dashboard'] : ['Inicio', titulo]

  return <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
    <button type="button" onClick={volver} className="btn-ghost min-h-11"><ArrowLeft className="h-4 w-4"/>Volver</button>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-surface-50">{titulo}</p><p className="text-xs text-surface-200/50">{migas.join(' > ')}</p></div>
    <button type="button" onClick={() => navigate('/app/inicio')} className="btn-secondary min-h-11"><Home className="h-4 w-4"/>Inicio</button>
  </div>
}
