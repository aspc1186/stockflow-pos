import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
export default function AuthLayout() {
  const { user, isSuperAdmin } = useAuth()
  if (user) return isSuperAdmin ? <Navigate to="/superadmin" replace /> : <Navigate to="/app/dashboard" replace />
  return (
    <div className="min-h-screen bg-surface-900 flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-surface-900">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mb-8">
            <svg viewBox="0 0 32 32" fill="none" className="w-9 h-9"><rect x="3" y="8" width="10" height="16" rx="2" fill="white" fillOpacity="0.9"/><rect x="15" y="4" width="14" height="10" rx="2" fill="white" fillOpacity="0.6"/><rect x="15" y="16" width="14" height="8" rx="2" fill="white" fillOpacity="0.8"/></svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">POS Manager</h1>
          <p className="text-brand-200/70 text-lg max-w-sm">Plataforma profesional para restaurantes, bares y discotecas.</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md"><Outlet /></div>
      </div>
    </div>
  )
}
