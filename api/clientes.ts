import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let schemaReady: Promise<void> | null = null
function ensureSchema() {
  if (!schemaReady) schemaReady = query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS documento VARCHAR(50), ADD COLUMN IF NOT EXISTS notas TEXT, ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`).then(() => undefined)
  return schemaReady
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth?.empresa_id) return
  await ensureSchema()
  const eid = auth.empresa_id
  const id = (req.url || '').split('?')[0].split('/').filter(Boolean)[2]

  if (!id && req.method === 'GET') {
    const search = String(req.query?.search || '').trim()
    const params: any[] = [eid]
    let where = 'empresa_id=$1 AND activo=true'
    if (search) { params.push(`%${search}%`); where += ` AND (nombre ILIKE $2 OR telefono ILIKE $2 OR documento ILIKE $2)` }
    const rows = await query(`SELECT * FROM clientes WHERE ${where} ORDER BY nombre LIMIT 500`, params)
    return res.status(200).json({ ok:true, data:rows })
  }
  if (!id && req.method === 'POST') {
    const { nombre, telefono, email, documento, tipo_cliente, notas } = req.body || {}
    if (!String(nombre || '').trim()) return res.status(400).json({ ok:false, msg:'Nombre requerido' })
    const [cliente] = await query(`INSERT INTO clientes (id,empresa_id,nombre,telefono,email,documento,tipo_cliente,notas,activo,total_visitas,total_consumo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,0,0) RETURNING *`, [uuid(),eid,String(nombre).trim(),telefono || null,email || null,documento || null,tipo_cliente || 'regular',notas || null])
    return res.status(201).json({ ok:true, data:cliente })
  }
  if (!id) return res.status(405).end()

  const cliente = await queryOne(`SELECT * FROM clientes WHERE id=$1 AND empresa_id=$2`, [id,eid])
  if (!cliente) return res.status(404).json({ ok:false, msg:'Cliente no encontrado' })
  if (req.method === 'PATCH') {
    const { nombre, telefono, email, documento, tipo_cliente, notas, activo } = req.body || {}
    const [actualizado] = await query(`UPDATE clientes SET nombre=COALESCE($1,nombre),telefono=COALESCE($2,telefono),email=COALESCE($3,email),documento=COALESCE($4,documento),tipo_cliente=COALESCE($5,tipo_cliente),notas=COALESCE($6,notas),activo=COALESCE($7,activo),updated_at=NOW() WHERE id=$8 AND empresa_id=$9 RETURNING *`, [nombre,telefono,email,documento,tipo_cliente,notas,activo,id,eid])
    return res.status(200).json({ ok:true, data:actualizado })
  }
  if (req.method === 'DELETE') {
    await query(`UPDATE clientes SET activo=false,updated_at=NOW() WHERE id=$1 AND empresa_id=$2`, [id,eid])
    return res.status(200).json({ ok:true })
  }
  return res.status(405).end()
}
