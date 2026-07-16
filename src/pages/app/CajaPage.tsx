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
  const qc = useQueryClient()
  const [modalAbrir, setModalAbrir] = useState(false); const [modalMov, setModalMov] = useState(false); const [modalCerrar, setModalCerrar] = useState(false)
  const [saldoI, setSaldoI] = useState('0')
  const [mov, setMov] = useState({tipo:'ingreso',monto:'',descripcion:'',metodo_pago:'efectivo'})
  const { data, isLoading } = useQuery({
    queryKey: ['caja'],
    queryFn: async () => { const { data } = await api.get<any>('/caja'); return (data.data||data) as {caja:Caja;movimientos:CajaMovimiento[];ultimo_cierre:Caja|null} },
    refetchInterval: 15_000,
  })
  const op = useMutation({
    mutationFn: (body: Record<string,unknown>) => api.post('/caja', body),
    onSuccess: () => { qc.invalidateQueries({queryKey:['caja']}); setModalAbrir(false); setModalMov(false); setModalCerrar(false); toast.success('Operación exitosa') },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'Error'),
  })
  if (isLoading) return <PageLoader />
  const { caja, movimientos = [], ultimo_cierre: ultimoCierre, movimientos_ultimo_cierre: movimientosUltimoCierre = [] } = data ?? {}
  const saldo = caja ? Number(caja.saldo_inicial || 0) + Number(caja.total_ventas || 0) + Number(caja.total_ingresos || 0) - Number(caja.total_egresos || 0) - Number(caja.total_compras_inventario || 0) - Number(caja.total_compras_no_inventario || 0) : 0

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Caja</h1><p className="page-subtitle">{caja ? `Caja abierta - Jornada: ${caja.fecha_operativa ? formatDate(caja.fecha_operativa, 'dd/MM/yyyy') : ''}` : 'Caja cerrada'}</p></div>
        {!caja ? <button onClick={() => setModalAbrir(true)} className="btn-primary"><Unlock className="w-4 h-4"/>Abrir caja</button> :
          <div className="flex gap-2">
            <button onClick={() => setModalMov(true)} className="btn-secondary"><Plus className="w-4 h-4"/>Movimiento</button>
            <button onClick={() => setModalCerrar(true)} className="btn-danger"><Lock className="w-4 h-4"/>Cerrar caja</button>
          </div>}
      </div>
      {caja && <>
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          {[{label:'Saldo inicial',value:caja.saldo_inicial,color:'text-surface-50'},{label:'Ventas',value:caja.total_ventas,color:'text-emerald-400'},{label:'Ingresos adicionales',value:caja.total_ingresos,color:'text-sky-400'},{label:'Gastos / egresos',value:caja.total_egresos,color:'text-red-400'},{label:'Compras inventario',value:caja.total_compras_inventario || 0,color:'text-amber-400'},{label:'Compras sin inventario',value:caja.total_compras_no_inventario || 0,color:'text-orange-400'},{label:'Saldo actual',value:saldo,color:'text-brand-400'}].map(i => (
            <div key={i.label} className="card p-4"><p className="text-xs text-surface-200/50 uppercase tracking-wide mb-1">{i.label}</p><p className={cn('text-2xl font-bold',i.color)}>{formatCurrency(i.value)}</p></div>
          ))}
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold">Movimientos</h3></div>
          <div className="overflow-x-auto"><table className="table-base">
            <thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Descripción</th><th>Método</th><th>Monto</th></tr></thead>
            <tbody>
              {movimientos.map(m => (
                <tr key={m.id}>
                  <td className="text-xs whitespace-nowrap">{formatDate(m.created_at,'dd/MM/yyyy')}</td>
                  <td className="text-xs">{formatDate(m.created_at,'HH:mm')}</td>
                  <td><span className={cn('badge',{'badge-green':m.tipo==='ingreso'||m.tipo==='venta','badge-red':m.tipo==='egreso'||m.tipo==='compra_no_inventario','badge-yellow':m.tipo==='propina'||m.tipo==='compra_inventario'})}>{m.tipo==='compra_inventario'?'compra inventario':m.tipo==='compra_no_inventario'?'compra sin inventario':m.tipo}</span></td>
                  <td className="text-surface-200/70">{m.descripcion ?? '—'}</td>
                  <td className="capitalize text-surface-200/60 text-xs">{m.metodo_pago}</td>
                  <td className={cn('font-semibold',m.tipo==='egreso'||m.tipo==='compra_inventario'||m.tipo==='compra_no_inventario'?'text-red-400':'text-emerald-400')}>{m.tipo==='egreso'||m.tipo==='compra_inventario'||m.tipo==='compra_no_inventario'?'-':'+'}{formatCurrency(m.monto)}</td>
                </tr>
              ))}
              {movimientos.length===0&&<tr><td colSpan={6} className="text-center py-8 text-surface-200/30">Sin movimientos</td></tr>}
            </tbody>
          </table></div>
        </div>
      </>}
      {!caja && <div className="flex flex-col items-center justify-center py-20 text-center"><CreditCard className="w-16 h-16 text-surface-200/15 mb-4"/><p className="text-surface-200/40">La caja está cerrada</p></div>}
      {!caja && ultimoCierre && <div className="card p-5">
        <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-semibold">Ultimo cierre</h3><span className="text-xs text-surface-200/40">{ultimoCierre.cierre_at ? formatDate(ultimoCierre.cierre_at, 'dd/MM/yyyy HH:mm') : ''}</span></div>
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          {[{label:'Saldo inicial',value:ultimoCierre.saldo_inicial},{label:'Ventas',value:ultimoCierre.total_ventas},{label:'Ingresos adicionales',value:ultimoCierre.total_ingresos},{label:'Gastos / egresos',value:ultimoCierre.total_egresos},{label:'Compras inventario',value:ultimoCierre.total_compras_inventario || 0},{label:'Compras sin inventario',value:ultimoCierre.total_compras_no_inventario || 0},{label:'Saldo final',value:ultimoCierre.saldo_final,color:'text-brand-400'}].map(i => <div key={i.label}><p className="text-xs text-surface-200/45">{i.label}</p><p className={cn('mt-1 font-bold',i.color || 'text-surface-50')}>{formatCurrency(Number(i.value || 0))}</p></div>)}
        </div>
        <div className="mt-5 border-t border-white/5 pt-4">
          <h4 className="text-sm font-semibold mb-3">Movimientos del ultimo cierre</h4>
          <div className="overflow-x-auto"><table className="table-base"><thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Usuario</th><th>Metodo</th><th>Monto</th></tr></thead><tbody>
            {movimientosUltimoCierre.map((m:any) => <tr key={m.id}><td className="text-xs whitespace-nowrap">{formatDate(m.created_at,'dd/MM/yyyy')}</td><td className="text-xs">{formatDate(m.created_at,'HH:mm')}</td><td><span className={cn('badge',{'badge-green':m.tipo==='ingreso'||m.tipo==='venta','badge-red':m.tipo==='egreso'||m.tipo==='compra_no_inventario','badge-yellow':m.tipo==='compra_inventario'})}>{m.tipo==='compra_inventario'?'compra inventario':m.tipo==='compra_no_inventario'?'compra sin inventario':m.tipo}</span></td><td className="text-sm text-surface-200/70">{m.usuario_nombre || 'Sistema'}</td><td className="capitalize text-xs text-surface-200/60">{m.metodo_pago}</td><td className={cn('font-semibold',m.tipo==='egreso'||m.tipo==='compra_inventario'||m.tipo==='compra_no_inventario'?'text-red-400':'text-emerald-400')}>{m.tipo==='egreso'||m.tipo==='compra_inventario'||m.tipo==='compra_no_inventario'?'-':'+'}{formatCurrency(m.monto)}</td></tr>)}
            {movimientosUltimoCierre.length===0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-surface-200/30">No hay movimientos registrados</td></tr>}
          </tbody></table></div>
        </div>
      </div>}
      <Modal open={modalAbrir} onClose={() => setModalAbrir(false)} title="Abrir caja" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setModalAbrir(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => op.mutate({accion:'abrir',saldo_inicial:parseFloat(saldoI)||0})} disabled={op.isPending} className="btn-primary flex-1">Abrir</button></div>}>
        <div><label className="label">Saldo inicial en efectivo</label><input type="number" min="0" className="input" value={saldoI} onChange={e => setSaldoI(e.target.value)}/></div>
      </Modal>
      <Modal open={modalMov} onClose={() => setModalMov(false)} title="Registrar movimiento" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setModalMov(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => op.mutate({accion:'movimiento',...mov,monto:parseFloat(mov.monto)||0})} disabled={!mov.monto || !mov.descripcion.trim() || op.isPending} className="btn-primary flex-1">Registrar</button></div>}>
        <div className="space-y-4">
          <div><label className="label">Tipo</label><select className="input" value={mov.tipo} onChange={e=>setMov(p=>({...p,tipo:e.target.value}))}><option value="ingreso" className="bg-surface-800">Ingreso adicional</option><option value="egreso" className="bg-surface-800">Gasto / egreso</option><option value="compra_no_inventario" className="bg-surface-800">Compra sin inventario</option></select></div>
          <div><label className="label">Monto</label><input type="number" min="0" className="input" value={mov.monto} onChange={e=>setMov(p=>({...p,monto:e.target.value}))}/></div>
          <div><label className="label">Método</label><select className="input" value={mov.metodo_pago} onChange={e=>setMov(p=>({...p,metodo_pago:e.target.value}))}>{['efectivo','tarjeta_credito','tarjeta_debito','transferencia','nequi','daviplata'].map(m=><option key={m} value={m} className="bg-surface-800 capitalize">{m.replace('_',' ')}</option>)}</select></div>
          <div><label className="label">Descripción</label><input className="input" value={mov.descripcion} onChange={e=>setMov(p=>({...p,descripcion:e.target.value}))} placeholder="Ej.: compra de hielo, pago de transporte"/></div>
        </div>
      </Modal>
      <Modal open={modalCerrar} onClose={() => setModalCerrar(false)} title="Cerrar caja" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setModalCerrar(false)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => op.mutate({accion:'cerrar'})} disabled={op.isPending} className="btn-danger flex-1">Cerrar caja</button></div>}>
        <div className="text-center py-4"><p className="text-surface-200/70 mb-4">Saldo al cierre:</p><p className="text-4xl font-bold text-surface-50">{formatCurrency(saldo)}</p></div>
      </Modal>
    </div>
  )
}
