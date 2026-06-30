import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
interface P { open:boolean; onClose:()=>void; onConfirm:()=>void; title:string; message:string; confirmLabel?:string; danger?:boolean; loading?:boolean }
export default function ConfirmDialog({ open,onClose,onConfirm,title,message,confirmLabel='Confirmar',danger=false,loading=false }:P) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="text-center py-2">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${danger?'bg-red-500/20':'bg-amber-500/20'}`}><AlertTriangle className={`w-6 h-6 ${danger?'text-red-400':'text-amber-400'}`} /></div>
        <h3 className="text-base font-semibold text-surface-50 mb-2">{title}</h3>
        <p className="text-sm text-surface-200/60">{message}</p>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary flex-1" disabled={loading}>Cancelar</button>
        <button onClick={onConfirm} disabled={loading} className={`flex-1 btn ${danger?'bg-red-600 hover:bg-red-500 text-white':'btn-primary'}`}>
          {loading?<span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />:confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
