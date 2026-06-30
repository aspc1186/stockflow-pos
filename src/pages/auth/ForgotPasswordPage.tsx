import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
export default function ForgotPasswordPage() {
  const [email,setEmail]=useState(''); const [loading,setLoading]=useState(false); const [sent,setSent]=useState(false)
  const onSubmit=async(e:React.FormEvent)=>{ e.preventDefault(); setLoading(true)
    try { await api.post('/auth/forgot-password',{email}); setSent(true) }
    catch { toast.error('No se pudo enviar el correo') } finally { setLoading(false) }
  }
  if (sent) return (
    <div className="text-center animate-fade-in">
      <div className="w-16 h-16 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6"><Mail className="w-8 h-8 text-brand-400" /></div>
      <h2 className="text-xl font-bold text-white mb-2">Revisa tu correo</h2>
      <p className="text-surface-200/50 text-sm mb-8">Si ese email existe, recibirás un enlace de recuperación.</p>
      <Link to="/login" className="btn-secondary inline-flex"><ArrowLeft className="w-4 h-4" />Volver</Link>
    </div>
  )
  return (
    <div className="animate-fade-in">
      <Link to="/login" className="flex items-center gap-2 text-sm text-surface-200/50 hover:text-surface-200 mb-8"><ArrowLeft className="w-4 h-4" />Volver</Link>
      <h2 className="text-2xl font-bold text-white mb-2">Recuperar contraseña</h2>
      <form onSubmit={onSubmit} className="space-y-5 mt-8">
        <div><label className="label">Email</label><input type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" autoFocus /></div>
        <button type="submit" disabled={loading||!email} className="btn-primary w-full py-3">
          {loading?<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />:'Enviar enlace'}
        </button>
      </form>
    </div>
  )
}
