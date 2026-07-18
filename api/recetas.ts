import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let schemaReady: Promise<void> | null = null
function ensureSchema() {
  if (!schemaReady) schemaReady = query(`CREATE TABLE IF NOT EXISTS recetas_producto (id UUID PRIMARY KEY, empresa_id UUID NOT NULL, producto_id UUID NOT NULL, ingrediente_id UUID NOT NULL, cantidad NUMERIC(12,3) NOT NULL, unidad VARCHAR(30) NOT NULL DEFAULT 'unidad', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(producto_id,ingrediente_id))`).then(() => undefined)
  return schemaReady
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth?.empresa_id) return
  await ensureSchema()
  const eid = auth.empresa_id
  const productoId = String(req.query?.producto_id || '')
  if (!productoId) return res.status(400).json({ ok:false, msg:'Producto requerido' })
  if (req.method === 'GET') {
    const rows = await query(`SELECT r.*,p.nombre as ingrediente_nombre,p.unidad_medida FROM recetas_producto r JOIN productos p ON p.id=r.ingrediente_id WHERE r.empresa_id=$1 AND r.producto_id=$2 ORDER BY p.nombre`, [eid,productoId])
    return res.status(200).json({ ok:true, data:rows })
  }
  if (req.method === 'PUT') {
    const ingredientes = Array.isArray(req.body?.ingredientes) ? req.body.ingredientes : []
    const producto = await queryOne(`SELECT id FROM productos WHERE id=$1 AND empresa_id=$2`, [productoId,eid])
    if (!producto) return res.status(404).json({ ok:false, msg:'Producto no encontrado' })
    await query(`DELETE FROM recetas_producto WHERE empresa_id=$1 AND producto_id=$2`, [eid,productoId])
    for (const item of ingredientes) {
      const ingredienteId = String(item.ingrediente_id || '')
      const cantidad = Number(item.cantidad)
      if (!ingredienteId || !Number.isFinite(cantidad) || cantidad <= 0 || ingredienteId === productoId) continue
      const ingrediente = await queryOne(`SELECT id FROM productos WHERE id=$1 AND empresa_id=$2`, [ingredienteId,eid])
      if (ingrediente) await query(`INSERT INTO recetas_producto (id,empresa_id,producto_id,ingrediente_id,cantidad,unidad) VALUES ($1,$2,$3,$4,$5,$6)`, [uuid(),eid,productoId,ingredienteId,cantidad,item.unidad || 'unidad'])
    }
    return res.status(200).json({ ok:true })
  }
  return res.status(405).end()
}
