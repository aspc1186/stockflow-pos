import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import api from '@/lib/axios'
import { formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'

export default function MenuDigitalPage() {
  const { empresa, mesa } = useParams<{empresa:string;mesa:string}>()
  const {data,isLoading,error}=useQuery({queryKey:['menu-publico',empresa,mesa],queryFn:async()=>{const {data}=await api.get(`/menu/${empresa}/${encodeURIComponent(mesa||'')}`);return data.data},enabled:!!empresa&&!!mesa})
  if(isLoading)return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><PageLoader/></div>
  if(error||!data)return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">Este código QR no corresponde a una mesa activa.</div>
  return <main className="min-h-screen bg-slate-950 text-slate-100"><header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 p-5 backdrop-blur"><div className="mx-auto flex max-w-3xl items-center gap-3">{data.empresa.logo_url&&<img src={data.empresa.logo_url} className="h-10 w-10 rounded-lg object-cover"/>}<div><h1 className="font-bold">{data.empresa.nombre}</h1><p className="text-sm text-slate-400">Menú digital · Mesa {data.mesa.numero}{data.mesa.nombre?` · ${data.mesa.nombre}`:''}</p></div></div></header><section className="mx-auto max-w-3xl p-4 sm:p-6"><div className="grid gap-3 sm:grid-cols-2">{data.productos.map((p:any)=><article key={p.id} className="flex gap-3 rounded-xl border border-white/10 bg-slate-900 p-3">{p.imagen_url?<img src={p.imagen_url} alt={p.nombre} className="h-20 w-20 rounded-lg object-cover"/>:<div className="h-20 w-20 rounded-lg bg-brand-600/20"/>}<div className="min-w-0 flex-1"><p className="font-semibold">{p.nombre}</p><p className="mt-1 line-clamp-2 text-xs text-slate-400">{p.descripcion||p.categoria||'Producto disponible'}</p><p className="mt-2 font-bold text-brand-300">{formatCurrency(p.precio_venta)}</p></div></article>)}</div>{data.productos.length===0&&<p className="py-16 text-center text-slate-400">El menú aún no tiene productos disponibles.</p>}</section></main>
}
