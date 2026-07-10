const { v4: uuid } = require('uuid')
const { query, queryOne } = require('../_db')
const { authenticate, cors } = require('../_auth')

module.exports = async function(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  const parts = (req.url||'').split('?')[0].split('/').filter(Boolean)
  const id = parts[2] || null

  if (!id) {
    if (req.method === 'GET') {
      const rows = await query(
        `SELECT m.*,z.nombre as zona_nombre,
         p.id as pedido_id,p.estado as pedido_estado,p.total as pedido_total,p.apertura_at,
         u.nombre as mesero_nombre
         FROM mesas m
         LEFT JOIN zonas z ON z.id=m.zona_id
         LEFT JOIN pedidos p ON p.mesa_id=m.id AND p.estado NOT IN ('cobrado','cancelado')
         LEFT JOIN usuarios u ON u.id=p.usuario_id
         WHERE m.empresa_id=$1 AND m.activa=true
         ORDER BY m.numero`, [eid])
      return res.status(200).json({ ok: true, data: rows })
    }
    if (req.method === 'POST') {
      const { zona_id, numero, nombre, capacidad, tipo, consumo_minimo, pos_x, pos_y } = req.body||{}
      if (!numero) return res.status(400).json({ ok: false, msg: 'Número requerido' })
      try {
        const [m] = await query(
          `INSERT INTO mesas (id,empresa_id,zona_id,numero,nombre,capacidad,tipo,consumo_minimo,pos_x,pos_y,estado,activa)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'libre',true) RETURNING *`,
          [uuid(),eid,zona_id||null,numero,nombre||null,capacidad||4,tipo||'mesa',consumo_minimo||0,pos_x||0,pos_y||0])
        return res.status(201).json({ ok: true, data: m })
      } catch(e: any) { return res.status(500).json({ ok: false, msg: e.message }) }
    }
  } else {
    const mesa = await queryOne(`SELECT * FROM mesas WHERE id=$1 AND empresa_id=$2`, [id,eid])
    if (!mesa) return res.status(404).json({ ok: false, msg: 'Mesa no encontrada' })
    if (req.method === 'GET') return res.status(200).json({ ok: true, data: mesa })
    if (req.method === 'PATCH') {
      const { estado, nombre, capacidad, activa, zona_id, consumo_minimo, pos_x, pos_y } = req.body||{}
      const [u] = await query(
        `UPDATE mesas SET estado=COALESCE($1,estado),nombre=COALESCE($2,nombre),capacidad=COALESCE($3,capacidad),activa=COALESCE($4,activa),zona_id=COALESCE($5,zona_id),consumo_minimo=COALESCE($6,consumo_minimo),pos_x=COALESCE($7,pos_x),pos_y=COALESCE($8,pos_y) WHERE id=$9 AND empresa_id=$10 RETURNING *`,
        [estado,nombre,capacidad,activa,zona_id,consumo_minimo,pos_x,pos_y,id,eid])
      return res.status(200).json({ ok: true, data: u })
    }
    if (req.method === 'DELETE') {
      await query(`UPDATE mesas SET activa=false WHERE id=$1 AND empresa_id=$2`, [id,eid])
      return res.status(200).json({ ok: true })
    }
  }
  return res.status(405).end()
}

export {}
