import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query, queryOne } from '../_db'
import { v4 as uuid } from 'uuid'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  if (req.method === 'GET') {
    const rows = await query(`SELECT o.*,p.nombre as proveedor_nombre FROM ordenes_compra o LEFT JOIN proveedores p ON p.id=o.proveedor_id WHERE o.empresa_id=$1 ORDER BY o.created_at DESC`,[eid])
    return res.status(200).json({success:true,data:rows})
  }
  if (req.method === 'POST') {
    if (!['admin','supervisor','bodeguero'].includes(auth.rol)) return res.status(403).json({success:false,message:'Sin permisos'})
    const { proveedor_id,items,notas,fecha_esperada } = req.body ?? {}
    if (!items?.length) return res.status(400).json({success:false,message:'Items requeridos'})
    let subtotal=0; for (const i of items) subtotal+=(parseFloat(i.precio_unit)||0)*(parseFloat(i.cantidad)||0)
    const oid=uuid()
    await query(`INSERT INTO ordenes_compra (id,empresa_id,proveedor_id,usuario_id,estado,subtotal,total,notas,fecha_esperada) VALUES ($1,$2,$3,$4,'pendiente',$5,$6,$7,$8)`,[oid,eid,proveedor_id||null,auth.id,subtotal,subtotal,notas||null,fecha_esperada||null])
    for (const i of items) {
      const s=(parseFloat(i.precio_unit)||0)*(parseFloat(i.cantidad)||0)
      await query(`INSERT INTO ordenes_compra_items (id,orden_id,producto_id,cantidad,precio_unit,subtotal) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5)`,[oid,i.producto_id,parseFloat(i.cantidad),parseFloat(i.precio_unit),s])
    }
    const o=await queryOne(`SELECT * FROM ordenes_compra WHERE id=$1`,[oid])
    return res.status(201).json({success:true,data:o})
  }
  return res.status(405).end()
}
