import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
const sizes={sm:'max-w-sm',md:'max-w-md',lg:'max-w-lg',xl:'max-w-2xl'}
export default function Modal({open,onClose,title,children,footer,size='md'}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;footer?:ReactNode;size?:'sm'|'md'|'lg'|'xl'}){
  useEffect(()=>{ document.body.style.overflow=open?'hidden':''; return()=>{document.body.style.overflow=''} },[open])
  if(!open) return null
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/><div className={cn('relative w-full bg-surface-800 rounded-2xl border border-white/10 shadow-2xl',sizes[size])}><div className="flex items-center justify-between p-5 border-b border-white/5"><h3 className="text-base font-semibold text-surface-50">{title}</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-surface-200/50"><X className="w-4 h-4"/></button></div><div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>{footer&&<div className="p-5 border-t border-white/5">{footer}</div>}</div></div>
}
