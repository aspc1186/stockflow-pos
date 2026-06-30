import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Plus, Lock, Unlock } from 'lucide-react'
import api from '@/lib/axios'
import type { Caja, CajaMovimiento } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export default function CajaPage() {
  const qc=useQueryClient()
  const [modalAbrir,setModalAbrir]=useState(false); const [modalMov,setModalMov]=useState(false); const [modalCerrar,setModalCerrar]=useState(false)
  const [saldoI,setSaldoI]=useState('0')
  const [mov,setMov]=useState({tipo:'ingreso',monto:'',descripcion:'',metodo_pago:'efectivo'})

  const {data,isLoading}=useQuery({
    queryKey:['caja'],
    queryFn:async()=>{const {data}=await api.get<{data:{caja:Caja;movimientos:CajaMovimiento[]}}>('/caja');return data.data},
    refetchInterval:15_000,
  })
  const op=useMutation({
    mutationFn:(body:Record<string,unknown>)=>api.post('/caja',body),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['caja']});setModalAbrir(false);setModalMov(false);setModalCerrar(false);toast.success('Operación exitosa')},
    onError:(e:any)=>toast.error(e?.response?.data?.message??'Error'),
  })

  if (isLoading) return <PageLoader />
  const {caja,movimientos=[]}=data??{}
  const saldo=caja?caja.saldo_inicial+caja.total_ventas+caja.total_ingresos-caja.total_egresos:0

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Caja</h1><p className="page-subtitle">{caja?'Caja abierta':'Caja cerrada'}</p></div>
        {!caja?<button onClick={()=>setModalAbrir(true)} className="btn-primary"><Unlock className="w-4 h-4"/>Abrir caja</button>:
          <div className="flex gap-2">
            <button onClick={()=>setModalMov(true)} className="btn-secondary"><Plus className="w-4 h-4"/>Movimiento</button>
            <button onClick={()=>setModalCerrar(true)} className="btn-danger"><Lock className="w-4 h-4"/>Cerrar caja</button>
          </div>}
      </div>
      {caja&&<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[{label:'Saldo actual',value:saldo,color:'text-brand-400'},{label:'Ventas',value:caja.total_ventas,color:'text-emerald-400'},{label:'Ingresos',value:caja.total_ingresos,color:'text-sky-400'},{label:'Egresos',value:caja.total_egresos,color:'text-red-400'}].map(i=>(
            <div key={i.label} className="card p-4"><p className="text-xs text-surface-200/50 uppercase tracking-wide mb-1">{i.label}</p><p className={cn('text-2xl font-bold',i.color)}>{formatCurrency(i.value)}</p></div>
          ))}
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold">Movimientos</h3></div>
          <div className="overflow-x-auto"><table className="table-base"><thead><tr><th>Hora</th><th>Tipo</th><th>Descripción</th><th>Método</th><th>Monto</th></tr></thead>
            <tbody>
              {movimientos.map(m=>(
                <tr key={m.id}>
                  <td className="text-xs">{formatDate(m.created_at,'HH:mm')}</td>
                  <td><span className={cn('badge',{
                    'badge-green':m.tipo==='ingreso','badge-red':m.tipo==='egreso',
                    'badge-blue':m.tipo==='venta','badge-yellow':m.tipo==='propina'
                  })}>{m.tipo}</span></td>
                  <td className="text-surface-200/70">{m.descripcion??'—'}</td>
                  <td className="capitalize text-surface-200/60 text-xs">{m.metodo_pago}</td>
                  <td className={cn('font-semibold',m.tipo==='egreso'?'text-red-400':'text-emerald-400')}>{m.tipo==='egreso'?'-':'+'}{formatCurrency(m.monto)}</td>
                </tr>
              ))}
              {movimientos.length===0&&<tr><td colSpan={5} className="text-center py-8 text-surface-200/30">Sin movimientos</td></tr>}
            </tbody>
          </table></div>
        </div>
      </>}
      {!caja&&<div className="flex flex-col items-center justify-center py-20 text-center"><CreditCard className="w-16 h-16 text-surface-200/15 mb-4"/><p className="text-surface-200/40">La caja está cerrada</p></div>}
      <Modal open={modalAbrir} onClose={()=>setModalAbrir(false)} title="Abrir caja" size="sm"
        footer={<div className="flex gap-3"><button onClick={()=>setModalAbrir(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={()=>op.mutate({accion:'abrir',saldo_inicial:parseFloat(saldoI)||0})} disabled={op.isPending} className="btn-primary flex-1">Abrir</button></div>}>
        <div><label className="label">Saldo inicial en efectivo</label><input type="number" min="0" className="input" value={saldoI} onChange={e=>setSaldoI(e.target.value)}/></div>
      </Modal>
      <Modal open={modalMov} onClose={()=>setModalMov(false)} title="Registrar movimiento" size="sm"
        footer={<div className="flex gap-3"><button onClick={()=>setModalMov(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={()=>op.mutate({accion:'movimiento',...mov,monto:parseFloat(mov.monto)||0})} disabled={!mov.monto||op.isPending} className="btn-primary flex-1">Registrar</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Tipo</label><select className="input" value={mov.tipo} onChange={e=>setMov(p=>({...p,tipo:e.target.value}))}><option value="ingreso" className="bg-surface-800">Ingreso</option><option value="egreso" className="bg-surface-800">Egreso</option></select></div>
          <div><label className="label">Monto</label><input type="number" min="0" className="input" value={mov.monto} onChange={e=>setMov(p=>({...p,monto:e.target.value}))}/></div>
          <div><label className="label">Método</label><select className="input" value={mov.metodo_pago} onChange={e=>setMov(p=>({...p,metodo_pago:e.target.value}))}>{['efectivo','tarjeta','transferencia','nequi','daviplata'].map(m=><option key={m} value={m} className="bg-surface-800 capitalize">{m}</option>)}</select></div>
          <div><label className="label">Descripción</label><input className="input" value={mov.descripcion} onChange={e=>setMov(p=>({...p,descripcion:e.target.value}))}/></div>
        </div>
      </Modal>
      <Modal open={modalCerrar} onClose={()=>setModalCerrar(false)} title="Cerrar caja" size="sm"
        footer={<div className="flex gap-3"><button onClick={()=>setModalCerrar(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={()=>op.mutate({accion:'cerrar'})} disabled={op.isPending} className="btn-danger flex-1">Cerrar caja</button></div>}>
        <div className="text-center py-4"><p className="text-surface-200/70 mb-4">Saldo al cierre:</p><p className="text-4xl font-bold text-surface-50">{formatCurrency(saldo)}</p></div>
      </Modal>
    </div>
  )
}
