import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Wine, Lock, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

interface LoginForm {
  username: string
  password: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, user } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  // Redirigir si ya está autenticado
  if (user) {
    if (user.rol === 'superadmin') navigate('/superadmin')
    else navigate('/app/dashboard')
  }

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      await login(data.username.trim(), data.password)
      const saved = localStorage.getItem('pos_user')
      if (saved) {
        const u = JSON.parse(saved)
        if (u.rol === 'superadmin') navigate('/superadmin')
        else navigate('/app/dashboard')
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.msg ?? 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-900 via-surface-900 to-surface-950 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-800/20 via-transparent to-transparent" />
        <div className="relative z-10 text-center">
          <div className="w-24 h-24 bg-brand-600/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-brand-500/30">
            <Wine className="w-12 h-12 text-brand-400" />
          </div>
          <h1 className="text-4xl font-bold text-surface-50 mb-4">POS Manager</h1>
          <p className="text-surface-200/60 text-lg mb-8">Plataforma profesional para<br />restaurantes, bares y discotecas</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {['Mesas', 'Pedidos', 'Reportes'].map(item => (
              <div key={item} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-sm font-medium text-surface-200/70">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho - formulario */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-950">
        <div className="w-full max-w-md">
          {/* Logo móvil */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
              <Wine className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-surface-50">POS Manager</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-surface-50 mb-2">Iniciar sesión</h2>
            <p className="text-surface-200/50">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30" />
                <input
                  {...register('username', { required: 'Usuario requerido' })}
                  className="input pl-10"
                  placeholder="Tu usuario"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {errors.username && <p className="text-xs text-red-400 mt-1">{errors.username.message}</p>}
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30" />
                <input
                  {...register('password', { required: 'Contraseña requerida' })}
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200/30 hover:text-surface-200/60"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-11 text-base font-semibold"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-surface-200/25 mt-8">
            POS Manager © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
