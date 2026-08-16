import { useEffect, useRef, useState } from 'react'
import { Camera, Keyboard, ScanLine } from 'lucide-react'
import api from '@/lib/axios'

export type ScannerSuggestion = { id:string; nombre:string; codigo?:string; id_producto?:string; precio_venta?:number|string }
type ScannerProps = { modo:'qr'|'barras'|'mixto'; onDetectar:(codigo:string)=>void; continuo?:boolean; sugerencias?:ScannerSuggestion[] }

export default function Scanner({ modo, onDetectar, continuo=false, sugerencias=[] }:ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const ultimoCodigoRef = useRef<{codigo:string;at:number}>({codigo:'',at:0})
  const [manual, setManual] = useState('')
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [mensaje, setMensaje] = useState('Usa la camara o un lector USB/Bluetooth configurado como teclado.')
  const [catalogo, setCatalogo] = useState<ScannerSuggestion[]>(sugerencias)
  const productosDisponibles = Array.isArray(sugerencias) && sugerencias.length
    ? sugerencias
    : Array.isArray(catalogo) ? catalogo : []
  const coincidencias = manual.trim().length > 0 ? productosDisponibles.filter(producto => `${producto.nombre} ${producto.codigo || ''} ${producto.id_producto || ''}`.toLowerCase().includes(manual.trim().toLowerCase())).slice(0, 8) : []
  const confirmar = (valor:string, origen:'camara'|'manual'='manual') => { const codigo=valor.trim(); if(!codigo) return; const ahora=Date.now(); if(origen==='camara'&&continuo&&ultimoCodigoRef.current.codigo===codigo&&ahora-ultimoCodigoRef.current.at<1400)return; ultimoCodigoRef.current={codigo,at:ahora}; onDetectar(codigo); setManual('') }
  const detener = () => { if(timerRef.current) window.clearInterval(timerRef.current); timerRef.current=null; streamRef.current?.getTracks().forEach(track=>track.stop()); streamRef.current=null; setCamaraActiva(false) }
  const iniciar = async () => {
    try {
      detener()
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la camara')
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})
      streamRef.current=stream
      if(videoRef.current){ videoRef.current.srcObject=stream; await videoRef.current.play() }
      const Detector=(window as any).BarcodeDetector
      if(!Detector){ setMensaje('Camara activa. Tu navegador no ofrece deteccion nativa; usa un lector fisico o escribe el codigo.'); setCamaraActiva(true); return }
      const formats=modo==='qr' ? ['qr_code'] : ['qr_code','ean_13','ean_8','upc_a','upc_e','code_128','code_39']
      const soportados=typeof Detector.getSupportedFormats === 'function' ? await Detector.getSupportedFormats() : formats
      const compatibles=formats.filter((format:string) => soportados.includes(format))
      const detector=new Detector({formats:compatibles.length ? compatibles : formats})
      setCamaraActiva(true); setMensaje('Enfoca el codigo dentro del recuadro.')
      timerRef.current=window.setInterval(async()=>{ try { if(!videoRef.current) return; const resultados=await detector.detect(videoRef.current); if(resultados?.[0]?.rawValue){ confirmar(resultados[0].rawValue,'camara'); if(!continuo) detener() } } catch {} },450)
    } catch(error:any) { detener(); setMensaje(error?.message||'No se pudo iniciar la camara') }
  }
  useEffect(()=>()=>detener(),[])
  useEffect(() => {
    if (modo === 'qr' || sugerencias.length) return
    api.get('/productos').then(({data}) => {
      const respuesta = data?.data ?? data
      const lista = Array.isArray(respuesta) ? respuesta : Array.isArray(respuesta?.productos) ? respuesta.productos : []
      setCatalogo(lista)
    }).catch(() => setCatalogo([]))
  }, [modo, sugerencias.length])
  return <div className="stockflow-scanner space-y-3"><div className="w-full max-w-[260px] overflow-hidden rounded-lg border border-white/10 bg-black"><video ref={videoRef} muted playsInline className="block h-36 w-full bg-black object-cover"/><div className="border-t border-white/10 px-3 py-2 text-xs text-surface-200/65">{mensaje}</div></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-primary min-h-10" onClick={iniciar}><Camera className="h-4 w-4"/>{camaraActiva?'Reiniciar camara':'Usar camara'}</button>{camaraActiva&&<button type="button" className="btn-secondary min-h-10" onClick={detener}>Detener</button>}</div><div className="relative z-30 flex gap-2"><div className="relative flex-1"><Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-200/45"/><input autoFocus className="input min-h-10 pl-10" value={manual} onChange={event=>setManual(event.target.value)} onKeyDown={event=>{if(event.key==='Enter') confirmar(manual)}} placeholder={modo==='qr'?'Pega o escanea el QR':'Escribe o escanea el codigo, QR o nombre'}/>{modo!=='qr' && coincidencias.length>0 && <div className="scanner-suggestions absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-white/10 bg-surface-900 shadow-2xl">{coincencias.map(producto=><button key={producto.id} type="button" className="flex w-full items-center justify-between gap-3 border-b border-white/5 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-white/10" onClick={()=>confirmar(producto.codigo || producto.id_producto || producto.id)}><span className="min-w-0"><strong className="block truncate">{producto.nombre}</strong><small className="block text-surface-200/55">{producto.codigo || producto.id_producto || 'Sin codigo'}</small></span></button>)}</div>}</div><button type="button" className="btn-secondary min-h-10" onClick={()=>confirmar(manual)}><ScanLine className="h-4 w-4"/>Validar</button></div></div>
}
