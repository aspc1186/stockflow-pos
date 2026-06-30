import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../../../_auth'
import { query, queryOne } from '../../../_db'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const { id, itemId } = req.query; const eid = auth.empresa_id
  const item = await queryOne(`SELECT pi.* FROM pedido_items pi JOIN pedidos p ON p.id=pi.pedido_id WHERE pi.id=$1 AND pi.pedido_id=$2 AND p.empresa_id=$3`,[itemId,id,eid])
  if (!item) return res.status(404).json({success:false,message:'Item no encontrado'})
  if (req.method === 'PATCH') {
    const { estado, cantidad, observaciones } = req.body ?? {}
    const ups:string[]=[],params:unknown[]=[]; let idx=1
    if (estado){ups.push(`estado=$${idx++}`);params.push(estado)}
    if (cantidad!==undefined){ups.push(`cantidad=$${idx++}`);params.push(cantidad)}
    if (observaciones!==undefined){ups.push(`observaciones=$${idx++}`);params.push(observaciones)}
    if (!ups.length) return res.status(400).end()
    ups.push('updated_at=NOW()'); params.push(itemId)
    const [u]=await query(`UPDATE pedido_items SET ${ups.join(',')} WHERE id=$${idx++} RETURNING *`,params)
    return res.status(200).json({success:true,data:u})
  }
  if (req.method === 'DELETE') {
    await query(`UPDATE pedido_items SET estado='cancelado' WHERE id=$1`,[itemId])
    return res.status(200).json({success:true})
  }
  return res.status(405).end()
}
