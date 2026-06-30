import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
interface ModalProps { open:boolean; onClose:()=>void; title?:string; children:React.ReactNode; size?:'sm'|'md'|'lg'|'xl'; footer?:React.ReactNode }
const sz = { sm:'max-w-sm', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' }
export default function Modal({ open, onClose, title, children, size='md', footer }: ModalProps) {
  useEffect(() => { if (open) document.body.style.overflow='hidden'; else document.body.style.overflow=''; return ()=>{document.body.style.overflow=''} }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full bg-surface-800 border border-white/10 shadow-2xl animate-slide-up rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[95dvh]', sz[size])}>
        {title && <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0"><h2 className="text-base font-semibold text-surface-50">{title}</h2><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-surface-200/50 hover:text-white"><X className="w-4 h-4" /></button></div>}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-white/5 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
