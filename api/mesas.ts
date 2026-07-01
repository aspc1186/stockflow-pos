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
      const rows = await query(`SELECT m.*,z.nombre as zona_nombre,p.id as pedido_id,p.estado as pedido_estado,p.total as pedido_total FROM mesas m LEFT JOIN zonas z ON z.id=m.zona_id LEFT JOIN pedidos p ON p.mesa_id=m.id AND p.estado NOT IN ('cobrado','cancelado') WHERE m.empresa_id=$1 AND m.activa=true ORDER BY m.numero`, [eid])
      return res.status(200).json({ success: true, data: rows })
    }
    if (req.method === 'POST') {
      const { zona_id, numero, nombre, capacidad } = req.body ?? {}
      if (!numero) return res.status(400).json({ success: false, message: 'Número requerido' })
      try {
        const [m] = await query(`INSERT INTO mesas (id,empresa_id,zona_id,numero,nombre,capacidad,estado,activa) VALUES ($1,$2,$3,$4,$5,$6,'libre',true) RETURNING *`,
          [uuid(), eid, zona_id || null, numero, nombre || null, capacidad || 4])
        return res.status(201).json({ success: true, data: m })
      } catch (e: any) { return res.status(500).json({ success: false, message: e.message }) }
    }
  } else {
    const mesa = await queryOne(`SELECT * FROM mesas WHERE id=$1 AND empresa_id=$2`, [id, eid])
    if (!mesa) return res.status(404).json({ success: false, message: 'Mesa no encontrada' })
    if (req.method === 'GET') return res.status(200).json({ success: true, data: mesa })
    if (req.method === 'PATCH') {
      const { estado, numero, nombre, capacidad, activa, zona_id } = req.body ?? {}
      const [u] = await query(`UPDATE mesas SET estado=COALESCE($1,estado),numero=COALESCE($2,numero),nombre=COALESCE($3,nombre),capacidad=COALESCE($4,capacidad),activa=COALESCE($5,activa),zona_id=COALESCE($6,zona_id) WHERE id=$7 AND empresa_id=$8 RETURNING *`,
        [estado, numero, nombre, capacidad, activa, zona_id, id, eid])
      return res.status(200).json({ success: true, data: u })
    }
    if (req.method === 'DELETE') {
      await query(`UPDATE mesas SET activa=false WHERE id=$1 AND empresa_id=$2`, [id, eid])
      return res.status(200).json({ success: true })
    }
  }
  return res.status(405).end()
}
