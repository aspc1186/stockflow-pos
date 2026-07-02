import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import api from '@/lib/axios'
import type { Mesa } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'

function tiempo(f?: string): string {
  if (!f) return ''
  const d = Math.floor((Date.now()-new Date(f).getTime())/60000)
  return d < 60 ? `${d}m` : `${Math.floor(d/60)}h ${d%60}m`
}

export default function MeseroPage() {
  const { user, logout } = useAuth(); const navigate = useNavigate()
  const { data: mesas = [], isLoading } = useQuery({
    queryKey: ['mesero-mesas'],
    queryFn: async () => { const { data } = await api.get<any>('/mesas'); return (data.data||data) as Mesa[] },
    refetchInterval: 10_000,
  })
  if (isLoading) return <PageLoader />
  return (
    <div className="min-h-screen bg-surface-900 pb-6">
      <div className="sticky top-0 z-10 bg-surface-800/90 backdrop-blur border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div><p className="text-sm font-semibold text-white">{user?.nombre}</p><p className="text-xs text-surface-200/50 capitalize">{user?.rol}</p></div>
          <button onClick={logout} className="p-2 rounded-lg text-surface-200/50 hover:text-white"><LogOut className="w-5 h-5"/></button>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-5">
        <h1 className="text-lg font-bold text-white mb-4">Selecciona una mesa</h1>
        <div className="grid grid-cols-2 gap-3">
          {mesas.filter(m => m.activa).map(mesa => {
            const libre = mesa.estado === 'libre'
            return (
              <button key={mesa.id} onClick={() => navigate(`/mesero/mesa/${mesa.id}`)}
                className={cn('p-4 rounded-xl border text-left transition-all active:scale-95',libre?'bg-emerald-500/10 border-emerald-500/30':'bg-amber-500/10 border-amber-500/30')}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl font-bold text-white">#{mesa.numero}</span>
                  <span className={cn('w-3 h-3 rounded-full',libre?'bg-emerald-400':'bg-amber-400')}/>
                </div>
                {mesa.nombre && <p className="text-xs text-surface-200/50 mb-2">{mesa.nombre}</p>}
                {libre ? <p className="text-xs text-emerald-400 font-medium">Disponible</p> : (
                  <div>
                    <p className="text-sm font-semibold text-surface-50">{formatCurrency(mesa.pedido_total??0)}</p>
                    {mesa.apertura_at && <p className="text-xs text-surface-200/40 mt-0.5">{tiempo(mesa.apertura_at)}</p>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {mesas.filter(m=>m.activa).length===0&&<div className="text-center py-12 text-surface-200/40"><p>No hay mesas disponibles</p></div>}
      </div>
    </div>
  )
}
