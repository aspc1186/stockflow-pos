import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let schemaReady: Promise<void> | null = null

function ensureMesasSchema() {
  if (!schemaReady) schemaReady = query(`ALTER TABLE mesas ADD COLUMN IF NOT EXISTS mesero_id UUID`).then(() => undefined)
  return schemaReady
}

function puedeAdministrarMesas(rol: string) {
  return ['admin', 'supervisor', 'superadmin'].includes(rol)
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  await ensureMesasSchema()
  const parts = (req.url||'').split('?')[0].split('/').filter(Boolean)
  const id = parts[2] || null

  if (!id) {
    if (req.method === 'GET') {
      const esOperativo = !puedeAdministrarMesas(auth.rol)
      const rows = await query(
        `SELECT m.*,z.nombre as zona_nombre,
         p.id as pedido_id,p.estado as pedido_estado,p.total as pedido_total,p.apertura_at,
         u.nombre as mesero_nombre,
         asignado.nombre as mesero_asignado_nombre
         FROM mesas m
         LEFT JOIN zonas z ON z.id=m.zona_id
         LEFT JOIN pedidos p ON p.mesa_id=m.id AND p.estado NOT IN ('cobrado','cancelado')
         LEFT JOIN usuarios u ON u.id=p.usuario_id
         LEFT JOIN usuarios asignado ON asignado.id=m.mesero_id
         WHERE m.empresa_id=$1 AND m.activa=true AND ($2::boolean=false OR m.mesero_id=$3)
         ORDER BY m.numero`, [eid, esOperativo, auth.id])
      return res.status(200).json({ ok: true, data: rows })
    }
    if (req.method === 'POST') {
      if (!puedeAdministrarMesas(auth.rol)) return res.status(403).json({ ok: false, msg: 'Sin permisos para crear mesas' })
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
    if (!puedeAdministrarMesas(auth.rol) && mesa.mesero_id !== auth.id) return res.status(403).json({ ok: false, msg: 'Esta mesa no esta asignada a tu usuario' })
    if (req.method === 'GET') return res.status(200).json({ ok: true, data: mesa })
    if (req.method === 'PATCH') {
      if (!puedeAdministrarMesas(auth.rol)) return res.status(403).json({ ok: false, msg: 'Sin permisos para modificar mesas' })
      const { estado, nombre, capacidad, activa, zona_id, consumo_minimo, pos_x, pos_y, mesero_id } = req.body||{}
      const cambiaMesero = Object.prototype.hasOwnProperty.call(req.body || {}, 'mesero_id')
      if (cambiaMesero && mesero_id) {
        const mesero = await queryOne(
          `SELECT u.id FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=$1 AND u.empresa_id=$2 AND u.activo=true AND r.nombre='mesero'`,
          [mesero_id, eid]
        )
        if (!mesero) return res.status(400).json({ ok: false, msg: 'Selecciona un mesero activo de esta empresa' })
      }
      const [u] = await query(
        `UPDATE mesas SET estado=COALESCE($1,estado),nombre=COALESCE($2,nombre),capacidad=COALESCE($3,capacidad),activa=COALESCE($4,activa),zona_id=COALESCE($5,zona_id),consumo_minimo=COALESCE($6,consumo_minimo),pos_x=COALESCE($7,pos_x),pos_y=COALESCE($8,pos_y),mesero_id=CASE WHEN $9::boolean THEN $10 ELSE mesero_id END WHERE id=$11 AND empresa_id=$12 RETURNING *`,
        [estado,nombre,capacidad,activa,zona_id,consumo_minimo,pos_x,pos_y,cambiaMesero,mesero_id || null,id,eid])
      return res.status(200).json({ ok: true, data: u })
    }
    if (req.method === 'DELETE') {
      if (!puedeAdministrarMesas(auth.rol)) return res.status(403).json({ ok: false, msg: 'Sin permisos para eliminar mesas' })
      await query(`UPDATE mesas SET activa=false WHERE id=$1 AND empresa_id=$2`, [id,eid])
      return res.status(200).json({ ok: true })
    }
  }
  return res.status(405).end()
}
