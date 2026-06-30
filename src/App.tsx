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
import CocinaPage from './pages/app/CocinaPage'
import BarraPage from './pages/app/BarraPage'
import CajaPage from './pages/app/CajaPage'
import ProductosPage from './pages/app/ProductosPage'
import InventarioPage from './pages/app/InventarioPage'
import ComprasPage from './pages/app/ComprasPage'
import ClientesPage from './pages/app/ClientesPage'
import UsuariosPage from './pages/app/UsuariosPage'
import ReportesPage from './pages/app/ReportesPage'
import ConfiguracionPage from './pages/app/ConfiguracionPage'
import MeseroPage from './pages/mesero/MeseroPage'
import MesaPedidoPage from './pages/mesero/MesaPedidoPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-surface-900 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!isSuperAdmin) return <Navigate to="/app/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const { user, isSuperAdmin } = useAuth()
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      </Route>
      <Route path="/superadmin" element={<RequireSuperAdmin><SuperAdminLayout /></RequireSuperAdmin>}>
        <Route index element={<SuperDashboardPage />} />
        <Route path="empresas" element={<EmpresasPage />} />
        <Route path="empresas/:id" element={<EmpresaDetailPage />} />
      </Route>
      <Route path="/mesero" element={<RequireAuth><MeseroPage /></RequireAuth>} />
      <Route path="/mesero/mesa/:mesaId" element={<RequireAuth><MesaPedidoPage /></RequireAuth>} />
      <Route path="/cocina" element={<RequireAuth><CocinaPage /></RequireAuth>} />
      <Route path="/barra" element={<RequireAuth><BarraPage /></RequireAuth>} />
      <Route path="/app" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="mesas" element={<MesasPage />} />
        <Route path="pedidos" element={<PedidosPage />} />
        <Route path="pedidos/:id" element={<PedidoDetailPage />} />
        <Route path="caja" element={<CajaPage />} />
        <Route path="productos" element={<ProductosPage />} />
        <Route path="inventario" element={<InventarioPage />} />
        <Route path="compras" element={<ComprasPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
      </Route>
      <Route path="/" element={user ? isSuperAdmin ? <Navigate to="/superadmin" replace /> : <Navigate to="/app/dashboard" replace /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
