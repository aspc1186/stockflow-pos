import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let schemaReady: Promise<void> | null = null
function ensureSchema() {
  if (!schemaReady) schemaReady = query(`CREATE TABLE IF NOT EXISTS integraciones_erp (id UUID PRIMARY KEY, empresa_id UUID NOT NULL, proveedor VARCHAR(50) NOT NULL, nombre VARCHAR(100) NOT NULL, ambiente VARCHAR(20) NOT NULL DEFAULT 'pruebas', endpoint TEXT, usuario TEXT, secreto TEXT, configuracion JSONB NOT NULL DEFAULT '{}'::jsonb, activo BOOLEAN NOT NULL DEFAULT false, estado VARCHAR(30) NOT NULL DEFAULT 'pendiente', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(empresa_id,proveedor))`).then(() => undefined)
  return schemaReady
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth?.empresa_id) return
  if (!['admin','supervisor'].includes(auth.rol)) return res.status(403).json({ ok:false, msg:'Sin permisos' })
  await ensureSchema()
  const eid = auth.empresa_id
  const id = (req.url || '').split('?')[0].split('/').filter(Boolean)[2]
  if (!id && req.method === 'GET') {
    const rows = await query(`SELECT id,empresa_id,proveedor,nombre,ambiente,endpoint,usuario,configuracion,activo,estado,updated_at,created_at,(secreto IS NOT NULL AND secreto<>'') as tiene_secreto FROM integraciones_erp WHERE empresa_id=$1 ORDER BY nombre`, [eid])
    return res.status(200).json({ ok:true, data:rows })
  }
  const body = req.body || {}
  if (!id && req.method === 'POST') {
    const { proveedor, nombre, ambiente, endpoint, usuario, secreto, configuracion, activo } = body
    if (!proveedor || !nombre) return res.status(400).json({ ok:false, msg:'Proveedor y nombre requeridos' })
    const [row] = await query(`INSERT INTO integraciones_erp (id,empresa_id,proveedor,nombre,ambiente,endpoint,usuario,secreto,configuracion,activo,estado) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) RETURNING id,empresa_id,proveedor,nombre,ambiente,endpoint,usuario,configuracion,activo,estado,updated_at`, [uuid(),eid,proveedor,nombre,ambiente || 'pruebas',endpoint || null,usuario || null,secreto || null,JSON.stringify(configuracion || {}),!!activo,secreto ? 'configurado' : 'pendiente'])
    return res.status(201).json({ ok:true, data:row })
  }
  if (!id) return res.status(405).end()
  const actual = await queryOne(`SELECT * FROM integraciones_erp WHERE id=$1 AND empresa_id=$2`, [id,eid]) as any
  if (!actual) return res.status(404).json({ ok:false, msg:'Integracion no encontrada' })
  if (req.method === 'PATCH') {
    const secreto = Object.prototype.hasOwnProperty.call(body,'secreto') ? body.secreto : actual.secreto
    const [row] = await query(`UPDATE integraciones_erp SET nombre=COALESCE($1,nombre),ambiente=COALESCE($2,ambiente),endpoint=COALESCE($3,endpoint),usuario=COALESCE($4,usuario),secreto=$5,configuracion=COALESCE($6::jsonb,configuracion),activo=COALESCE($7,activo),estado=$8,updated_at=NOW() WHERE id=$9 AND empresa_id=$10 RETURNING id,empresa_id,proveedor,nombre,ambiente,endpoint,usuario,configuracion,activo,estado,updated_at`, [body.nombre,body.ambiente,body.endpoint,body.usuario,secreto,body.configuracion ? JSON.stringify(body.configuracion) : null,body.activo,secreto ? 'configurado' : 'pendiente',id,eid])
    return res.status(200).json({ ok:true, data:row })
  }
  if (req.method === 'DELETE') { await query(`DELETE FROM integraciones_erp WHERE id=$1 AND empresa_id=$2`, [id,eid]); return res.status(200).json({ok:true}) }
  return res.status(405).end()
}
