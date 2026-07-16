import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { LogOut, Clock, Users, RefreshCw, LayoutDashboard } from 'lucide-react'
import api from '@/lib/axios'
import type { Mesa } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'

function tiempo(f?: string): string {
  if (!f) return ''
  const d = Math.floor((Date.now() - new Date(f).getTime()) / 60000)
  if (d < 60) return `${d}m`
  return `${Math.floor(d / 60)}h ${d % 60}m`
}

const ESTADO_CFG = {
  libre:     { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', dot: 'bg-emerald-400', label: 'Libre', text: 'text-emerald-400' },
  ocupada:   { bg: 'bg-amber-500/15',   border: 'border-amber-500/40',   dot: 'bg-amber-400 animate-pulse', label: 'Ocupada', text: 'text-amber-400' },
  reservada: { bg: 'bg-blue-500/15',    border: 'border-blue-500/40',    dot: 'bg-blue-400',   label: 'Reservada', text: 'text-blue-400' },
  limpieza:  { bg: 'bg-purple-500/15',  border: 'border-purple-500/40',  dot: 'bg-purple-400', label: 'Limpieza', text: 'text-purple-400' },
  cerrada:   { bg: 'bg-white/5',        border: 'border-white/10',       dot: 'bg-white/20',   label: 'Cerrada', text: 'text-white/30' },
}

export default function MeseroPage() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const { data: mesas = [], isLoading, refetch } = useQuery({
    queryKey: ['mesero-mesas'],
    queryFn: async () => {
      const { data } = await api.get<any>('/mesas')
      return (data.data || data) as Mesa[]
    },
    refetchInterval: 10_000,
  })

  if (isLoading) return <PageLoader />

  // The API filters operational users, and the UI repeats the rule as a second guard.
  const activas = mesas.filter(m => m.activa && (isAdmin || m.mesero_id === user?.id))
  const ocupadas = activas.filter(m => m.estado === 'ocupada').length
  const libres = activas.filter(m => m.estado === 'libre').length

  return (
    <div className="min-h-screen bg-surface-900">
      <div className="sticky top-0 z-10 bg-surface-800 border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <p className="font-bold text-white">{user?.nombre}</p>
            <p className="text-xs text-surface-200/50 capitalize">{user?.rol} - {activas.length} mesas</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => navigate('/app/dashboard')} className="p-2 rounded-lg text-surface-200/40 hover:text-white hover:bg-white/5" title="Panel principal">
                <LayoutDashboard className="w-4 h-4"/>
              </button>
            )}
            <button onClick={() => refetch()} className="p-2 rounded-lg text-surface-200/40 hover:text-white hover:bg-white/5" title="Actualizar">
              <RefreshCw className="w-4 h-4"/>
            </button>
            <button onClick={logout} className="p-2 rounded-lg text-surface-200/40 hover:text-red-400 hover:bg-red-500/10" title="Cerrar sesion">
              <LogOut className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-surface-800 rounded-xl p-3 text-center border border-white/5">
            <p className="text-2xl font-bold text-surface-50">{activas.length}</p>
            <p className="text-[10px] text-surface-200/40 uppercase tracking-wide">Total</p>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-3 text-center border border-amber-500/20">
            <p className="text-2xl font-bold text-amber-400">{ocupadas}</p>
            <p className="text-[10px] text-amber-400/60 uppercase tracking-wide">Ocupadas</p>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20">
            <p className="text-2xl font-bold text-emerald-400">{libres}</p>
            <p className="text-[10px] text-emerald-400/60 uppercase tracking-wide">Libres</p>
          </div>
        </div>

        {activas.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-surface-200/30">No tienes mesas asignadas</p>
            <p className="text-xs text-surface-200/20 mt-1">Pide al administrador que te asigne una o más mesas</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-6">
            {activas.map(mesa => {
              const cfg = ESTADO_CFG[mesa.estado] ?? ESTADO_CFG.libre
              const t = tiempo(mesa.apertura_at)
              const hayPedido = !!mesa.pedido_id

              return (
                <button key={mesa.id} onClick={() => navigate(`/mesero/mesa/${mesa.id}`)} className={cn('rounded-2xl border p-4 text-left transition-all active:scale-95', cfg.bg, cfg.border)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', cfg.dot)}/>
                        <span className="text-2xl font-black text-white">{mesa.numero}</span>
                      </div>
                      {mesa.nombre && <p className="text-xs text-white/40 ml-4">{mesa.nombre}</p>}
                    </div>
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wide mt-1', cfg.text)}>{cfg.label}</span>
                  </div>

                  {hayPedido ? (
                    <div className="space-y-2">
                      <span className="text-lg font-bold text-white">{formatCurrency(mesa.pedido_total ?? 0)}</span>
                      {t && <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-white/30"/><span className="text-xs text-white/40">{t}</span></div>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-2"><Users className="w-3.5 h-3.5 text-white/20"/><span className="text-xs text-white/30">Cap. {mesa.capacidad}</span></div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
