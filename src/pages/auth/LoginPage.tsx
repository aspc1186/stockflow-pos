import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

interface LoginForm { username: string; password: string }

export default function LoginPage() {
  const navigate = useNavigate(); const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      await login(data.username, data.password)
      const saved = localStorage.getItem('pos_user')
      if (saved) {
        const u = JSON.parse(saved)
        navigate(u.rol === 'superadmin' ? '/superadmin' : ['mesero','barra','cajero'].includes(u.rol) ? '/mesero' : '/app/dashboard', { replace: true })
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.msg ?? e?.response?.data?.message ?? 'Credenciales invalidas')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#020915] text-surface-50 lg:grid lg:grid-cols-[58%_42%]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 lg:block">
        <img src="/images/stockflow-login.png" alt="StockFlow POS" className="absolute inset-0 h-full w-full object-contain" />
      </section>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-8 lg:px-12">
        <div className="absolute inset-0 lg:hidden">
          <img src="/images/stockflow-login.png" alt="" className="h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-[#020915]/80" />
        </div>
        <div className="relative z-10 w-full max-w-[30rem]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-brand-400/40 bg-brand-600/20 text-lg font-bold text-lime-400">S</div>
            <div>
              <p className="text-lg font-bold leading-tight text-white">StockFlow <span className="text-lime-400">- POS</span></p>
              <p className="text-xs text-surface-200/50">Ventas, inventario y operaciones</p>
            </div>
          </div>
          <div className="mb-8">
            <p className="mb-3 hidden text-xl font-bold text-white lg:block">StockFlow <span className="text-lime-400">- POS</span></p>
            <h1 className="text-3xl font-bold text-surface-50 mb-2">Iniciar sesión</h1>
            <p className="text-surface-200/50">Ingresa tus credenciales para continuar</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Usuario o correo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30"/>
                <input {...register('username',{required:'Usuario requerido'})} className="input h-12 pl-10" placeholder="Ingresa tu usuario" autoComplete="username" autoFocus/>
              </div>
              {errors.username && <p className="text-xs text-red-400 mt-1">{errors.username.message}</p>}
            </div>
            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30"/>
                <input {...register('password',{required:'Contraseña requerida'})} type={showPassword?'text':'password'} className="input h-12 pl-10 pr-10" placeholder="Ingresa tu contraseña" autoComplete="current-password"/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200/30 hover:text-surface-200/60">
                  {showPassword?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary h-12 w-full text-base font-semibold shadow-lg shadow-brand-600/20">
              {loading ? <span className="flex items-center gap-2 justify-center"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Ingresando...</span> : 'Ingresar al sistema'}
            </button>
          </form>
          <p className="mt-8 text-center text-xs text-surface-200/25">StockFlow POS {new Date().getFullYear()}</p>
        </div>
      </main>
    </div>
  )
}
