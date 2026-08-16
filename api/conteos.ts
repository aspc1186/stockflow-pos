import { v4 as uuid } from 'uuid'
import { query, queryOne, transaction } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let schemaReady: Promise<void> | null = null

function ensureSchema() {
  if (!schemaReady) schemaReady = query(`
    CREATE TABLE IF NOT EXISTS conteos_inventario (
      id UUID PRIMARY KEY, empresa_id UUID NOT NULL, usuario_id UUID,
      nombre VARCHAR(160) NOT NULL, tipo VARCHAR(20) NOT NULL DEFAULT 'general',
      estado VARCHAR(32) NOT NULL DEFAULT 'borrador', programado_para DATE,
      creado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cerrado_at TIMESTAMPTZ, aprobado_at TIMESTAMPTZ, aprobado_por UUID, conciliado_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS conteos_inventario_items (
      id UUID PRIMARY KEY, conteo_id UUID NOT NULL REFERENCES conteos_inventario(id) ON DELETE CASCADE,
      producto_id UUID NOT NULL, cantidad_contada NUMERIC(12,3) NOT NULL DEFAULT 0,
      stock_sistema NUMERIC(12,3), contado BOOLEAN NOT NULL DEFAULT FALSE,
      usuario_id UUID, contado_at TIMESTAMPTZ, actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(conteo_id, producto_id)
    );
    ALTER TABLE conteos_inventario ADD COLUMN IF NOT EXISTS actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE conteos_inventario ADD COLUMN IF NOT EXISTS aprobado_at TIMESTAMPTZ;
    ALTER TABLE conteos_inventario ADD COLUMN IF NOT EXISTS aprobado_por UUID;
    ALTER TABLE conteos_inventario ADD COLUMN IF NOT EXISTS conciliado_at TIMESTAMPTZ;
    ALTER TABLE conteos_inventario ALTER COLUMN estado TYPE VARCHAR(32);
    ALTER TABLE conteos_inventario_items ADD COLUMN IF NOT EXISTS stock_sistema NUMERIC(12,3);
    ALTER TABLE conteos_inventario_items ADD COLUMN IF NOT EXISTS contado BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE conteos_inventario_items ADD COLUMN IF NOT EXISTS usuario_id UUID;
    ALTER TABLE conteos_inventario_items ADD COLUMN IF NOT EXISTS contado_at TIMESTAMPTZ;
  `).then(() => undefined)
  return schemaReady
}

function businessDay() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = (type: string) => parts.find(part => part.type === type)?.value || ''
  return `${value('year')}${value('month')}${value('day')}`
}

async function prepararConteo(client: any, conteoId: string, empresaId: string) {
  await client.query(`
    INSERT INTO conteos_inventario_items (id,conteo_id,producto_id,cantidad_contada,stock_sistema,contado)
    SELECT gen_random_uuid(),$1,p.id,0,COALESCE(i.stock_actual,0),FALSE
    FROM productos p
    LEFT JOIN inventario i ON i.empresa_id=p.empresa_id AND i.producto_id=p.id
    WHERE p.empresa_id=$2 AND COALESCE(p.disponible,TRUE)=TRUE AND p.eliminado_at IS NULL
    ON CONFLICT (conteo_id,producto_id) DO NOTHING
  `, [conteoId, empresaId])
}

function isApprover(role: string) {
  return ['admin', 'supervisor', 'superadmin'].includes(String(role || '').toLowerCase())
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth?.empresa_id) return
  await ensureSchema()
  const empresaId = auth.empresa_id

  if (req.method === 'GET') {
    const conteoId = String(req.query?.conteo_id || '')
    if (conteoId) {
      const conteo = await queryOne(`SELECT c.*,u.nombre AS responsable,ap.nombre AS aprobador FROM conteos_inventario c LEFT JOIN usuarios u ON u.id=c.usuario_id LEFT JOIN usuarios ap ON ap.id=c.aprobado_por WHERE c.id=$1 AND c.empresa_id=$2`, [conteoId, empresaId]) as any
      if (!conteo) return res.status(404).json({ ok:false, msg:'Conteo no encontrado' })
      const items = await query(`
        SELECT ci.id,ci.producto_id,ci.cantidad_contada,ci.stock_sistema,ci.contado,ci.contado_at,
          p.nombre,p.codigo,p.precio_costo,COALESCE(i.stock_actual,0) AS stock_actual,
          contador.nombre AS contado_por,
          COALESCE(ci.cantidad_contada,0)-COALESCE(ci.stock_sistema,0) AS diferencia
        FROM conteos_inventario_items ci
        JOIN productos p ON p.id=ci.producto_id AND p.empresa_id=$2
        LEFT JOIN inventario i ON i.producto_id=p.id AND i.empresa_id=$2
        LEFT JOIN usuarios contador ON contador.id=ci.usuario_id
        WHERE ci.conteo_id=$1
        ORDER BY p.nombre
      `, [conteoId, empresaId]) as any[]
      const contados = items.filter(item => item.contado)
      const correctos = contados.filter(item => Number(item.diferencia) === 0).length
      const faltantes = contados.filter(item => Number(item.diferencia) < 0).length
      const sobrantes = contados.filter(item => Number(item.diferencia) > 0).length
      return res.status(200).json({ ok:true, data:{ conteo, items, resumen:{ referencias:contados.length, correctos, faltantes, sobrantes, pendientes:items.length-contados.length, exactitud:contados.length ? Number((correctos * 100 / contados.length).toFixed(2)) : null } } })
    }
    const conteos = await query(`
      SELECT c.*,u.nombre AS responsable,
        COALESCE((SELECT COUNT(*) FROM conteos_inventario_items ci WHERE ci.conteo_id=c.id AND ci.contado),0) AS productos_contados,
        COALESCE((SELECT COUNT(*) FROM conteos_inventario_items ci WHERE ci.conteo_id=c.id AND ci.contado AND COALESCE(ci.cantidad_contada,0)<>COALESCE(ci.stock_sistema,0)),0) AS diferencias
      FROM conteos_inventario c
      LEFT JOIN usuarios u ON u.id=c.usuario_id
      WHERE c.empresa_id=$1
      ORDER BY CASE c.estado WHEN 'en_proceso' THEN 0 WHEN 'abierto' THEN 0 WHEN 'borrador' THEN 1 WHEN 'programado' THEN 2 WHEN 'pendiente_conciliacion' THEN 3 ELSE 4 END,c.programado_para DESC NULLS LAST,c.creado_at DESC LIMIT 50
    `, [empresaId])
    return res.status(200).json({ ok:true, data:conteos })
  }

  if (req.method !== 'POST') return res.status(405).end()
  const body = req.body || {}

  if (body.accion === 'crear') {
    const tipo = body.tipo === 'ciclico' ? 'ciclico' : 'general'
    const conteo = await transaction(async client => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`conteo:${empresaId}:${tipo}:${businessDay()}`])
      const base = tipo === 'ciclico' ? 'INV-CC' : 'INV-GEN'
      const next = await client.query(`SELECT COUNT(*)::int AS total FROM conteos_inventario WHERE empresa_id=$1 AND nombre LIKE $2`, [empresaId, `${base}-%`])
      const nombre = `${base}-${String(Number(next.rows[0]?.total || 0) + 1).padStart(3, '0')}`
      const estado = body.iniciar ? 'en_proceso' : (body.programado_para ? 'programado' : 'borrador')
      const result = await client.query(`INSERT INTO conteos_inventario (id,empresa_id,usuario_id,nombre,tipo,estado,programado_para) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [uuid(),empresaId,auth.id,nombre,tipo,estado,body.programado_para || null])
      const created = result.rows[0]
      if (estado === 'en_proceso' && tipo === 'general') await prepararConteo(client, created.id, empresaId)
      return created
    })
    return res.status(201).json({ ok:true, data:conteo })
  }

  const conteo = await queryOne(`SELECT * FROM conteos_inventario WHERE id=$1 AND empresa_id=$2`, [body.conteo_id, empresaId]) as any
  if (!conteo) return res.status(404).json({ ok:false, msg:'Conteo no encontrado' })

  if (body.accion === 'iniciar') {
    if (!['borrador', 'programado', 'pausado', 'abierto'].includes(conteo.estado)) return res.status(400).json({ ok:false, msg:'Este conteo no puede iniciarse' })
    const updated = await transaction(async client => {
      const result = await client.query(`UPDATE conteos_inventario SET estado='en_proceso',actualizado_at=NOW() WHERE id=$1 AND empresa_id=$2 RETURNING *`, [conteo.id, empresaId])
      if (conteo.tipo === 'general') await prepararConteo(client, conteo.id, empresaId)
      return result.rows[0]
    })
    return res.status(200).json({ ok:true, data:updated })
  }

  if (body.accion === 'pausar') {
    const [updated] = await query(`UPDATE conteos_inventario SET estado='pausado',actualizado_at=NOW() WHERE id=$1 AND empresa_id=$2 AND estado IN ('en_proceso','abierto') RETURNING *`, [conteo.id, empresaId])
    return res.status(200).json({ ok:true, data:updated || conteo })
  }

  if (body.accion === 'registrar') {
    if (!['en_proceso', 'abierto'].includes(conteo.estado)) return res.status(400).json({ ok:false, msg:'Inicia el conteo antes de registrar productos' })
    const producto = await queryOne(`SELECT id FROM productos WHERE id=$1 AND empresa_id=$2`, [body.producto_id, empresaId])
    const cantidad = Number(body.cantidad)
    if (!producto || !Number.isFinite(cantidad) || cantidad < 0) return res.status(400).json({ ok:false, msg:'Producto o cantidad no valida' })
    await transaction(async client => {
      const stock = await client.query(`SELECT COALESCE(stock_actual,0) AS stock FROM inventario WHERE empresa_id=$1 AND producto_id=$2`, [empresaId, body.producto_id])
      const stockSistema = Number(stock.rows[0]?.stock || 0)
      await client.query(`
        INSERT INTO conteos_inventario_items (id,conteo_id,producto_id,cantidad_contada,stock_sistema,contado,usuario_id,contado_at)
        VALUES ($1,$2,$3,$4,$5,TRUE,$6,NOW())
        ON CONFLICT (conteo_id,producto_id) DO UPDATE SET cantidad_contada=EXCLUDED.cantidad_contada,contado=TRUE,usuario_id=EXCLUDED.usuario_id,contado_at=NOW(),actualizado_at=NOW()
      `, [uuid(), conteo.id, body.producto_id, cantidad, stockSistema, auth.id])
    })
    return res.status(200).json({ ok:true })
  }

  if (body.accion === 'cerrar') {
    if (!['en_proceso', 'abierto', 'pausado'].includes(conteo.estado)) return res.status(400).json({ ok:false, msg:'El conteo no esta abierto' })
    const [updated] = await query(`UPDATE conteos_inventario SET estado='pendiente_conciliacion',cerrado_at=NOW(),conciliado_at=NOW(),actualizado_at=NOW() WHERE id=$1 AND empresa_id=$2 RETURNING *`, [conteo.id, empresaId])
    return res.status(200).json({ ok:true, data:updated, msg:'Conteo cerrado. El inventario no se modifico: queda pendiente de conciliacion y aprobacion.' })
  }

  if (body.accion === 'aprobar_ajustes') {
    if (!isApprover(auth.rol)) return res.status(403).json({ ok:false, msg:'Solo un administrador o supervisor puede aprobar ajustes' })
    if (!['pendiente_conciliacion', 'reconteo'].includes(conteo.estado)) return res.status(400).json({ ok:false, msg:'El conteo debe estar pendiente de conciliacion' })
    const result = await transaction(async client => {
      const items = await client.query(`
        SELECT ci.producto_id,ci.cantidad_contada,ci.stock_sistema,p.precio_costo
        FROM conteos_inventario_items ci
        JOIN productos p ON p.id=ci.producto_id AND p.empresa_id=$2
        WHERE ci.conteo_id=$1 AND ci.contado=TRUE AND COALESCE(ci.cantidad_contada,0)<>COALESCE(ci.stock_sistema,0)
      `, [conteo.id, empresaId])
      for (const item of items.rows) {
        const antes = Number(item.stock_sistema || 0)
        const despues = Number(item.cantidad_contada || 0)
        await client.query(`INSERT INTO inventario (id,empresa_id,producto_id,stock_actual,stock_minimo) VALUES (gen_random_uuid(),$1,$2,$3,0) ON CONFLICT (empresa_id,producto_id) DO UPDATE SET stock_actual=EXCLUDED.stock_actual,updated_at=NOW()`, [empresaId, item.producto_id, despues])
        await client.query(`INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues,costo_unit,notas,created_at) VALUES (gen_random_uuid(),$1,$2,$3,'ajuste',$4,$5,$6,$7,$8,clock_timestamp())`, [empresaId,item.producto_id,auth.id,Math.abs(despues-antes),antes,despues,Number(item.precio_costo||0),`Ajuste aprobado por conciliacion: ${conteo.nombre}`])
      }
      const updated = await client.query(`UPDATE conteos_inventario SET estado='ajustado',aprobado_at=NOW(),aprobado_por=$2,actualizado_at=NOW() WHERE id=$1 RETURNING *`, [conteo.id, auth.id])
      return { conteo:updated.rows[0], ajustes:items.rows.length }
    })
    return res.status(200).json({ ok:true, data:result })
  }

  return res.status(400).json({ ok:false, msg:'Accion no valida' })
}
