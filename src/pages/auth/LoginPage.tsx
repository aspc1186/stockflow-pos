import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
const schema = z.object({ username: z.string().min(1,'Requerido'), password: z.string().min(1,'Requerido') })
type F = z.infer<typeof schema>
export default function LoginPage() {
  const { login } = useAuth(); const [show,setShow]=useState(false); const [loading,setLoading]=useState(false)
  const { register, handleSubmit, formState:{errors} } = useForm<F>({ resolver: zodResolver(schema) })
  const onSubmit = async (d:F) => {
    setLoading(true)
    try { await login(d.username, d.password); toast.success('Bienvenido') }
    catch(e:any) { toast.error(e?.response?.data?.message??'Credenciales inválidas') }
    finally { setLoading(false) }
  }
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-white mb-2">Iniciar sesión</h2>
      <p className="text-surface-200/50 text-sm mb-8">Ingresa tus credenciales para continuar</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div><label className="label">Usuario</label><input {...register('username')} className="input" placeholder="tu.usuario" autoFocus />{errors.username&&<p className="text-xs text-red-400 mt-1">{errors.username.message}</p>}</div>
        <div><label className="label">Contraseña</label>
          <div className="relative"><input {...register('password')} type={show?'text':'password'} className="input pr-10" placeholder="••••••••" /><button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200/40">{show?<EyeOff className="w-4 h-4" />:<Eye className="w-4 h-4" />}</button></div>
          {errors.password&&<p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
        </div>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300">¿Olvidaste tu contraseña?</Link></div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
          {loading?<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />:<><LogIn className="w-5 h-5" />Ingresar</>}
        </button>
      </form>
    </div>
  )
}
