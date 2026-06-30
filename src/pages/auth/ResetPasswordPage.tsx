import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
export default function ResetPasswordPage() {
  const { token } = useParams<{token:string}>(); const navigate = useNavigate()
  const [p,setP]=useState(''); const [c,setC]=useState(''); const [show,setShow]=useState(false); const [loading,setLoading]=useState(false)
  const onSubmit=async(e:React.FormEvent)=>{ e.preventDefault(); if(p!==c){toast.error('Las contraseñas no coinciden');return} setLoading(true)
    try { await api.post('/auth/reset-password',{token,password:p}); toast.success('Contraseña actualizada'); navigate('/login') }
    catch { toast.error('Enlace inválido o expirado') } finally { setLoading(false) }
  }
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-white mb-2">Nueva contraseña</h2>
      <form onSubmit={onSubmit} className="space-y-5 mt-8">
        <div><label className="label">Nueva contraseña</label>
          <div className="relative"><input type={show?'text':'password'} className="input pr-10" value={p} onChange={e=>setP(e.target.value)} placeholder="Mínimo 8 caracteres" /><button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200/40">{show?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button></div>
        </div>
        <div><label className="label">Confirmar</label><input type={show?'text':'password'} className="input" value={c} onChange={e=>setC(e.target.value)} /></div>
        <button type="submit" disabled={loading||!p||!c} className="btn-primary w-full py-3">
          {loading?<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Actualizar contraseña'}
        </button>
      </form>
    </div>
  )
}
