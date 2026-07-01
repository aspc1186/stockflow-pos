import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import api from '@/lib/axios'

interface User {
  id: string
  nombre: string
  email: string
  username: string
  rol: string
  empresa_id?: string
  empresa?: {
    id: string
    nombre: string
    slug: string
    tipo: string
    logo_url?: string
    color_primario?: string
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  isSuperAdmin: boolean
  isMesero: boolean
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
        setUser(JSON.parse(saved))
      } catch {
        localStorage.removeItem('pos_token')
        localStorage.removeItem('pos_user')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<{ ok: boolean; token: string; user: User }>('/auth/login', { username, password })
    if (!data.ok) throw new Error('Credenciales inválidas')
    localStorage.setItem('pos_token', data.token)
    localStorage.setItem('pos_user', JSON.stringify(data.user))
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pos_token')
    localStorage.removeItem('pos_user')
    setUser(null)
    window.location.href = '/login'
  }, [])

  const isAdmin = user?.rol === 'admin' || user?.rol === 'superadmin' || user?.rol === 'supervisor'
  const isSuperAdmin = user?.rol === 'superadmin'
  const isMesero = user?.rol === 'mesero' || user?.rol === 'barra'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isSuperAdmin, isMesero }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
