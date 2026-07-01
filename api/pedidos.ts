const { requireAuth, cors } = require('../_auth')
const { query, queryOne } = require('../_db')
const { v4: uuid } = require('uuid')

module.exports = async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  const urlPath = (req.url || '').split('?')[0]
  const parts = urlPath.split('/').filter(Boolean)
  const pedidoId = parts[2] || null

  if (!pedidoId) {
    if (req.method === 'GET') {
      const { estado, mesa_id } = req.query || {}
      let where = `p.empresa_id=$1`
      const params: any[] = [eid]
      let idx = 2
      if (estado) { where += ` AND p.estado=ANY($${idx++})`; params.push(estado.split(',')) }
      if (mesa_id) { where += ` AND p.mesa_id=$${idx++}`; params.push(mesa_id) }
      const pedidos = await query(`SELECT p.*,m.numero as mesa_numero,u.nombre as usuario_nombre FROM pedidos p LEFT JOIN mesas m ON m.id=p.mesa_id LEFT JOIN usuarios u ON u.id=p.usuario_id WHERE ${where} ORDER BY p.created_at DESC LIMIT 100`, params)
      return res.status(200).json({ success: true, data: pedidos })
    }
    if (req.method === 'POST') {
      const { mesa_id, cliente_id, tipo = 'mesa', notas, items } = req.body ?? {}
      if (!items?.length) return res.status(400).json({ success: false, message: 'Items requeridos' })
      try {
        const pid = uuid()
        let subtotal = 0, impuestos = 0
        for (const item of items) {
          const prod = await queryOne(`SELECT precio_venta,impuesto_pct,disponible FROM productos WHERE id=$1 AND empresa_id=$2`, [item.producto_id, eid])
          if (!prod || !prod.disponible) return res.status(400).json({ success: false, message: 'Producto no disponible' })
          const s = prod.precio_venta * item.cantidad; subtotal += s; impuestos += s * prod.impuesto_pct / 100
        }
        await query(`INSERT INTO pedidos (id,empresa_id,mesa_id,cliente_id,usuario_id,estado,subtotal,impuestos,total,notas,tipo) VALUES ($1,$2,$3,$4,$5,'abierto',$6,$7,$8,$9,$10)`, [pid, eid, mesa_id || null, cliente_id || null, auth.id, subtotal, impuestos, subtotal + impuestos, notas || null, tipo])
        for (const item of items) {
          const prod = await queryOne(`SELECT precio_venta,impuesto_pct,destino FROM productos WHERE id=$1`, [item.producto_id])
          if (!prod) continue
          await query(`INSERT INTO pedido_items (id,pedido_id,empresa_id,producto_id,cantidad,precio_unit,impuesto_pct,subtotal,observaciones,estado,destino) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10)`, [uuid(), pid, eid, item.producto_id, item.cantidad, prod.precio_venta, prod.impuesto_pct, prod.precio_venta * item.cantidad, item.observaciones || null, prod.destino])
        }
        if (mesa_id) await query(`UPDATE mesas SET estado='ocupada' WHERE id=$1 AND empresa_id=$2`, [mesa_id, eid])
        const pedido = await queryOne(`SELECT * FROM pedidos WHERE id=$1`, [pid])
        return res.status(201).json({ success: true, data: pedido })
      } catch (e: any) { console.error(e.message); return res.status(500).json({ success: false, message: 'Error interno' }) }
    }
  } else {
    const pedido = await queryOne(`SELECT * FROM pedidos WHERE id=$1 AND empresa_id=$2`, [pedidoId, eid])
    if (!pedido) return res.status(404).json({ success: false, message: 'Pedido no encontrado' })
    if (req.method === 'GET') {
      return res.status(200).json({ success: true, data: pedido })
    }
    if (req.method === 'PATCH') {
      const { estado, descuento, propina, notas, cliente_id } = req.body ?? {}
      const ups: string[] = [], params: any[] = []; let idx = 1
      if (estado) { ups.push(`estado=$${idx++}`); params.push(estado) }
      if (descuento !== undefined) { ups.push(`descuento=$${idx++}`); params.push(descuento) }
      if (propina !== undefined) { ups.push(`propina=$${idx++}`); params.push(propina) }
      if (notas !== undefined) { ups.push(`notas=$${idx++}`); params.push(notas) }
      if (!ups.length) return res.status(400).end()
      ups.push('updated_at=NOW()'); params.push(pedidoId, eid)
      const [u] = await query(`UPDATE pedidos SET ${ups.join(',')} WHERE id=$${idx++} AND empresa_id=$${idx++} RETURNING *`, params)
      return res.status(200).json({ success: true, data: u })
    }
  }
  return res.status(405).end()
}
