import { useEffect, useRef, useState } from 'react'
import { Camera, Keyboard, ScanLine } from 'lucide-react'

type ScannerProps = { modo:'qr'|'barras'; onDetectar:(codigo:string)=>void; continuo?:boolean }

export default function Scanner({ modo, onDetectar, continuo=false }:ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const ultimoCodigoRef = useRef<{codigo:string;at:number}>({codigo:'',at:0})
  const [manual, setManual] = useState('')
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [mensaje, setMensaje] = useState('Usa la camara o un lector USB/Bluetooth configurado como teclado.')
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
      const formats=modo==='qr'?['qr_code']:['ean_13','ean_8','upc_a','upc_e','code_128','code_39']
      const detector=new Detector({formats})
      setCamaraActiva(true); setMensaje('Enfoca el codigo dentro del recuadro.')
      timerRef.current=window.setInterval(async()=>{ try { if(!videoRef.current) return; const resultados=await detector.detect(videoRef.current); if(resultados?.[0]?.rawValue){ confirmar(resultados[0].rawValue,'camara'); if(!continuo) detener() } } catch {} },450)
    } catch(error:any) { detener(); setMensaje(error?.message||'No se pudo iniciar la camara') }
  }
  useEffect(()=>()=>detener(),[])
  return <div className="space-y-4"><div className="overflow-hidden rounded-lg border border-white/10 bg-black/30"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover"/><div className="border-t border-white/10 p-3 text-sm text-surface-200/65">{mensaje}</div></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-primary min-h-11" onClick={iniciar}><Camera className="h-4 w-4"/>{camaraActiva?'Reiniciar camara':'Usar camara'}</button>{camaraActiva&&<button type="button" className="btn-secondary min-h-11" onClick={detener}>Detener</button>}</div><div className="flex gap-2"><div className="relative flex-1"><Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-200/45"/><input autoFocus className="input min-h-11 pl-10" value={manual} onChange={event=>setManual(event.target.value)} onKeyDown={event=>{if(event.key==='Enter') confirmar(manual)}} placeholder={modo==='qr'?'Pega o escanea el QR':'Escribe o escanea el codigo de barras'}/></div><button type="button" className="btn-secondary min-h-11" onClick={()=>confirmar(manual)}><ScanLine className="h-4 w-4"/>Validar</button></div></div>
}
