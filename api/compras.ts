const { requireAuth, cors } = require('../_auth')
const { query, queryOne } = require('../_db')
const { v4: uuid } = require('uuid')

module.exports = async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  const parts = (req.url || '').split('?')[0].split('/').filter(Boolean)
  const id = parts[2] || null

  if (!id) {
    if (req.method === 'GET') {
      const rows = await query(`SELECT o.*,p.nombre as proveedor_nombre FROM ordenes_compra o LEFT JOIN proveedores p ON p.id=o.proveedor_id WHERE o.empresa_id=$1 ORDER BY o.created_at DESC`, [eid])
      return res.status(200).json({ success: true, data: rows })
    }
    if (req.method === 'POST') {
      const { proveedor_id, items, notas } = req.body ?? {}
      if (!items?.length) return res.status(400).json({ success: false, message: 'Items requeridos' })
      let subtotal = 0
      for (const i of items) subtotal += (parseFloat(i.precio_unit) || 0) * (parseFloat(i.cantidad) || 0)
      const oid = uuid()
      try {
        await query(`INSERT INTO ordenes_compra (id,empresa_id,proveedor_id,usuario_id,estado,subtotal,total,notas) VALUES ($1,$2,$3,$4,'pendiente',$5,$6,$7)`, [oid, eid, proveedor_id || null, auth.id, subtotal, subtotal, notas || null])
        for (const i of items) {
          const s = (parseFloat(i.precio_unit) || 0) * (parseFloat(i.cantidad) || 0)
          await query(`INSERT INTO ordenes_compra_items (id,orden_id,producto_id,cantidad,precio_unit,subtotal) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5)`, [oid, i.producto_id, parseFloat(i.cantidad), parseFloat(i.precio_unit), s])
        }
        const o = await queryOne(`SELECT * FROM ordenes_compra WHERE id=$1`, [oid])
        return res.status(201).json({ success: true, data: o })
      } catch (e: any) { return res.status(500).json({ success: false, message: e.message }) }
    }
  } else {
    const orden = await queryOne(`SELECT * FROM ordenes_compra WHERE id=$1 AND empresa_id=$2`, [id, eid]) as any
    if (!orden) return res.status(404).json({ success: false, message: 'Orden no encontrada' })
    if (req.method === 'PATCH') {
      const { estado } = req.body ?? {}
      const [u] = await query(`UPDATE ordenes_compra SET estado=$1,updated_at=NOW() WHERE id=$2 RETURNING *`, [estado, id])
      if (estado === 'recibida') {
        const items = await query(`SELECT * FROM ordenes_compra_items WHERE orden_id=$1`, [id]) as any[]
        for (const item of items) {
          const inv = await queryOne(`SELECT stock_actual FROM inventario WHERE producto_id=$1 AND empresa_id=$2`, [item.producto_id, eid]) as any
          if (!inv) continue
          const despues = inv.stock_actual + item.cantidad
          await query(`UPDATE inventario SET stock_actual=$1,updated_at=NOW() WHERE producto_id=$2 AND empresa_id=$3`, [despues, item.producto_id, eid])
        }
      }
      return res.status(200).json({ success: true, data: u })
    }
  }
  return res.status(405).end()
}
