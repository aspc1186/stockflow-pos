import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from './_auth'
import { query, queryOne } from './_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  try {
    const [vh,vm,pa,em,ic,ca,tp,vph]=await Promise.all([
      queryOne<any>(`SELECT COALESCE(SUM(total),0) as total FROM pedidos WHERE empresa_id=$1 AND estado='cobrado' AND DATE(cierre_at)=CURRENT_DATE`,[eid]),
      queryOne<any>(`SELECT COALESCE(SUM(total),0) as total FROM pedidos WHERE empresa_id=$1 AND estado='cobrado' AND DATE_TRUNC('month',cierre_at)=DATE_TRUNC('month',CURRENT_DATE)`,[eid]),
      queryOne<any>(`SELECT COUNT(*) as total FROM pedidos WHERE empresa_id=$1 AND estado IN ('abierto','en_preparacion','listo')`,[eid]),
      query<any>(`SELECT estado,COUNT(*) as total FROM mesas WHERE empresa_id=$1 AND activa=true GROUP BY estado`,[eid]),
      queryOne<any>(`SELECT COUNT(*) as total FROM inventario WHERE empresa_id=$1 AND stock_actual<=stock_minimo AND stock_minimo>0`,[eid]),
      queryOne<any>(`SELECT saldo_inicial,total_ventas,total_ingresos,total_egresos FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`,[eid]),
      query<any>(`SELECT p.nombre,SUM(pi.cantidad) as total FROM pedido_items pi JOIN productos p ON p.id=pi.producto_id JOIN pedidos ped ON ped.id=pi.pedido_id WHERE pi.empresa_id=$1 AND DATE(ped.created_at)=CURRENT_DATE GROUP BY p.id,p.nombre ORDER BY total DESC LIMIT 8`,[eid]),
      query<any>(`SELECT TO_CHAR(cierre_at,'HH24:00') as hora,COALESCE(SUM(total),0) as total FROM pedidos WHERE empresa_id=$1 AND estado='cobrado' AND DATE(cierre_at)=CURRENT_DATE GROUP BY hora ORDER BY hora`,[eid]),
    ])
    const mp=em.reduce((a:any,r:any)=>{a[r.estado]=parseInt(r.total);return a},{})
    const caja=ca?parseFloat(ca.saldo_inicial)+parseFloat(ca.total_ventas)+parseFloat(ca.total_ingresos)-parseFloat(ca.total_egresos):0
    return res.status(200).json({ success:true, data:{
      ventas_hoy:parseFloat(vh?.total??'0'), ventas_mes:parseFloat(vm?.total??'0'),
      pedidos_activos:parseInt(pa?.total??'0'),
      mesas_ocupadas:(mp['ocupada']??0)+(mp['preparando']??0)+(mp['lista_cobrar']??0)+(mp['pendiente_pago']??0),
      mesas_libres:mp['libre']??0, inventario_critico:parseInt(ic?.total??'0'),
      caja_actual:caja, usuarios_conectados:0,
      productos_mas_vendidos:tp.map((r:any)=>({nombre:r.nombre,total:parseFloat(r.total)})),
      ventas_por_hora:vph.map((r:any)=>({hora:r.hora,total:parseFloat(r.total)}))
    }})
  } catch(e){console.error(e);return res.status(500).json({ success:false, message:'Error interno' })}
}
