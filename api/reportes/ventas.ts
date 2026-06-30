import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query } from '../_db'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  if (!['admin','supervisor'].includes(auth.rol)) return res.status(403).json({success:false,message:'Sin permisos'})
  const eid = auth.empresa_id
  const { desde, hasta, agrupacion='dia' } = req.query as Record<string,string>
  const fd = desde || new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0]
  const fh = hasta || new Date().toISOString().split('T')[0]
  const fmtMap:Record<string,string>={dia:'YYYY-MM-DD',semana:'IYYY-IW',mes:'YYYY-MM'}
  const fmt=fmtMap[agrupacion]||'YYYY-MM-DD'
  try {
    const [vpp,tp,vm,res_] = await Promise.all([
      query(`SELECT TO_CHAR(DATE_TRUNC($1,cierre_at),'${fmt}') as periodo,COUNT(*) as pedidos,SUM(total) as total,SUM(subtotal) as subtotal,SUM(impuestos) as impuestos,SUM(descuento) as descuento FROM pedidos WHERE empresa_id=$2 AND estado='cobrado' AND cierre_at::date BETWEEN $3 AND $4 GROUP BY 1 ORDER BY 1`,[agrupacion,eid,fd,fh]),
      query(`SELECT p.nombre,SUM(pi.cantidad) as unidades,SUM(pi.subtotal) as total FROM pedido_items pi JOIN productos p ON p.id=pi.producto_id JOIN pedidos ped ON ped.id=pi.pedido_id WHERE pi.empresa_id=$1 AND ped.estado='cobrado' AND ped.cierre_at::date BETWEEN $2 AND $3 GROUP BY p.id,p.nombre ORDER BY total DESC LIMIT 20`,[eid,fd,fh]),
      query(`SELECT u.nombre,COUNT(ped.id) as pedidos,SUM(ped.total) as total FROM pedidos ped JOIN usuarios u ON u.id=ped.usuario_id WHERE ped.empresa_id=$1 AND ped.estado='cobrado' AND ped.cierre_at::date BETWEEN $2 AND $3 GROUP BY u.id,u.nombre ORDER BY total DESC`,[eid,fd,fh]),
      query(`SELECT COUNT(*) as total_pedidos,COALESCE(SUM(total),0) as total_ventas,COALESCE(AVG(total),0) as ticket_promedio,COALESCE(SUM(impuestos),0) as total_impuestos FROM pedidos WHERE empresa_id=$1 AND estado='cobrado' AND cierre_at::date BETWEEN $2 AND $3`,[eid,fd,fh]),
    ])
    return res.status(200).json({success:true,data:{periodo:{desde:fd,hasta:fh},resumen:res_[0],ventas_por_periodo:vpp,top_productos:tp,ventas_por_mesero:vm}})
  } catch(e){console.error(e);return res.status(500).json({success:false,message:'Error interno'})}
}
