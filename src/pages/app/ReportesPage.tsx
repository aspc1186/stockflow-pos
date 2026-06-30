import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '@/lib/axios'
import { formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function ReportesPage() {
  const [desde,setDesde]=useState(()=>{const d=new Date();d.setDate(d.getDate()-30);return d.toISOString().split('T')[0]})
  const [hasta,setHasta]=useState(()=>new Date().toISOString().split('T')[0])
  const [agrupacion,setAgrupacion]=useState('dia')

  const {data,isLoading}=useQuery({
    queryKey:['reportes',desde,hasta,agrupacion],
    queryFn:async()=>{const {data}=await api.get(`/reportes/ventas?desde=${desde}&hasta=${hasta}&agrupacion=${agrupacion}`);return (data as any).data},
  })

  const d=data as any
  const exportarExcel=()=>{
    if(!d)return; const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(d.ventas_por_periodo??[]),'Ventas')
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(d.top_productos??[]),'Productos')
    XLSX.writeFile(wb,`reporte-${desde}-${hasta}.xlsx`)
  }
  const exportarPDF=()=>{
    if(!d)return; const doc=new jsPDF()
    doc.setFontSize(16); doc.text('Reporte de Ventas',14,22)
    doc.setFontSize(10); doc.text(`Período: ${desde} al ${hasta}`,14,32)
    autoTable(doc,{startY:40,head:[['Métrica','Valor']],body:[
      ['Total ventas',formatCurrency(d.resumen?.total_ventas??0)],
      ['Pedidos',String(d.resumen?.total_pedidos??0)],
      ['Ticket promedio',formatCurrency(d.resumen?.ticket_promedio??0)],
    ]})
    doc.save(`reporte-${desde}.pdf`)
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Reportes</h1><p className="page-subtitle">Análisis de ventas</p></div>
        <div className="flex gap-2">
          <button onClick={exportarExcel} className="btn-secondary btn-sm"><Download className="w-4 h-4"/>Excel</button>
          <button onClick={exportarPDF} className="btn-secondary btn-sm"><Download className="w-4 h-4"/>PDF</button>
        </div>
      </div>
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <div><label className="label">Desde</label><input type="date" className="input" value={desde} onChange={e=>setDesde(e.target.value)}/></div>
        <div><label className="label">Hasta</label><input type="date" className="input" value={hasta} onChange={e=>setHasta(e.target.value)}/></div>
        <div><label className="label">Agrupación</label><select className="input" value={agrupacion} onChange={e=>setAgrupacion(e.target.value)}><option value="dia" className="bg-surface-800">Por día</option><option value="semana" className="bg-surface-800">Por semana</option><option value="mes" className="bg-surface-800">Por mes</option></select></div>
      </div>
      {isLoading&&<PageLoader />}
      {d&&<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[{label:'Ventas totales',value:formatCurrency(d.resumen?.total_ventas??0)},{label:'Pedidos',value:d.resumen?.total_pedidos??0},{label:'Ticket promedio',value:formatCurrency(d.resumen?.ticket_promedio??0)},{label:'Impuestos',value:formatCurrency(d.resumen?.total_impuestos??0)}].map(i=>(
            <div key={i.label} className="card p-4"><p className="text-xs text-surface-200/50 uppercase tracking-wide mb-1">{i.label}</p><p className="text-xl font-bold text-surface-50">{i.value}</p></div>
          ))}
        </div>
        {(d.ventas_por_periodo?.length??0)>0&&<div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-200/70 mb-4 uppercase tracking-wide">Ventas por período</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.ventas_por_periodo}>
              <XAxis dataKey="periodo" tick={{fontSize:10,fill:'#9ca3af'}}/>
              <YAxis tick={{fontSize:10,fill:'#9ca3af'}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
              <Tooltip contentStyle={{background:'#1a1f2e',border:'1px solid #2a3048',borderRadius:'8px'}} formatter={(v:number)=>[formatCurrency(v),'Ventas']}/>
              <Bar dataKey="total" fill="#2454f0" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>}
        {(d.top_productos?.length??0)>0&&<div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5"><h3 className="text-sm font-semibold">Top productos</h3></div>
          <table className="table-base"><thead><tr><th>#</th><th>Producto</th><th>Unidades</th><th>Total</th></tr></thead>
          <tbody>{d.top_productos?.map((p:any,i:number)=><tr key={i}><td className="text-surface-200/30 font-mono text-xs">{i+1}</td><td className="font-medium">{p.nombre}</td><td className="text-surface-200/70">{p.unidades}</td><td className="font-semibold text-brand-400">{formatCurrency(p.total)}</td></tr>)}</tbody>
          </table>
        </div>}
      </>}
    </div>
  )
}
