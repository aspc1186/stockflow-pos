import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import api from '@/lib/axios'

interface Empresa {
  id: string
  nombre: string
  slug: string
  tipo: string
  logo_url?: string
  color_primario?: string
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
        setUser({ ...JSON.parse(saved), token })
      } catch {
        localStorage.removeItem('pos_token')
        localStorage.removeItem('pos_user')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<any>('/auth/login', { username: username.trim(), password })
    if (data.ok === false) throw new Error('Credenciales inválidas')
    const token = data.token
    const userData = data.user || data.data
    localStorage.setItem('pos_token', token)
    localStorage.setItem('pos_user', JSON.stringify(userData))
    setUser({ ...userData, token })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pos_token')
    localStorage.removeItem('pos_user')
    setUser(null)
    window.location.href = '/login'
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<any>('/auth/me')
      const token = localStorage.getItem('pos_token') || ''
      const userData = data.data || data
      localStorage.setItem('pos_user', JSON.stringify(userData))
      setUser({ ...userData, token })
    } catch {
      logout()
    }
  }, [logout])

  const isRole = useCallback((...roles: string[]) => roles.includes(user?.rol ?? ''), [user])
  const isAdmin = isRole('admin', 'superadmin', 'supervisor')
  const isSuperAdmin = isRole('superadmin')
  const isMesero = isRole('mesero', 'barra', 'cajero')

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
