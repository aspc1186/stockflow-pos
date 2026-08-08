import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let schemaReady: Promise<void> | null = null
function ensureSchema() {
  if (!schemaReady) schemaReady = query(`
    CREATE TABLE IF NOT EXISTS conteos_inventario (
      id UUID PRIMARY KEY, empresa_id UUID NOT NULL, usuario_id UUID,
      nombre VARCHAR(160) NOT NULL, tipo VARCHAR(20) NOT NULL DEFAULT 'general',
      estado VARCHAR(20) NOT NULL DEFAULT 'programado', programado_para DATE,
      creado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), cerrado_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS conteos_inventario_items (
      id UUID PRIMARY KEY, conteo_id UUID NOT NULL REFERENCES conteos_inventario(id) ON DELETE CASCADE,
      producto_id UUID NOT NULL, cantidad_contada NUMERIC(12,3) NOT NULL DEFAULT 0,
      actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(conteo_id, producto_id)
    );
  `).then(() => undefined)
  return schemaReady
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth?.empresa_id) return
  await ensureSchema()
  const empresaId = auth.empresa_id
  if (req.method === 'GET') {
    const conteos = await query(`SELECT c.*,u.nombre AS responsable,COALESCE((SELECT COUNT(*) FROM conteos_inventario_items ci WHERE ci.conteo_id=c.id),0) AS productos_contados FROM conteos_inventario c LEFT JOIN usuarios u ON u.id=c.usuario_id WHERE c.empresa_id=$1 ORDER BY CASE c.estado WHEN 'abierto' THEN 0 WHEN 'programado' THEN 1 ELSE 2 END,c.programado_para DESC NULLS LAST,c.creado_at DESC LIMIT 30`, [empresaId])
    return res.status(200).json({ ok:true, data:conteos })
  }
  if (req.method !== 'POST') return res.status(405).end()
  const body = req.body || {}
  if (body.accion === 'crear') {
    const nombre = String(body.nombre || '').trim()
    if (!nombre) return res.status(400).json({ ok:false, msg:'Indica el nombre del conteo' })
    const estado = body.iniciar ? 'abierto' : 'programado'
    const [conteo] = await query(`INSERT INTO conteos_inventario (id,empresa_id,usuario_id,nombre,tipo,estado,programado_para) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [uuid(),empresaId,auth.id,nombre,body.tipo === 'ciclico' ? 'ciclico' : 'general',estado,body.programado_para || null])
    return res.status(201).json({ ok:true, data:conteo })
  }
  const conteo = await queryOne(`SELECT * FROM conteos_inventario WHERE id=$1 AND empresa_id=$2`, [body.conteo_id,empresaId]) as any
  if (!conteo) return res.status(404).json({ ok:false, msg:'Conteo no encontrado' })
  if (body.accion === 'iniciar') {
    const [actualizado] = await query(`UPDATE conteos_inventario SET estado='abierto' WHERE id=$1 AND empresa_id=$2 AND estado='programado' RETURNING *`, [conteo.id,empresaId])
    return res.status(200).json({ ok:true, data:actualizado || conteo })
  }
  if (body.accion === 'registrar') {
    if (conteo.estado !== 'abierto') return res.status(400).json({ ok:false, msg:'Inicia el conteo antes de registrar productos' })
    const producto = await queryOne(`SELECT id FROM productos WHERE id=$1 AND empresa_id=$2`, [body.producto_id,empresaId])
    const cantidad = Number(body.cantidad)
    if (!producto || !Number.isFinite(cantidad) || cantidad < 0) return res.status(400).json({ ok:false, msg:'Producto o cantidad no válida' })
    await query(`INSERT INTO conteos_inventario_items (id,conteo_id,producto_id,cantidad_contada) VALUES ($1,$2,$3,$4) ON CONFLICT (conteo_id,producto_id) DO UPDATE SET cantidad_contada=EXCLUDED.cantidad_contada,actualizado_at=NOW()`, [uuid(),conteo.id,body.producto_id,cantidad])
    return res.status(200).json({ ok:true })
  }
  if (body.accion === 'cerrar') {
    if (conteo.estado !== 'abierto') return res.status(400).json({ ok:false, msg:'El conteo no está abierto' })
    const items = await query(`SELECT ci.producto_id,ci.cantidad_contada,COALESCE(i.stock_actual,0) AS stock_actual,p.precio_costo FROM conteos_inventario_items ci JOIN productos p ON p.id=ci.producto_id LEFT JOIN inventario i ON i.producto_id=ci.producto_id AND i.empresa_id=$2 WHERE ci.conteo_id=$1`, [conteo.id,empresaId]) as any[]
    for (const item of items) {
      const antes = Number(item.stock_actual || 0); const despues = Number(item.cantidad_contada || 0)
      await query(`INSERT INTO inventario (id,empresa_id,producto_id,stock_actual,stock_minimo) VALUES (gen_random_uuid(),$1,$2,$3,0) ON CONFLICT (empresa_id,producto_id) DO UPDATE SET stock_actual=EXCLUDED.stock_actual,updated_at=NOW()`, [empresaId,item.producto_id,despues])
      if (antes !== despues) await query(`INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues,costo_unit,notas) VALUES (gen_random_uuid(),$1,$2,$3,'ajuste',$4,$5,$6,$7,$8)`, [empresaId,item.producto_id,auth.id,Math.abs(despues-antes),antes,despues,Number(item.precio_costo||0),`Ajuste por conteo: ${conteo.nombre}`])
    }
    await query(`UPDATE conteos_inventario SET estado='cerrado',cerrado_at=NOW() WHERE id=$1`, [conteo.id])
    return res.status(200).json({ ok:true, data:{productos:items.length} })
  }
  return res.status(400).json({ ok:false, msg:'Acción no válida' })
}
