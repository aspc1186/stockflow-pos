import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function AuthLayout() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to={user.rol === 'superadmin' ? '/superadmin' : '/app/dashboard'} replace/>
  return <Outlet/>
}
