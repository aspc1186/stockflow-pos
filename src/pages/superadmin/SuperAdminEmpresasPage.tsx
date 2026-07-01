import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Building2, Users, TrendingUp, CheckCircle, XCircle, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Empresa {
  id: string
  nombre: string
  tipo: string
  ciudad?: string
  activa: boolean
  plan: string
  licencia_fin?: string
  total_usuarios: number
  pedidos_hoy: number
  ventas_hoy: number
  created_at: string
}

const TIPOS = ['bar', 'discoteca', 'bar_discoteca', 'restaurante_bar']

export default function EmpresasPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    nombre: '', tipo: 'bar', ciudad: '', nit: '', telefono: '', email: '',
    plan: 'basico', licencia_fin: '',
    admin_nombre: '', admin_email: '', admin_username: '', admin_password: ''
  })

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: Empresa[] }>('/superadmin/empresas')
      return data.data
    },
    refetchInterval: 30_000,
  })

  const crear = useMutation({
    mutationFn: (d: any) => api.post('/superadmin/empresas', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] })
      setModal(false)
      setForm({ nombre: '', tipo: 'bar', ciudad: '', nit: '', telefono: '', email: '', plan: 'basico', licencia_fin: '', admin_nombre: '', admin_email: '', admin_username: '', admin_password: '' })
      toast.success('Empresa creada exitosamente')
    },
    onError: (e: any) => toast.error(e?.response?.data?.msg ?? 'Error al crear empresa'),
  })

  const toggleActiva = useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) =>
      api.patch(`/superadmin/empresas/${id}`, { activa }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['empresas'] }),
    onError: () => toast.error('Error al actualizar empresa'),
  })

  const filtradas = empresas.filter(e =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.ciudad?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Empresas</h1>
          <p className="page-subtitle">{empresas.length} registradas · {empresas.filter(e => e.activa).length} activas</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary btn-sm">
          <Plus className="w-4 h-4" /> Nueva empresa
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600/20 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-surface-50">{empresas.length}</p>
            <p className="text-xs text-surface-200/50">Total empresas</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-surface-50">{empresas.filter(e => e.activa).length}</p>
            <p className="text-xs text-surface-200/50">Activas</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-surface-50">{empresas.filter(e => !e.activa).length}</p>
            <p className="text-xs text-surface-200/50">Inactivas</p>
          </div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30" />
        <input
          className="input pl-9"
          placeholder="Buscar empresa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase tracking-wide">Empresa</th>
              <th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase tracking-wide">Tipo</th>
              <th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase tracking-wide hidden md:table-cell">Usuarios</th>
              <th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase tracking-wide hidden lg:table-cell">Ventas hoy</th>
              <th className="text-left p-4 text-xs font-semibold text-surface-200/50 uppercase tracking-wide">Estado</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-surface-200/30">
                  {search ? 'Sin resultados' : 'No hay empresas registradas'}
                </td>
              </tr>
            ) : filtradas.map(empresa => (
              <tr key={empresa.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                <td className="p-4">
                  <div>
                    <p className="font-medium text-surface-50">{empresa.nombre}</p>
                    {empresa.ciudad && <p className="text-xs text-surface-200/40">{empresa.ciudad}</p>}
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-xs bg-brand-600/20 text-brand-400 px-2 py-1 rounded-lg capitalize">
                    {empresa.tipo?.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-4 hidden md:table-cell">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-surface-200/30" />
                    <span className="text-sm text-surface-200/70">{empresa.total_usuarios ?? 0}</span>
                  </div>
                </td>
                <td className="p-4 hidden lg:table-cell">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400/50" />
                    <span className="text-sm text-surface-200/70">{formatCurrency(empresa.ventas_hoy ?? 0)}</span>
                  </div>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => toggleActiva.mutate({ id: empresa.id, activa: !empresa.activa })}
                    className={cn('text-xs px-2 py-1 rounded-lg font-medium transition-colors', empresa.activa
                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    )}
                  >
                    {empresa.activa ? 'Activa' : 'Inactiva'}
                  </button>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => navigate(`/superadmin/empresas/${empresa.id}`)}
                    className="btn-ghost btn-sm"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nueva empresa */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Nueva empresa"
        size="lg"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button
              onClick={() => crear.mutate(form)}
              disabled={!form.nombre || !form.admin_email || !form.admin_password || crear.isPending}
              className="btn-primary flex-1"
            >
              {crear.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Crear empresa'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-surface-200/50 uppercase tracking-wide mb-3">Datos del negocio</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Nombre *</label>
                <input className="input" placeholder="Nombre del establecimiento"
                  value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="bar">Bar</option>
                  <option value="discoteca">Discoteca</option>
                  <option value="bar_discoteca">Bar & Discoteca</option>
                  <option value="restaurante_bar">Restaurante Bar</option>
                </select>
              </div>
              <div>
                <label className="label">Ciudad</label>
                <input className="input" placeholder="Ciudad"
                  value={form.ciudad} onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} />
              </div>
              <div>
                <label className="label">NIT</label>
                <input className="input" placeholder="NIT o documento"
                  value={form.nit} onChange={e => setForm(p => ({ ...p, nit: e.target.value }))} />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" placeholder="Teléfono"
                  value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
              </div>
              <div>
                <label className="label">Plan</label>
                <select className="input" value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}>
                  <option value="basico">Básico</option>
                  <option value="profesional">Profesional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="label">Licencia hasta</label>
                <input type="date" className="input"
                  value={form.licencia_fin} onChange={e => setForm(p => ({ ...p, licencia_fin: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4">
            <p className="text-xs font-semibold text-surface-200/50 uppercase tracking-wide mb-3">Administrador</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre</label>
                <input className="input" placeholder="Nombre completo"
                  value={form.admin_nombre} onChange={e => setForm(p => ({ ...p, admin_nombre: e.target.value }))} />
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" placeholder="Usuario de acceso"
                  value={form.admin_username} onChange={e => setForm(p => ({ ...p, admin_username: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" placeholder="correo@ejemplo.com"
                  value={form.admin_email} onChange={e => setForm(p => ({ ...p, admin_email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Contraseña *</label>
                <input type="password" className="input" placeholder="Mínimo 8 caracteres"
                  value={form.admin_password} onChange={e => setForm(p => ({ ...p, admin_password: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
