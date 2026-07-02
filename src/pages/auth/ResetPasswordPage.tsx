import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({password:'',confirm:''})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Las contraseñas no coinciden'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    toast.success('Contraseña actualizada')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center mb-4"><Lock className="w-6 h-6 text-brand-400"/></div>
          <h2 className="text-2xl font-bold text-surface-50 mb-2">Nueva contraseña</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div><label className="label">Nueva contraseña</label><input type="password" className="input" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} required/></div>
          <div><label className="label">Confirmar contraseña</label><input type="password" className="input" value={form.confirm} onChange={e=>setForm(p=>({...p,confirm:e.target.value}))} required/></div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : 'Actualizar contraseña'}
          </button>
        </form>
        <div className="text-center mt-4"><Link to="/login" className="text-sm text-surface-200/50 hover:text-surface-200">Volver al login</Link></div>
      </div>
    </div>
  )
}
