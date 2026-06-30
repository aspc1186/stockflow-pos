import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from './_auth'
import { query, queryOne } from './_db'
import { v4 as uuid } from 'uuid'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id

  // Extraer ID de la URL si existe: /api/mesas/[id]
  const parts = (req.url || '').split('?')[0].split('/')
  const id = parts.length > 3 ? parts[parts.length - 1] : null

  if (!id) {
    // GET /api/mesas
    if (req.method === 'GET') {
      const mesas = await query(
        `SELECT m.*,z.nombre as zona_nombre,p.id as pedido_id,p.estado as pedido_estado,p.total as pedido_total,p.apertura_at,u.nombre as mesero_nombre FROM mesas m LEFT JOIN zonas z ON z.id=m.zona_id LEFT JOIN pedidos p ON p.mesa_id=m.id AND p.estado NOT IN ('cobrado','cancelado') LEFT JOIN usuarios u ON u.id=p.usuario_id WHERE m.empresa_id=$1 AND m.activa=true ORDER BY m.numero`,
        [eid]
      )
      return res.status(200).json({ success: true, data: mesas })
    }
    // POST /api/mesas
    if (req.method === 'POST') {
      if (!['admin','supervisor'].includes(auth.rol)) return res.status(403).json({ success: false, message: 'Sin permisos' })
      const { zona_id, numero, nombre, capacidad, pos_x, pos_y } = req.body ?? {}
      if (!numero) return res.status(400).json({ success: false, message: 'Número requerido' })
      const existe = await queryOne(`SELECT id FROM mesas WHERE empresa_id=$1 AND numero=$2`, [eid, numero])
      if (existe) return res.status(400).json({ success: false, message: 'Mesa ya existe' })
      const [m] = await query(`INSERT INTO mesas (id,empresa_id,zona_id,numero,nombre,capacidad,pos_x,pos_y) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [uuid(),eid,zona_id||null,numero,nombre||null,capacidad||4,pos_x||0,pos_y||0])
      return res.status(201).json({ success: true, data: m })
    }
  } else {
    const mesa = await queryOne(`SELECT * FROM mesas WHERE id=$1 AND empresa_id=$2`, [id, eid])
    if (!mesa) return res.status(404).json({ success: false, message: 'Mesa no encontrada' })
    // GET /api/mesas/[id]
    if (req.method === 'GET') return res.status(200).json({ success: true, data: mesa })
    // PATCH /api/mesas/[id]
    if (req.method === 'PATCH') {
      const { estado, numero, nombre, capacidad, activa } = req.body ?? {}
      const [u] = await query(`UPDATE mesas SET estado=COALESCE($1,estado),numero=COALESCE($2,numero),nombre=COALESCE($3,nombre),capacidad=COALESCE($4,capacidad),activa=COALESCE($5,activa) WHERE id=$6 AND empresa_id=$7 RETURNING *`, [estado,numero,nombre,capacidad,activa,id,eid])
      return res.status(200).json({ success: true, data: u })
    }
  }
  return res.status(405).end()
}
