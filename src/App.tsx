import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AuthLayout from './components/layouts/AuthLayout'
import DashboardLayout from './components/layouts/DashboardLayout'
import SuperAdminLayout from './components/layouts/SuperAdminLayout'
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import SuperDashboardPage from './pages/superadmin/SuperDashboardPage'
import EmpresasPage from './pages/superadmin/EmpresasPage'
import EmpresaDetailPage from './pages/superadmin/EmpresaDetailPage'
import DashboardPage from './pages/app/DashboardPage'
import MesasPage from './pages/app/MesasPage'
import PedidosPage from './pages/app/PedidosPage'
import PedidoDetailPage from './pages/app/PedidoDetailPage'
import CajaPage from './pages/app/CajaPage'
import ProductosPage from './pages/app/ProductosPage'
import InventarioPage from './pages/app/InventarioPage'
import ClientesPage from './pages/app/ClientesPage'
import IntegracionesPage from './pages/app/IntegracionesPage'
import UsuariosPage from './pages/app/UsuariosPage'
import ReportesPage from './pages/app/ReportesPage'
import ConfiguracionPage from './pages/app/ConfiguracionPage'
import MeseroPage from './pages/mesero/MeseroPage'
import MesaPedidoPage from './pages/mesero/MesaPedidoPage'
import RestauranteOperacionPage from './pages/app/RestauranteOperacionPage'

function RequireAuth({children}:{children:React.ReactNode}){
  const {user,loading}=useAuth()
  if(loading) return <div className="min-h-screen bg-surface-900 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>
  if(!user) return <Navigate to="/login" replace/>
  return <>{children}</>
}
function RequireSuperAdmin({children}:{children:React.ReactNode}){
  const {user,isSuperAdmin,loading,refreshUser}=useAuth()
  const [verificando, setVerificando] = useState(true)
  useEffect(() => {
    if (!user) { setVerificando(false); return }
    refreshUser().finally(() => setVerificando(false))
  }, [user?.id])
  if(loading || verificando) return <div className="min-h-screen bg-surface-900 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>
  if(!user) return <Navigate to="/login" replace/>
  if(!isSuperAdmin) return <Navigate to="/app/dashboard" replace/>
  return <>{children}</>
}
function RequireApp({children}:{children:React.ReactNode}){
  const {user,loading,isMesero,isAdmin,isSuperAdmin}=useAuth()
  if(loading) return null
  if(!user) return <Navigate to="/login" replace/>
  if(isSuperAdmin) return <Navigate to="/superadmin" replace/>
  if(isMesero && !isAdmin) return <Navigate to="/mesero" replace/>
  return <>{children}</>
}

export default function App(){
  const {user,isSuperAdmin,isMesero}=useAuth()
  const def=!user?'/login':isSuperAdmin?'/superadmin':isMesero?'/mesero':'/app/dashboard'
  return <Routes>
    <Route element={<AuthLayout/>}>
      <Route path="/login" element={<LoginPage/>}/>
      <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
      <Route path="/reset-password/:token" element={<ResetPasswordPage/>}/>
    </Route>
    <Route path="/superadmin" element={<RequireSuperAdmin><SuperAdminLayout/></RequireSuperAdmin>}>
      <Route index element={<SuperDashboardPage/>}/>
      <Route path="empresas" element={<EmpresasPage/>}/>
      <Route path="empresas/:id" element={<EmpresaDetailPage/>}/>
    </Route>
    <Route path="/mesero" element={<RequireAuth><MeseroPage/></RequireAuth>}/>
    <Route path="/mesero/mesa/:mesaId" element={<RequireAuth><MesaPedidoPage/></RequireAuth>}/>
    <Route path="/app" element={<RequireApp><DashboardLayout/></RequireApp>}>
      <Route index element={<Navigate to="dashboard" replace/>}/>
      <Route path="dashboard" element={<DashboardPage/>}/>
      <Route path="mesas" element={<MesasPage/>}/>
      <Route path="pedidos" element={<PedidosPage/>}/>
      <Route path="pedidos/:id" element={<PedidoDetailPage/>}/>
      <Route path="caja" element={<CajaPage/>}/>
      <Route path="productos" element={<ProductosPage/>}/>
      <Route path="inventario" element={<InventarioPage/>}/>
      <Route path="clientes" element={<ClientesPage/>}/>
      <Route path="integraciones" element={<IntegracionesPage/>}/>
      <Route path="ingredientes" element={<RestauranteOperacionPage modo="ingredientes"/>}/>
      <Route path="recetas" element={<RestauranteOperacionPage modo="recetas"/>}/>
      <Route path="compras-ingredientes" element={<RestauranteOperacionPage modo="compras"/>}/>
      <Route path="mermas-ingredientes" element={<RestauranteOperacionPage modo="mermas"/>}/>
      <Route path="usuarios" element={<UsuariosPage/>}/>
      <Route path="reportes" element={<ReportesPage/>}/>
      <Route path="configuracion" element={<ConfiguracionPage/>}/>
    </Route>
    <Route path="/" element={<Navigate to={def} replace/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>
}
