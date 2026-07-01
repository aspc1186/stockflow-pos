import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import api from '@/lib/axios'

interface Empresa {
  id: string
  nombre: string
  slug: string
  tipo: string
  logo_url?: string
  color_primario?: string
  activa?: boolean
}

interface User {
  id: string
  nombre: string
  email: string
  username: string
  rol: string
  empresa_id?: string
  empresa?: Empresa
  token?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  isAdmin: boolean
  isSuperAdmin: boolean
  isMesero: boolean
  isRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pos_token')
    const saved = localStorage.getItem('pos_user')
    if (token && saved) {
      try {
        const u = JSON.parse(saved)
        // Añadir token al user object para compatibilidad con SocketContext
        setUser({ ...u, token })
      } catch {
        localStorage.removeItem('pos_token')
        localStorage.removeItem('pos_user')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<{ ok?: boolean; success?: boolean; token: string; user: User }>('/auth/login', { username, password })
    if (data.ok === false || data.success === false) throw new Error('Credenciales inválidas')
    const token = data.token
    const userData = { ...data.user, token }
    localStorage.setItem('pos_token', token)
    localStorage.setItem('pos_user', JSON.stringify(data.user))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pos_token')
    localStorage.removeItem('pos_user')
    setUser(null)
    window.location.href = '/login'
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<{ ok?: boolean; data: User }>('/auth/me')
      const token = localStorage.getItem('pos_token') || ''
      const userData = { ...(data.data || data as any), token }
      localStorage.setItem('pos_user', JSON.stringify(data.data || data))
      setUser(userData)
    } catch {
      logout()
    }
  }, [logout])

  const isRole = useCallback((...roles: string[]) => {
    return roles.includes(user?.rol ?? '')
  }, [user])

  const isAdmin = isRole('admin', 'superadmin', 'supervisor')
  const isSuperAdmin = isRole('superadmin')
  const isMesero = isRole('mesero', 'barra')

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, isAdmin, isSuperAdmin, isMesero, isRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
