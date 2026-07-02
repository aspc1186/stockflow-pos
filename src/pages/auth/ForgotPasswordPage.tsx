import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setSent(true); setLoading(false)
    toast.success('Si el email existe, recibirás instrucciones')
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Link to="/login" className="flex items-center gap-2 text-surface-200/50 hover:text-surface-200 text-sm mb-8">
          <ArrowLeft className="w-4 h-4"/> Volver al login
        </Link>
        <div className="mb-8">
          <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center mb-4"><Mail className="w-6 h-6 text-brand-400"/></div>
          <h2 className="text-2xl font-bold text-surface-50 mb-2">Recuperar contraseña</h2>
          <p className="text-surface-200/50">Te enviaremos instrucciones a tu correo</p>
        </div>
        {sent ? (
          <div className="card p-6 text-center">
            <p className="text-surface-200/70 mb-4">Revisa tu correo electrónico</p>
            <Link to="/login" className="btn-primary">Volver al login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div><label className="label">Email</label><input type="email" className="input" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required/></div>
            <button type="submit" disabled={loading || !email} className="btn-primary w-full">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : 'Enviar instrucciones'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
