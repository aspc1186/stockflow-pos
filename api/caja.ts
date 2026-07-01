const { requireAuth, cors } = require('../_auth')
const { query, queryOne } = require('../_db')
const { v4: uuid } = require('uuid')

module.exports = async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id

  if (req.method === 'GET') {
    const caja = await queryOne(`SELECT c.*,u.nombre as cajero_nombre FROM cajas c LEFT JOIN usuarios u ON u.id=c.usuario_id WHERE c.empresa_id=$1 AND c.estado='abierta' ORDER BY c.apertura_at DESC LIMIT 1`, [eid])
    const movs = caja ? await query(`SELECT * FROM caja_movimientos WHERE caja_id=$1 ORDER BY created_at DESC LIMIT 50`, [(caja as any).id]) : []
    return res.status(200).json({ success: true, data: { caja, movimientos: movs } })
  }
  if (req.method === 'POST') {
    const { accion, saldo_inicial, tipo, metodo_pago, monto, descripcion, pedido_id, notas } = req.body ?? {}
    if (accion === 'abrir') {
      const existe = await queryOne(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta'`, [eid])
      if (existe) return res.status(400).json({ success: false, message: 'Ya hay caja abierta' })
      const [c] = await query(`INSERT INTO cajas (id,empresa_id,usuario_id,saldo_inicial,estado,total_ventas,total_ingresos,total_egresos) VALUES ($1,$2,$3,$4,'abierta',0,0,0) RETURNING *`, [uuid(), eid, auth.id, saldo_inicial || 0])
      return res.status(201).json({ success: true, data: c })
    }
    if (accion === 'movimiento') {
      const caja = await queryOne(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`, [eid])
      if (!caja) return res.status(400).json({ success: false, message: 'Sin caja abierta' })
      const [m] = await query(`INSERT INTO caja_movimientos (id,empresa_id,caja_id,usuario_id,pedido_id,tipo,metodo_pago,monto,descripcion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [uuid(), eid, (caja as any).id, auth.id, pedido_id || null, tipo || 'ingreso', metodo_pago || 'efectivo', monto, descripcion || null])
      return res.status(201).json({ success: true, data: m })
    }
    if (accion === 'cerrar') {
      const caja = await queryOne(`SELECT * FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`, [eid]) as any
      if (!caja) return res.status(400).json({ success: false, message: 'Sin caja abierta' })
      const sf = parseFloat(caja.saldo_inicial) + parseFloat(caja.total_ventas) + parseFloat(caja.total_ingresos) - parseFloat(caja.total_egresos)
      const [u] = await query(`UPDATE cajas SET estado='cerrada',saldo_final=$1,cierre_at=NOW(),notas=$2 WHERE id=$3 RETURNING *`, [sf, notas || null, caja.id])
      return res.status(200).json({ success: true, data: u })
    }
    return res.status(400).json({ success: false, message: 'Acción no válida' })
  }
  return res.status(405).end()
}
