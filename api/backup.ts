import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { cors } from '../_auth.js'

const TABLAS_RESPALDO = [
  ['zonas', 'SELECT * FROM zonas WHERE empresa_id=$1 ORDER BY nombre'],
  ['categorias', 'SELECT * FROM categorias WHERE empresa_id=$1 ORDER BY nombre'],
  ['productos', 'SELECT * FROM productos WHERE empresa_id=$1 ORDER BY nombre'],
  ['inventario', 'SELECT * FROM inventario WHERE empresa_id=$1 ORDER BY producto_id'],
  ['mesas', 'SELECT * FROM mesas WHERE empresa_id=$1 ORDER BY numero'],
  ['usuarios', "SELECT id,empresa_id,rol_id,nombre,email,username,telefono,activo,ultimo_acceso,created_at,updated_at FROM usuarios WHERE empresa_id=$1 ORDER BY nombre"],
  ['pedidos', 'SELECT * FROM pedidos WHERE empresa_id=$1 ORDER BY created_at'],
  ['pedido_items', 'SELECT * FROM pedido_items WHERE empresa_id=$1 ORDER BY created_at'],
  ['cajas', 'SELECT * FROM cajas WHERE empresa_id=$1 ORDER BY apertura_at'],
  ['caja_movimientos', 'SELECT * FROM caja_movimientos WHERE empresa_id=$1 ORDER BY created_at'],
  ['movimientos_inventario', 'SELECT * FROM movimientos_inventario WHERE empresa_id=$1 ORDER BY created_at'],
] as const

async function ensureBackupSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS respaldos_empresas (
      id UUID PRIMARY KEY,
      empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      creado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      datos JSONB NOT NULL
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS respaldos_empresas_empresa_fecha_idx ON respaldos_empresas (empresa_id, creado_at DESC)`)
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ ok: false, msg: 'No autorizado' })

  try {
    await ensureBackupSchema()
    const empresas = await query(`SELECT id,nombre FROM empresas WHERE activa=true ORDER BY created_at`)
    let creados = 0

    for (const empresa of empresas) {
      const existente = await queryOne(`SELECT id FROM respaldos_empresas WHERE empresa_id=$1 AND creado_at::date=CURRENT_DATE`, [empresa.id])
      if (existente) continue

      const datos: Record<string, any> = { empresa: await queryOne(`SELECT * FROM empresas WHERE id=$1`, [empresa.id]) }
      for (const [nombre, sql] of TABLAS_RESPALDO) datos[nombre] = await query(sql, [empresa.id])

      await query(`INSERT INTO respaldos_empresas (id,empresa_id,datos) VALUES ($1,$2,$3::jsonb)`, [uuid(), empresa.id, JSON.stringify(datos)])
      await query(`DELETE FROM respaldos_empresas WHERE empresa_id=$1 AND creado_at < NOW() - INTERVAL '30 days'`, [empresa.id])
      creados++
    }

    return res.status(200).json({ ok: true, empresas: empresas.length, respaldos_creados: creados })
  } catch (e: any) {
    console.error('[backup]', e.message)
    return res.status(500).json({ ok: false, msg: 'No fue posible crear los respaldos' })
  }
}
