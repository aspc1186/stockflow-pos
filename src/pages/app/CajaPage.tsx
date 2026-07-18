import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Plus, Lock, Unlock, Pencil, Trash2, Printer } from 'lucide-react'
import api from '@/lib/axios'
import type { Caja, CajaMovimiento } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { imprimirMovimientoCaja } from '@/lib/print'

export default function CajaPage() {
  const qc = useQueryClient()
  const { supportMode, user } = useAuth()
  const [modalAbrir, setModalAbrir] = useState(false); const [modalMov, setModalMov] = useState(false); const [modalCerrar, setModalCerrar] = useState(false)
  const [movimientoEditar, setMovimientoEditar] = useState<any | null>(null)
  const [movimientoEliminar, setMovimientoEliminar] = useState<any | null>(null)
  const [saldoI, setSaldoI] = useState('0')
  const [mov, setMov] = useState({tipo:'ingreso',monto:'',descripcion:'',metodo_pago:'efectivo'})
  const [correccion, setCorreccion] = useState({tipo:'ingreso',monto:'',descripcion:'',metodo_pago:'efectivo',motivo:''})
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
  const corregir = useMutation({
    mutationFn: ({ method, body }: { method:'PATCH'|'DELETE'; body:Record<string,unknown> }) => method === 'PATCH' ? api.patch('/caja', body) : api.delete('/caja', { data: body }),
    onSuccess: () => {
      qc.invalidateQueries({queryKey:['caja']}); qc.invalidateQueries({queryKey:['dashboard-stats']})
      setMovimientoEditar(null); setMovimientoEliminar(null)
      toast.success('Movimiento corregido y caja recalculada')
    },
    onError: (e:any) => toast.error(e?.response?.data?.msg ?? 'No se pudo corregir el movimiento'),
  })
  if (isLoading) return <PageLoader />
  const { caja, movimientos = [], ultimo_cierre: ultimoCierre, movimientos_ultimo_cierre: movimientosUltimoCierre = [], jornadas_mes: jornadasMes = [], movimientos_cierres_mes: movimientosCierresMes = [] } = data ?? {}
  const saldo = caja ? Number(caja.saldo_inicial || 0) + Number(caja.total_ventas || 0) + Number(caja.total_ingresos || 0) - Number(caja.total_egresos || 0) - Number(caja.total_compras_inventario || 0) - Number(caja.total_compras_no_inventario || 0) : 0
  const saldoJornada = (jornada:any) => jornada.estado === 'cerrada' ? Number(jornada.saldo_final || 0) : Number(jornada.saldo_inicial || 0) + Number(jornada.total_ventas || 0) + Number(jornada.total_ingresos || 0) - Number(jornada.total_egresos || 0) - Number(jornada.total_compras_inventario || 0) - Number(jornada.total_compras_no_inventario || 0)
  const esManual = (m:any) => ['ingreso','egreso','compra_no_inventario'].includes(m.tipo)
  const abrirEdicion = (m:any) => { setCorreccion({tipo:m.tipo,monto:String(m.monto),descripcion:m.descripcion || '',metodo_pago:m.metodo_pago || 'efectivo',motivo:''}); setMovimientoEditar(m) }

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
            <div key={i.label} className="card min-w-0 p-3 sm:p-4"><p className="text-xs leading-tight text-surface-200/50 uppercase tracking-wide mb-1 break-words">{i.label}</p><p className={cn('text-lg sm:text-2xl leading-tight font-bold break-words tabular-nums',i.color)}>{formatCurrency(i.value)}</p></div>
          ))}
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold">Movimientos</h3></div>
          <div className="overflow-x-auto"><table className="table-base">
            <thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Descripción</th><th>Método</th><th>Monto</th><th className="text-right">Comprobante</th>{supportMode && <th className="text-right">Acciones</th>}</tr></thead>
            <tbody>
              {movimientos.map(m => (
                <tr key={m.id}>
                  <td className="text-xs whitespace-nowrap">{formatDate(m.created_at,'dd/MM/yyyy')}</td>
                  <td className="text-xs">{formatDate(m.created_at,'HH:mm')}</td>
                  <td><span className={cn('badge',{'badge-green':m.tipo==='ingreso'||m.tipo==='venta','badge-red':m.tipo==='egreso'||m.tipo==='compra_no_inventario','badge-yellow':m.tipo==='propina'||m.tipo==='compra_inventario'})}>{m.tipo==='compra_inventario'?'compra inventario':m.tipo==='compra_no_inventario'?'compra sin inventario':m.tipo}</span></td>
                  <td className="text-surface-200/70">{m.descripcion ?? '—'}</td>
                  <td className="capitalize text-surface-200/60 text-xs">{m.metodo_pago}</td>
                  <td className={cn('font-semibold',m.tipo==='egreso'||m.tipo==='compra_inventario'||m.tipo==='compra_no_inventario'?'text-red-400':'text-emerald-400')}>{m.tipo==='egreso'||m.tipo==='compra_inventario'||m.tipo==='compra_no_inventario'?'-':'+'}{formatCurrency(m.monto)}</td>
                  <td className="text-right"><button type="button" className="btn-ghost btn-sm p-2" title="Imprimir comprobante" onClick={()=>{ if (!imprimirMovimientoCaja(m, user?.empresa)) toast.error('El navegador bloqueo la ventana de impresion') }}><Printer className="h-4 w-4"/></button></td>
                  {supportMode && <td className="text-right"><div className="flex justify-end gap-1">{esManual(m) ? <><button type="button" onClick={()=>abrirEdicion(m)} className="btn-ghost btn-sm p-2" title="Editar movimiento"><Pencil className="h-4 w-4"/></button><button type="button" onClick={()=>{ setCorreccion(p=>({...p,motivo:''})); setMovimientoEliminar(m) }} className="btn-ghost btn-sm p-2 text-red-300 hover:text-red-200" title="Eliminar movimiento"><Trash2 className="h-4 w-4"/></button></> : <span className="text-xs text-surface-200/35">Automatico</span>}</div></td>}
                </tr>
              ))}
              {movimientos.length===0&&<tr><td colSpan={supportMode ? 8 : 7} className="text-center py-8 text-surface-200/30">Sin movimientos</td></tr>}
            </tbody>
          </table></div>
        </div>
      </>}
      {!caja && <div className="flex flex-col items-center justify-center py-20 text-center"><CreditCard className="w-16 h-16 text-surface-200/15 mb-4"/><p className="text-surface-200/40">La caja está cerrada</p></div>}
      {!caja && ultimoCierre && <div className="card p-5">
        <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-semibold">Ultimo cierre</h3><span className="text-xs text-surface-200/40">{ultimoCierre.cierre_at ? formatDate(ultimoCierre.cierre_at, 'dd/MM/yyyy HH:mm') : ''}</span></div>
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 sm:gap-4">
          {[{label:'Saldo inicial',value:ultimoCierre.saldo_inicial},{label:'Ventas',value:ultimoCierre.total_ventas},{label:'Ingresos adicionales',value:ultimoCierre.total_ingresos},{label:'Gastos / egresos',value:ultimoCierre.total_egresos},{label:'Compras inventario',value:ultimoCierre.total_compras_inventario || 0},{label:'Compras sin inventario',value:ultimoCierre.total_compras_no_inventario || 0},{label:'Saldo final',value:ultimoCierre.saldo_final,color:'text-brand-400'}].map(i => <div key={i.label} className="min-w-0"><p className="text-xs leading-tight text-surface-200/45 break-words">{i.label}</p><p className={cn('mt-1 text-base sm:text-lg leading-tight font-bold break-words tabular-nums',i.color || 'text-surface-50')}>{formatCurrency(Number(i.value || 0))}</p></div>)}
        </div>
        <div className="mt-5 border-t border-white/5 pt-4">
          <h4 className="text-sm font-semibold mb-3">Movimientos del ultimo cierre</h4>
          <div className="overflow-x-auto"><table className="table-base"><thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Usuario</th><th>Metodo</th><th>Monto</th></tr></thead><tbody>
            {movimientosUltimoCierre.map((m:any) => <tr key={m.id}><td className="text-xs whitespace-nowrap">{formatDate(m.created_at,'dd/MM/yyyy')}</td><td className="text-xs">{formatDate(m.created_at,'HH:mm')}</td><td><span className={cn('badge',{'badge-green':m.tipo==='ingreso'||m.tipo==='venta','badge-red':m.tipo==='egreso'||m.tipo==='compra_no_inventario','badge-yellow':m.tipo==='compra_inventario'})}>{m.tipo==='compra_inventario'?'compra inventario':m.tipo==='compra_no_inventario'?'compra sin inventario':m.tipo}</span></td><td className="text-sm text-surface-200/70">{m.usuario_nombre || 'Sistema'}</td><td className="capitalize text-xs text-surface-200/60">{m.metodo_pago}</td><td className={cn('font-semibold',m.tipo==='egreso'||m.tipo==='compra_inventario'||m.tipo==='compra_no_inventario'?'text-red-400':'text-emerald-400')}>{m.tipo==='egreso'||m.tipo==='compra_inventario'||m.tipo==='compra_no_inventario'?'-':'+'}{formatCurrency(m.monto)}</td></tr>)}
            {movimientosUltimoCierre.length===0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-surface-200/30">No hay movimientos registrados</td></tr>}
          </tbody></table></div>
        </div>
      </div>}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3 sm:px-5 sm:py-4">
          <div><h3 className="text-sm font-semibold">Aperturas y cierres del mes</h3><p className="mt-1 text-xs text-surface-200/45">Saldo inicial, ventas y saldo final por cada jornada.</p></div>
          <span className="badge badge-blue">{jornadasMes.length} jornadas</span>
        </div>
        {jornadasMes.length === 0 ? <p className="p-8 text-center text-sm text-surface-200/35">No hay aperturas de caja en este mes</p> : <>
          <div className="space-y-2 p-3 md:hidden">
            {jornadasMes.map((jornada:any) => <div key={jornada.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-surface-50">Jornada {jornada.fecha_operativa ? formatDate(jornada.fecha_operativa,'dd/MM/yyyy') : formatDate(jornada.apertura_at,'dd/MM/yyyy')}</p><p className="mt-1 text-xs text-surface-200/45">Apertura {formatDate(jornada.apertura_at,'dd/MM HH:mm')} {jornada.cierre_at ? `· Cierre ${formatDate(jornada.cierre_at,'HH:mm')}` : ''}</p></div><span className={jornada.estado==='cerrada'?'badge-gray':'badge-green'}>{jornada.estado==='cerrada'?'Cerrada':'Abierta'}</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/5 pt-3"><div className="min-w-0"><p className="text-[10px] uppercase text-surface-200/45">Inicial</p><p className="mt-1 break-words text-sm font-bold tabular-nums text-surface-50">{formatCurrency(jornada.saldo_inicial || 0)}</p></div><div className="min-w-0"><p className="text-[10px] uppercase text-surface-200/45">Ventas</p><p className="mt-1 break-words text-sm font-bold tabular-nums text-emerald-400">{formatCurrency(jornada.total_ventas || 0)}</p></div><div className="min-w-0"><p className="text-[10px] uppercase text-surface-200/45">Final</p><p className="mt-1 break-words text-sm font-bold tabular-nums text-brand-400">{formatCurrency(saldoJornada(jornada))}</p></div></div>
              <p className="mt-3 truncate text-xs text-surface-200/45">Responsable: {jornada.cajero_nombre || 'Sistema'}</p>
            </div>)}
          </div>
          <div className="hidden overflow-x-auto md:block"><table className="table-base"><thead><tr><th>Jornada</th><th>Estado</th><th>Apertura</th><th>Cierre</th><th>Responsable</th><th>Saldo inicial</th><th>Ventas</th><th>Saldo final</th></tr></thead><tbody>
            {jornadasMes.map((jornada:any) => <tr key={jornada.id}><td className="text-xs whitespace-nowrap">{jornada.fecha_operativa ? formatDate(jornada.fecha_operativa,'dd/MM/yyyy') : formatDate(jornada.apertura_at,'dd/MM/yyyy')}</td><td><span className={jornada.estado==='cerrada'?'badge-gray':'badge-green'}>{jornada.estado==='cerrada'?'Cerrada':'Abierta'}</span></td><td className="text-xs whitespace-nowrap">{formatDate(jornada.apertura_at,'dd/MM/yyyy HH:mm')}</td><td className="text-xs whitespace-nowrap">{jornada.cierre_at ? formatDate(jornada.cierre_at,'dd/MM/yyyy HH:mm') : 'Pendiente'}</td><td className="text-sm text-surface-200/70">{jornada.cajero_nombre || 'Sistema'}</td><td className="font-semibold tabular-nums">{formatCurrency(jornada.saldo_inicial || 0)}</td><td className="font-semibold tabular-nums text-emerald-400">{formatCurrency(jornada.total_ventas || 0)}</td><td className="font-semibold tabular-nums text-brand-400">{formatCurrency(saldoJornada(jornada))}</td></tr>)}
          </tbody></table></div>
        </>}
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3 sm:px-5 sm:py-4">
          <div><h3 className="text-sm font-semibold">Trazabilidad de cierres del mes</h3><p className="mt-1 text-xs text-surface-200/45">Movimientos registrados en cada jornada cerrada.</p></div>
          <span className="badge badge-blue">Mes actual</span>
        </div>
        {movimientosCierresMes.length === 0 ? <p className="p-8 text-center text-sm text-surface-200/35">No hay movimientos de cierres en este mes</p> : <>
          <div className="space-y-2 p-3 md:hidden">
            {movimientosCierresMes.map((m:any) => {
              const esSalida = ['egreso','compra_inventario','compra_no_inventario'].includes(m.tipo)
              const tipo = m.tipo==='compra_inventario'?'Compra inventario':m.tipo==='compra_no_inventario'?'Compra sin inventario':m.tipo
              return <div key={m.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-surface-50 truncate">{m.descripcion || tipo}</p><p className="mt-1 text-xs text-surface-200/45">Jornada {m.fecha_operativa ? formatDate(m.fecha_operativa,'dd/MM/yyyy') : 'sin fecha'} · {formatDate(m.created_at,'HH:mm')}</p></div><p className={cn('flex-shrink-0 text-sm font-bold tabular-nums',esSalida?'text-red-400':'text-emerald-400')}>{esSalida?'-':'+'}{formatCurrency(m.monto)}</p></div>
                <div className="mt-2 flex items-center justify-between gap-2"><span className={cn('badge',{'badge-green':m.tipo==='ingreso'||m.tipo==='venta','badge-red':esSalida,'badge-yellow':m.tipo==='propina'})}>{tipo}</span><span className="truncate text-xs text-surface-200/50">{m.usuario_nombre || 'Sistema'} · {String(m.metodo_pago || '').replace('_',' ')}</span></div>
              </div>
            })}
          </div>
          <div className="hidden overflow-x-auto md:block"><table className="table-base"><thead><tr><th>Jornada</th><th>Fecha</th><th>Hora</th><th>Tipo</th><th>DescripciÃ³n</th><th>Usuario</th><th>MÃ©todo</th><th>Monto</th></tr></thead><tbody>
            {movimientosCierresMes.map((m:any) => { const esSalida = ['egreso','compra_inventario','compra_no_inventario'].includes(m.tipo); const tipo = m.tipo==='compra_inventario'?'compra inventario':m.tipo==='compra_no_inventario'?'compra sin inventario':m.tipo; return <tr key={m.id}><td className="text-xs whitespace-nowrap">{m.fecha_operativa ? formatDate(m.fecha_operativa,'dd/MM/yyyy') : '—'}</td><td className="text-xs whitespace-nowrap">{formatDate(m.created_at,'dd/MM/yyyy')}</td><td className="text-xs">{formatDate(m.created_at,'HH:mm')}</td><td><span className={cn('badge',{'badge-green':m.tipo==='ingreso'||m.tipo==='venta','badge-red':esSalida,'badge-yellow':m.tipo==='propina'})}>{tipo}</span></td><td className="max-w-[16rem] truncate text-surface-200/70">{m.descripcion || '—'}</td><td className="text-sm text-surface-200/70">{m.usuario_nombre || 'Sistema'}</td><td className="capitalize text-xs text-surface-200/60">{String(m.metodo_pago || '').replace('_',' ')}</td><td className={cn('font-semibold',esSalida?'text-red-400':'text-emerald-400')}>{esSalida?'-':'+'}{formatCurrency(m.monto)}</td></tr> })}
          </tbody></table></div>
        </>}
      </div>
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
      <Modal open={!!movimientoEditar} onClose={() => setMovimientoEditar(null)} title="Corregir movimiento de caja" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setMovimientoEditar(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => movimientoEditar && corregir.mutate({method:'PATCH',body:{movimiento_id:movimientoEditar.id,...correccion,monto:Number(correccion.monto)}})} disabled={!correccion.monto || !correccion.descripcion.trim() || !correccion.motivo.trim() || corregir.isPending} className="btn-primary flex-1">Guardar correccion</button></div>}>
        <div className="space-y-4">
          <p className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100/85">Esta correccion quedara registrada y recalculara automaticamente los totales y el saldo final de la caja.</p>
          <div><label className="label">Tipo</label><select className="input" value={correccion.tipo} onChange={e=>setCorreccion(p=>({...p,tipo:e.target.value}))}><option value="ingreso">Ingreso adicional</option><option value="egreso">Gasto / egreso</option><option value="compra_no_inventario">Compra sin inventario</option></select></div>
          <div><label className="label">Monto</label><input type="number" min="0" className="input" value={correccion.monto} onChange={e=>setCorreccion(p=>({...p,monto:e.target.value}))}/></div>
          <div><label className="label">Metodo</label><select className="input" value={correccion.metodo_pago} onChange={e=>setCorreccion(p=>({...p,metodo_pago:e.target.value}))}>{['efectivo','tarjeta_credito','tarjeta_debito','transferencia','nequi','daviplata'].map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}</select></div>
          <div><label className="label">Descripcion</label><input className="input" value={correccion.descripcion} onChange={e=>setCorreccion(p=>({...p,descripcion:e.target.value}))}/></div>
          <div><label className="label">Motivo de la correccion</label><textarea className="input min-h-20" value={correccion.motivo} onChange={e=>setCorreccion(p=>({...p,motivo:e.target.value}))} placeholder="Ej.: monto registrado por error"/></div>
        </div>
      </Modal>
      <Modal open={!!movimientoEliminar} onClose={() => setMovimientoEliminar(null)} title="Eliminar movimiento" size="sm"
        footer={<div className="flex gap-3"><button onClick={() => setMovimientoEliminar(null)} className="btn-secondary flex-1">Cancelar</button><button onClick={() => movimientoEliminar && corregir.mutate({method:'DELETE',body:{movimiento_id:movimientoEliminar.id,motivo:correccion.motivo}})} disabled={!correccion.motivo.trim() || corregir.isPending} className="btn-danger flex-1">Eliminar</button></div>}>
        <div className="space-y-4"><p className="text-sm text-surface-200/70">Se eliminara el movimiento manual seleccionado. La caja se recalculara y quedara registrada la eliminacion.</p><div><label className="label">Motivo de la correccion</label><textarea className="input min-h-20" value={correccion.motivo} onChange={e=>setCorreccion(p=>({...p,motivo:e.target.value}))} placeholder="Ej.: movimiento duplicado"/></div></div>
      </Modal>
    </div>
  )
}
