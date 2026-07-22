import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ImageUp, Save } from 'lucide-react'
import api from '@/lib/axios'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

export default function ConfiguracionPage() {
  const { user, refreshUser } = useAuth()
  const empresa = user?.empresa as any
  const [form, setForm] = useState({ nombre:empresa?.nombre??'', telefono:empresa?.telefono??'', email:empresa?.email??'', ciudad:empresa?.ciudad??'', tipo:empresa?.tipo??'bar', tema:empresa?.tema??'noche', fondo_url:empresa?.fondo_url??'' })
  const inputImagenRef = useRef<HTMLInputElement>(null)
  const [leyendoImagen, setLeyendoImagen] = useState(false)

  const cargarImagen = (archivo?: File) => {
    if (!archivo) return
    if (!archivo.type.startsWith('image/')) return toast.error('Selecciona un archivo de imagen')
    if (archivo.size > 1500 * 1024) return toast.error('La imagen debe pesar menos de 1.5 MB')
    setLeyendoImagen(true)
    const reader = new FileReader()
    reader.onload = () => {
      setForm(p => ({ ...p, fondo_url: String(reader.result || '') }))
      setLeyendoImagen(false)
    }
    reader.onerror = () => {
      setLeyendoImagen(false)
      toast.error('No se pudo leer la imagen')
    }
    reader.readAsDataURL(archivo)
  }
  const guardar = useMutation({
    mutationFn: () => api.patch(`/empresas/${empresa?.id}`, form),
    onSuccess: async () => { await refreshUser(); toast.success('Configuración guardada') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudo guardar la configuracion'),
  })
  if (!empresa) return <div className="flex items-center justify-center h-64"><p className="text-surface-200/40">Sin empresa configurada</p></div>
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="page-header"><h1 className="page-title">Configuración</h1></div>
      <div className="card p-6 space-y-5">
        <h3 className="text-sm font-semibold text-surface-200/70 uppercase tracking-wide">Información del negocio</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div><label className="label">Tipo</label><select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>{['bar','discoteca','bar_discoteca','restaurante_bar','restaurante'].map(t=><option key={t} value={t} className="bg-surface-800 capitalize">{t.replace('_',' ')}</option>)}</select></div>
          <div><label className="label">Ciudad</label><input className="input" value={form.ciudad} onChange={e=>setForm(p=>({...p,ciudad:e.target.value}))}/></div>
          <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/></div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></div>
        </div>
        <button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="btn-primary">
          {guardar.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<><Save className="w-4 h-4"/>Guardar cambios</>}
        </button>
      </div>
      <div className="card p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-surface-200/70 uppercase tracking-wide">Apariencia</h3>
          <p className="text-xs text-surface-200/45 mt-1">El tema y la imagen se aplican a todos los usuarios de esta empresa.</p>
        </div>
        <div>
          <label className="label">Tema visual</label>
          <select className="input" value={form.tema} onChange={e=>setForm(p=>({...p,tema:e.target.value}))}>
            <option value="noche" className="bg-surface-800">Noche profesional</option>
            <option value="discoteca" className="bg-surface-800">Discoteca neón</option>
            <option value="restaurante" className="bg-surface-800">Restaurante</option>
            <option value="claro" className="bg-surface-800">Claro</option>
            <option value="oceano" className="bg-surface-800">Oceano ejecutivo</option>
            <option value="bosque" className="bg-surface-800">Bosque elegante</option>
            <option value="vino" className="bg-surface-800">Vino nocturno</option>
            <option value="ambar" className="bg-surface-800">Ambar lounge</option>
            <option value="grafito" className="bg-surface-800">Grafito moderno</option>
          </select>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div><label className="label">Imagen de fondo</label><p className="text-xs text-surface-200/45">JPG, PNG o WebP, máximo 1.5 MB.</p></div>
            <input ref={inputImagenRef} type="file" accept="image/*" className="hidden" onChange={e=>cargarImagen(e.target.files?.[0])}/>
            <button type="button" className="btn-secondary shrink-0" onClick={()=>inputImagenRef.current?.click()} disabled={leyendoImagen}>
              <ImageUp className="w-4 h-4"/>{leyendoImagen ? 'Cargando...' : 'Subir imagen'}
            </button>
          </div>
          <div className="h-32 rounded-lg border border-surface-700 overflow-hidden bg-surface-900 bg-cover bg-center flex items-end p-4" style={form.fondo_url ? { backgroundImage: `linear-gradient(rgba(10,16,30,.45), rgba(10,16,30,.75)), url(${form.fondo_url})` } : undefined}>
            <span className="text-sm font-semibold text-white">{form.nombre || 'Nombre de la empresa'}</span>
          </div>
          {form.fondo_url && <button type="button" className="text-sm text-red-300 hover:text-red-200" onClick={()=>setForm(p=>({...p,fondo_url:''}))}>Quitar imagen de fondo</button>}
        </div>
        <button onClick={() => guardar.mutate()} disabled={guardar.isPending || leyendoImagen} className="btn-primary">
          {guardar.isPending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<><Save className="w-4 h-4"/>Guardar apariencia</>}
        </button>
      </div>
    </div>
  )
}
