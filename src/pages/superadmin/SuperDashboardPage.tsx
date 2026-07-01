import { useQuery } from '@tanstack/react-query'
import { Building2, Users, TrendingUp, CheckCircle } from 'lucide-react'
import api from '@/lib/axios'
import { formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'

export default function SuperDashboardPage() {
  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['sa-empresas'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/empresas')
      return data.data || data || []
    },
  })

  if (isLoading) return <PageLoader />

  const activas = empresas.filter((e: any) => e.activa).length
  const inactivas = empresas.filter((e: any) => !e.activa).length
  const totalUsuarios = empresas.reduce((sum: number, e: any) => sum + (e.total_usuarios || 0), 0)
  const ventasHoy = empresas.reduce((sum: number, e: any) => sum + parseFloat(e.ventas_hoy || 0), 0)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Super Admin</h1>
          <p className="page-subtitle">Vista global de la plataforma</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-surface-50">{empresas.length}</p>
            <p className="text-xs text-surface-200/50">Total empresas</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-surface-50">{activas}</p>
            <p className="text-xs text-surface-200/50">Activas</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-surface-50">{totalUsuarios}</p>
            <p className="text-xs text-surface-200/50">Usuarios totales</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-surface-50">{formatCurrency(ventasHoy)}</p>
            <p className="text-xs text-surface-200/50">Ventas hoy</p>
          </div>
        </div>
      </div>

      {/* Tabla de empresas */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-surface-200/70 uppercase tracking-wide">Empresas registradas</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase">Empresa</th>
              <th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase">Tipo</th>
              <th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase">Usuarios</th>
              <th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody>
            {empresas.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-surface-200/30">
                  No hay empresas registradas
                </td>
              </tr>
            ) : (empresas as any[]).map((e: any) => (
              <tr key={e.id} className="border-b border-white/5">
                <td className="p-4">
                  <p className="font-medium text-surface-50">{e.nombre}</p>
                  {e.ciudad && <p className="text-xs text-surface-200/40">{e.ciudad}</p>}
                </td>
                <td className="p-4">
                  <span className="text-xs bg-brand-600/20 text-brand-400 px-2 py-1 rounded capitalize">
                    {e.tipo?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-4 text-sm text-surface-200/70">{e.total_usuarios ?? 0}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded font-medium ${e.activa ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {e.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
