import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import api from '@/lib/axios'

interface Empresa { id: string; nombre: string; slug: string; tipo: string; logo_url?: string; color_primario?: string; telefono?: string; email?: string; ciudad?: string; licencia_fin?: string; tema?: string; fondo_url?: string; notificacion_pago?: string; notificacion_pago_at?: string }
interface User { id: string; nombre: string; email: string; username: string; rol: string; empresa_id?: string; empresa?: Empresa; token?: string }
interface AuthContextType {
  user: User | null; loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void; refreshUser: () => Promise<void>
  startSupport: (empresaId: string) => Promise<void>; exitSupport: () => void; supportMode: boolean
  isAdmin: boolean; isSuperAdmin: boolean; isMesero: boolean
  isRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)
const TEMAS_VALIDOS = new Set(['noche','discoteca','restaurante','claro','oceano','bosque','vino','ambar','grafito'])

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const esRutaPublica = typeof window !== 'undefined' && window.location.pathname.startsWith('/menu/')

  useEffect(() => {
    // A QR menu is public. An expired POS session saved on a customer's phone
    // must never redirect that customer to the login page.
    if (esRutaPublica) { setLoading(false); return }
    const token = localStorage.getItem('pos_token')
    const saved = localStorage.getItem('pos_user')
    if (token && saved) {
      try { setUser({ ...JSON.parse(saved), token }) }
      catch { localStorage.removeItem('pos_token'); localStorage.removeItem('pos_user') }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const tema = user?.empresa?.tema || 'noche'
    document.body.dataset.theme = TEMAS_VALIDOS.has(tema) ? tema : 'noche'
  }, [user?.empresa?.tema])

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<any>('/auth/login', { username: username.trim(), password })
    if (data.ok === false) throw new Error('Credenciales inválidas')
    localStorage.setItem('pos_token', data.token)
    localStorage.setItem('pos_user', JSON.stringify(data.user || data.data))
    setUser({ ...(data.user || data.data), token: data.token })
  }, [esRutaPublica])

  const restoreSuperAdmin = useCallback(() => {
    const token = localStorage.getItem('pos_superadmin_token')
    const saved = localStorage.getItem('pos_superadmin_user')
    if (!token || !saved) return false
    try {
      const superUser = JSON.parse(saved)
      localStorage.setItem('pos_token', token)
      localStorage.setItem('pos_user', saved)
      localStorage.removeItem('pos_superadmin_token')
      localStorage.removeItem('pos_superadmin_user')
      localStorage.removeItem('pos_support_mode')
      setUser({ ...superUser, token })
      return true
    } catch { return false }
  }, [])

  const startSupport = useCallback(async (empresaId: string) => {
    const currentToken = localStorage.getItem('pos_token')
    const currentUser = localStorage.getItem('pos_user')
    if (!currentToken || !currentUser) throw new Error('Sesion de superadministrador no disponible')
    const { data } = await api.post<any>(`/superadmin/empresas/${empresaId}/support-session`)
    const session = data.data || data
    if (!session?.token || !session?.user) throw new Error('No fue posible iniciar el modo de soporte')
    localStorage.setItem('pos_superadmin_token', currentToken)
    localStorage.setItem('pos_superadmin_user', currentUser)
    localStorage.setItem('pos_support_mode', '1')
    localStorage.setItem('pos_token', session.token)
    localStorage.setItem('pos_user', JSON.stringify(session.user))
    setUser({ ...session.user, token: session.token })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pos_token'); localStorage.removeItem('pos_user'); localStorage.removeItem('pos_superadmin_token'); localStorage.removeItem('pos_superadmin_user'); localStorage.removeItem('pos_support_mode')
    setUser(null); window.location.href = '/login'
  }, [])

  const exitSupport = useCallback(() => {
    if (!restoreSuperAdmin()) {
      localStorage.removeItem('pos_support_mode')
      localStorage.removeItem('pos_superadmin_token')
      localStorage.removeItem('pos_superadmin_user')
      logout()
      return
    }
    window.location.href = '/superadmin'
  }, [restoreSuperAdmin, logout])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<any>('/auth/me')
      const token = localStorage.getItem('pos_token') || ''
      const u = data.data || data
      localStorage.setItem('pos_user', JSON.stringify(u))
      setUser({ ...u, token })
    } catch {
      if (localStorage.getItem('pos_support_mode') === '1' && restoreSuperAdmin()) { window.location.href = '/superadmin'; return }
      logout()
    }
  }, [logout, restoreSuperAdmin])

  useEffect(() => {
    if (!user) return
    void refreshUser()
    const intervalo = window.setInterval(() => void refreshUser(), 5 * 60 * 1000)
    return () => window.clearInterval(intervalo)
  }, [user?.id, refreshUser])

  const isRole = useCallback((...roles: string[]) => roles.includes(user?.rol ?? ''), [user])
  const isAdmin = isRole('admin', 'superadmin', 'supervisor')
  const isSuperAdmin = isRole('superadmin')
  const isMesero = isRole('mesero', 'barra', 'cajero')

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, startSupport, exitSupport, supportMode: localStorage.getItem('pos_support_mode') === '1', isAdmin, isSuperAdmin, isMesero, isRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
