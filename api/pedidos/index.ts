import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query, queryOne } from '../_db'
import { v4 as uuid } from 'uuid'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  if (req.method === 'GET') {
    const { estado, mesa_id } = req.query as Record<string,string>
    let where = `p.empresa_id=$1`; const params: unknown[] = [eid]; let idx=2
    if (estado) { const estados=estado.split(','); where+=` AND p.estado=ANY($${idx++})`; params.push(estados) }
    if (mesa_id) { where+=` AND p.mesa_id=$${idx++}`; params.push(mesa_id) }
    const pedidos = await query(`SELECT p.*,m.numero as mesa_numero,u.nombre as usuario_nombre,c.nombre as cliente_nombre FROM pedidos p LEFT JOIN mesas m ON m.id=p.mesa_id LEFT JOIN usuarios u ON u.id=p.usuario_id LEFT JOIN clientes c ON c.id=p.cliente_id WHERE ${where} ORDER BY p.created_at DESC LIMIT 100`, params)
    return res.status(200).json({success:true,data:pedidos})
  }
  if (req.method === 'POST') {
    const { mesa_id, cliente_id, tipo='mesa', notas, items } = req.body ?? {}
    if (!items?.length) return res.status(400).json({success:false,message:'Items requeridos'})
    try {
      const pid = uuid(); let subtotal=0, impuestos=0
      for (const item of items) {
        const prod = await queryOne<any>(`SELECT precio_venta,impuesto_pct,disponible FROM productos WHERE id=$1 AND empresa_id=$2`,[item.producto_id,eid])
        if (!prod||!prod.disponible) return res.status(400).json({success:false,message:'Producto no disponible'})
        const s=prod.precio_venta*item.cantidad; subtotal+=s; impuestos+=s*prod.impuesto_pct/100
      }
      await query(`INSERT INTO pedidos (id,empresa_id,mesa_id,cliente_id,usuario_id,estado,subtotal,impuestos,total,notas,tipo) VALUES ($1,$2,$3,$4,$5,'abierto',$6,$7,$8,$9,$10)`,[pid,eid,mesa_id||null,cliente_id||null,auth.id,subtotal,impuestos,subtotal+impuestos,notas||null,tipo])
      for (const item of items) {
        const prod = await queryOne<any>(`SELECT precio_venta,impuesto_pct,destino FROM productos WHERE id=$1`,[item.producto_id])
        if (!prod) continue
        await query(`INSERT INTO pedido_items (id,pedido_id,empresa_id,producto_id,cantidad,precio_unit,impuesto_pct,subtotal,observaciones,estado,destino) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10)`,[uuid(),pid,eid,item.producto_id,item.cantidad,prod.precio_venta,prod.impuesto_pct,prod.precio_venta*item.cantidad,item.observaciones||null,prod.destino])
      }
      if (mesa_id) await query(`UPDATE mesas SET estado='ocupada' WHERE id=$1 AND empresa_id=$2`,[mesa_id,eid])
      const pedido = await queryOne(`SELECT p.*,json_agg(json_build_object('id',pi.id,'producto_id',pi.producto_id,'nombre',pr.nombre,'cantidad',pi.cantidad,'precio_unit',pi.precio_unit,'subtotal',pi.subtotal,'observaciones',pi.observaciones,'estado',pi.estado,'destino',pi.destino)) as items FROM pedidos p JOIN pedido_items pi ON pi.pedido_id=p.id JOIN productos pr ON pr.id=pi.producto_id WHERE p.id=$1 GROUP BY p.id`,[pid])
      return res.status(201).json({success:true,data:pedido})
    } catch(e){console.error(e);return res.status(500).json({success:false,message:'Error interno'})}
  }
  return res.status(405).end()
}
