import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ScanLine } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/axios'
import Scanner from '@/components/scanner/Scanner'

export default function ScannerPage({ modo }:{modo:'qr'|'barras'}) {
  const [codigo,setCodigo]=useState('')
  const { data: productos=[] }=useQuery({queryKey:['productos-escaner'],enabled:!!codigo,queryFn:async()=>{const {data}=await api.get<any>('/productos');return data.data||data}})
  const producto=productos.find((item:any)=>String(item.codigo||'').trim().toLowerCase()===codigo.trim().toLowerCase())
  const detectar=(valor:string)=>{setCodigo(valor);toast.success(`Codigo capturado: ${valor}`)}
  return <div className="mx-auto max-w-2xl space-y-5"><div className="page-header"><div><h1 className="page-title">{modo==='qr'?'Escanear QR':'Escanear codigo de barras'}</h1><p className="page-subtitle">Valida el codigo antes de registrar una entrada o venta.</p></div></div><div className="card p-4"><Scanner modo={modo} onDetectar={detectar}/></div>{codigo&&<div className="card p-4"><div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-emerald-400"/><div><p className="text-xs uppercase text-surface-200/45">Codigo detectado</p><p className="font-mono text-surface-50">{codigo}</p></div></div>{modo==='barras'&&<div className="mt-4 rounded-lg border border-white/10 p-3">{producto?<><p className="font-semibold text-surface-50">{producto.nombre}</p><p className="mt-1 text-sm text-surface-200/60">SKU: {producto.codigo} · Unidad: {producto.unidad_medida||'unidad'}</p><p className="mt-3 text-xs text-emerald-300">Producto validado. Registra la cantidad desde Inventario para crear la entrada y su trazabilidad.</p></>:<p className="text-sm text-amber-300">No existe un producto con este codigo en la empresa activa.</p>}</div>}</div>}<p className="flex items-center gap-2 text-xs text-surface-200/45"><ScanLine className="h-4 w-4"/>Compatible con lectores que envian el codigo como teclado y presionan Enter.</p></div>
}
