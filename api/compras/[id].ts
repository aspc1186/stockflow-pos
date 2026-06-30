import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query, queryOne } from '../_db'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const { id } = req.query; const eid = auth.empresa_id
  const orden = await queryOne<any>(`SELECT * FROM ordenes_compra WHERE id=$1 AND empresa_id=$2`,[id,eid])
  if (!orden) return res.status(404).json({success:false,message:'Orden no encontrada'})
  if (req.method === 'PATCH') {
    const { estado } = req.body ?? {}
    const [u]=await query(`UPDATE ordenes_compra SET estado=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,[estado,id])
    if (estado==='recibida') {
      const items=await query<any>(`SELECT * FROM ordenes_compra_items WHERE orden_id=$1`,[id])
      for (const item of items) {
        const inv=await queryOne<any>(`SELECT stock_actual FROM inventario WHERE producto_id=$1 AND empresa_id=$2`,[item.producto_id,eid])
        if (!inv) continue
        const antes=inv.stock_actual, despues=antes+item.cantidad
        await query(`UPDATE inventario SET stock_actual=$1,updated_at=NOW() WHERE producto_id=$2 AND empresa_id=$3`,[despues,item.producto_id,eid])
        await query(`INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues,costo_unit,referencia_id,referencia_tipo) VALUES (gen_random_uuid(),$1,$2,$3,'compra',$4,$5,$6,$7,$8,'orden_compra')`,[eid,item.producto_id,auth.id,item.cantidad,antes,despues,item.precio_unit,id])
      }
    }
    return res.status(200).json({success:true,data:u})
  }
  return res.status(405).end()
}
