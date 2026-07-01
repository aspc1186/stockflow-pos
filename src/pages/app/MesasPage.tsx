import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, MapPin, Users, Clock, Wine } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

type EstadoMesa = 'libre' | 'ocupada' | 'reservada' | 'limpieza' | 'cerrada'

interface Mesa {
  id: string
  numero: number
  nombre?: string
  capacidad: number
  estado: EstadoMesa
  zona_nombre?: string
  pedido_id?: string
  pedido_total?: number
  apertura_at?: string
  tipo?: string
  consumo_minimo?: number
}

const ESTADOS: { value: EstadoMesa | 'todas'; label: string; color: string }[] = [
  { value: 'todas', label: 'Todas', color: 'text-surface-200' },
  { value: 'libre', label: 'Libre', color: 'text-emerald-400' },
  { value: 'ocupada', label: 'Ocupada', color: 'text-amber-400' },
  { value: 'reservada', label: 'Reservada', color: 'text-blue-400' },
  { value: 'limpieza', label: 'Limpieza', color: 'text-purple-400' },
  { value: 'cerrada', label: 'Cerrada', color: 'text-surface-200/40' },
]

const ESTADO_CFG: Record<EstadoMesa, { bg: string; border: string; dot: string; label: string }> = {
  libre: { bg: 'bg-emerald-500/10 hover:bg-emerald-500/20', border: 'border-emerald-500/30', dot: 'bg-emerald-400', label: 'Libre' },
  ocupada: { bg: 'bg-amber-500/10 hover:bg-amber-500/20', border: 'border-amber-500/30', dot: 'bg-amber-400 animate-pulse', label: 'Ocupada' },
  reservada: { bg: 'bg-blue-500/10 hover:bg-blue-500/20', border: 'border-blue-500/30', dot: 'bg-blue-400', label: 'Reservada' },
  limpieza: { bg: 'bg-purple-500/10 hover:bg-purple-500/20', border: 'border-purple-500/30', dot: 'bg-purple-400', label: 'Limpieza' },
  cerrada: { bg: 'bg-surface-200/5 hover:bg-surface-200/10', border: 'border-white/5', dot: 'bg-surface-200/30', label: 'Cerrada' },
}

function tiempoTranscurrido(fecha?: string): string {
  if (!fecha) return ''
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000)
  if (diff < 60) return `${diff}m`
  return `${Math.floor(diff / 60)}h ${diff % 60}m`
}

export default function MesasPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [filtro, setFiltro] = useState<EstadoMesa | 'todas'>('todas')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ numero: '', nombre: '', capacidad: '4', tipo: 'mesa', consumo_minimo: '0' })

  const { data: mesas = [], isLoading, refetch } = useQuery({
    queryKey: ['mesas'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: Mesa[] }>('/mesas')
      return data.data
    },
    refetchInterval: 15_000,
  })

  const crear = useMutation({
    mutationFn: (d: any) => api.post('/mesas', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesas'] })
      setModal(false)
      setForm({ numero: '', nombre: '', capacidad: '4', tipo: 'mesa', consumo_minimo: '0' })
      toast.success('Mesa creada exitosamente')
    },
    onError: (e: any) => toast.error(e?.response?.data?.msg ?? 'Error al crear mesa'),
  })

  const filtradas = filtro === 'todas' ? mesas : mesas.filter(m => m.estado === filtro)

  const conteo = ESTADOS.reduce((acc, e) => {
    if (e.value !== 'todas') acc[e.value as EstadoMesa] = mesas.filter(m => m.estado === e.value).length
    return acc
  }, {} as Record<EstadoMesa, number>)

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Mesas</h1>
          <p className="page-subtitle">{mesas.length} mesas · {conteo['ocupada'] ?? 0} ocupadas · {conteo['libre'] ?? 0} libres</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-ghost btn-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button onClick={() => setModal(true)} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" /> Nueva mesa
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {ESTADOS.map(e => (
          <button
            key={e.value}
            onClick={() => setFiltro(e.value)}
            className={cn('btn btn-sm transition-all', filtro === e.value ? 'btn-primary' : 'btn-secondary')}
          >
            {e.value !== 'todas' && (
              <span className={cn('w-2 h-2 rounded-full', ESTADO_CFG[e.value as EstadoMesa]?.dot?.replace(' animate-pulse', ''))} />
            )}
            {e.label}
            {e.value !== 'todas' && conteo[e.value as EstadoMesa] > 0 && (
              <span className="ml-1 text-xs opacity-60">({conteo[e.value as EstadoMesa]})</span>
            )}
            {e.value === 'todas' && <span className="ml-1 text-xs opacity-60">({mesas.length})</span>}
          </button>
        ))}
      </div>

      {/* Grid de mesas */}
      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Wine className="w-12 h-12 text-surface-200/20 mb-3" />
          <p className="text-sm text-surface-200/40">
            {mesas.length === 0 ? 'No hay mesas creadas' : 'Sin mesas en este estado'}
          </p>
          {mesas.length === 0 && isAdmin && (
            <button onClick={() => setModal(true)} className="btn-primary btn-sm mt-4">
              <Plus className="w-4 h-4" /> Crear primera mesa
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtradas.map(mesa => {
            const cfg = ESTADO_CFG[mesa.estado] ?? ESTADO_CFG.libre
            const tiempo = tiempoTranscurrido(mesa.apertura_at)
            return (
              <button
                key={mesa.id}
                onClick={() => navigate(`/app/pedidos?mesa=${mesa.id}`)}
                className={cn(
                  'relative p-4 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer',
                  cfg.bg, cfg.border
                )}
              >
                {/* Header de la tarjeta */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-surface-50">#{mesa.numero}</span>
                  <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', cfg.dot)} />
                </div>

                {/* Nombre y zona */}
                {mesa.nombre && (
                  <p className="text-xs text-surface-200/60 truncate mb-1">{mesa.nombre}</p>
                )}
                {mesa.zona_nombre && (
                  <div className="flex items-center gap-1 mb-2">
                    <MapPin className="w-3 h-3 text-surface-200/30" />
                    <span className="text-[10px] text-surface-200/30 truncate">{mesa.zona_nombre}</span>
                  </div>
                )}

                {/* Info del pedido activo */}
                {mesa.pedido_id && mesa.pedido_total !== undefined ? (
                  <div className="space-y-1 mt-2">
                    <p className="text-sm font-bold text-surface-50">{formatCurrency(mesa.pedido_total)}</p>
                    {tiempo && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-surface-200/30" />
                        <span className="text-[10px] text-surface-200/40">{tiempo}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className={cn('text-xs font-medium mt-2', {
                    'text-emerald-400': mesa.estado === 'libre',
                    'text-blue-400': mesa.estado === 'reservada',
                    'text-purple-400': mesa.estado === 'limpieza',
                    'text-surface-200/30': mesa.estado === 'cerrada',
                  })}>
                    {cfg.label}
                  </p>
                )}

                {/* Capacidad */}
                <div className="flex items-center gap-1 mt-2">
                  <Users className="w-3 h-3 text-surface-200/20" />
                  <span className="text-[10px] text-surface-200/25">{mesa.capacidad}</span>
                  {mesa.tipo && mesa.tipo !== 'mesa' && (
                    <span className="text-[10px] text-surface-200/20 ml-auto capitalize">{mesa.tipo}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Modal crear mesa */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Nueva mesa"
        size="sm"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button
              onClick={() => crear.mutate({
                numero: parseInt(form.numero),
                nombre: form.nombre || undefined,
                capacidad: parseInt(form.capacidad),
                tipo: form.tipo,
                consumo_minimo: parseFloat(form.consumo_minimo) || 0,
              })}
              disabled={!form.numero || crear.isPending}
              className="btn-primary flex-1"
            >
              {crear.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Crear mesa'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Número *</label>
            <input className="input" placeholder="Ej: 1, 2, 10" type="number" min={1}
              value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} />
          </div>
          <div>
            <label className="label">Nombre (opcional)</label>
            <input className="input" placeholder="Ej: VIP 1, Terraza A"
              value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Capacidad</label>
              <input type="number" min={1} max={100} className="input"
                value={form.capacidad} onChange={e => setForm(p => ({ ...p, capacidad: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                <option value="mesa">Mesa</option>
                <option value="barra">Barra</option>
                <option value="vip">VIP</option>
                <option value="cabina">Cabina</option>
                <option value="terraza">Terraza</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Consumo mínimo</label>
            <input type="number" min={0} className="input" placeholder="0"
              value={form.consumo_minimo} onChange={e => setForm(p => ({ ...p, consumo_minimo: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
