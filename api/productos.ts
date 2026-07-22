import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let schemaReady: Promise<void> | null = null

function ensureProductosSchema() {
  if (!schemaReady) {
    schemaReady = query(`
      ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS descripcion TEXT,
        ADD COLUMN IF NOT EXISTS codigo VARCHAR(50),
        ADD COLUMN IF NOT EXISTS precio_costo NUMERIC(12,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS impuesto_pct NUMERIC(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS impuesto_tipo VARCHAR(10) DEFAULT 'iva',
        ADD COLUMN IF NOT EXISTS impuesto_incluido BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'unidad',
        ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(30) DEFAULT 'unidad',
        ADD COLUMN IF NOT EXISTS destino VARCHAR(30) DEFAULT 'barra',
        ADD COLUMN IF NOT EXISTS imagen_url TEXT,
        ADD COLUMN IF NOT EXISTS disponible BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS controla_stock BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS stock_maximo NUMERIC(12,3),
        ADD COLUMN IF NOT EXISTS eliminado_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `).then(() => undefined)
  }
  return schemaReady
}

function categoriasPorTipo(tipo: string) {
  if (tipo === 'restaurante') return ['Entradas','Platos fuertes','Acompanamientos','Postres','Bebidas','Ingredientes']
  if (tipo === 'restaurante_bar') return ['Entradas','Platos fuertes','Postres','Cervezas','Licores','Cocteles','Bebidas','Ingredientes']
  return ['Cervezas','Licores','Cocteles','Bebidas','Snacks','Combos']
}

async function asegurarCategorias(eid: string) {
  const empresa = await queryOne(`SELECT tipo FROM empresas WHERE id=$1`, [eid]) as any
  const existentes = await queryOne(`SELECT COUNT(*) as total FROM categorias WHERE empresa_id=$1`, [eid]) as any
  if (Number(existentes?.total || 0) > 0) return empresa?.tipo || 'bar'
  for (const [orden, nombre] of categoriasPorTipo(empresa?.tipo || 'bar').entries()) {
    await query(`INSERT INTO categorias (id,empresa_id,nombre,orden,activa) VALUES ($1,$2,$3,$4,true)`, [uuid(),eid,nombre,orden + 1])
  }
  return empresa?.tipo || 'bar'
}
export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  await ensureProductosSchema()
  const eid = auth.empresa_id
  const tipoNegocio = await asegurarCategorias(eid)
  const parts = (req.url||'').split('?')[0].split('/').filter(Boolean)
  const id = parts[2] || null

  if (!id) {
    if (req.method === 'GET') {
      const { disponible, search, categoria_id } = req.query||{}
      let where = `p.empresa_id=$1 AND p.eliminado_at IS NULL`; const params: any[]=[eid]; let idx=2
      if (disponible !== undefined) { where+=` AND p.disponible=$${idx++}`; params.push(disponible==='true') }
      if (search) { where+=` AND p.nombre ILIKE $${idx++}`; params.push(`%${search}%`) }
      if (categoria_id) { where+=` AND p.categoria_id=$${idx++}`; params.push(categoria_id) }
      const rows = await query(
        `SELECT p.*,c.nombre as categoria_nombre,COALESCE(i.stock_actual,0) as stock_actual,COALESCE(i.stock_minimo,0) as stock_minimo
         FROM productos p
         LEFT JOIN categorias c ON c.id=p.categoria_id
         LEFT JOIN inventario i ON i.producto_id=p.id AND i.empresa_id=p.empresa_id
         WHERE ${where} ORDER BY p.nombre`, params)
      return res.status(200).json({ ok: true, data: rows })
    }
    if (req.method === 'POST') {
      const { categoria_id,nombre,descripcion,codigo,precio_venta,precio_costo,impuesto_pct,impuesto_tipo,impuesto_incluido,tipo,unidad_medida,destino,imagen_url,disponible,controla_stock,stock_inicial,stock_minimo,stock_maximo } = req.body||{}
      if (req.query?.sincronizar === 'true') {
        const productos = Array.isArray(req.body?.productos) ? req.body.productos : []
        if (!productos.length) return res.status(400).json({ ok: false, msg: 'La plantilla no tiene productos validos' })
        if (productos.some((producto: any) => !String(producto.codigo || '').trim())) return res.status(400).json({ ok: false, msg: 'Cada producto debe tener un codigo para sincronizar la plantilla' })
        const codigos = productos.map((producto: any) => String(producto.codigo).trim().toLowerCase())
        if (new Set(codigos).size !== codigos.length) return res.status(400).json({ ok: false, msg: 'Hay codigos repetidos en la plantilla' })
        const existentes = await query(`SELECT id,codigo FROM productos WHERE empresa_id=$1 AND eliminado_at IS NULL`, [eid]) as any[]
        const porCodigo = new Map(existentes.filter(producto => producto.codigo).map(producto => [String(producto.codigo).trim().toLowerCase(), producto]))
        const conservados: string[] = []
        let creados = 0
        let actualizados = 0
        for (const producto of productos) {
          const codigoNormalizado = String(producto.codigo).trim().toLowerCase()
          const existente = porCodigo.get(codigoNormalizado)
          if (existente) {
            await query(`UPDATE productos SET categoria_id=$1,nombre=$2,descripcion=$3,codigo=$4,precio_venta=$5,precio_costo=$6,impuesto_pct=$7,impuesto_tipo=$8,impuesto_incluido=$9,unidad_medida=$10,destino=$11,disponible=$12,controla_stock=$13,stock_maximo=$14,eliminado_at=NULL,updated_at=NOW() WHERE id=$15 AND empresa_id=$16`, [producto.categoria_id || null,producto.nombre,producto.descripcion || null,producto.codigo,producto.precio_venta,producto.precio_costo || 0,producto.impuesto_pct || 0,producto.impuesto_tipo || 'iva',!!producto.impuesto_incluido,producto.unidad_medida || 'unidad',producto.destino || (tipoNegocio.includes('restaurante') ? 'cocina' : 'barra'),producto.disponible !== false,producto.controla_stock !== false,producto.stock_maximo || null,existente.id,eid])
            conservados.push(existente.id)
            actualizados += 1
          } else {
            const productoId = uuid()
            await query(`INSERT INTO productos (id,empresa_id,categoria_id,nombre,descripcion,codigo,precio_venta,precio_costo,impuesto_pct,impuesto_tipo,impuesto_incluido,tipo,unidad_medida,destino,imagen_url,disponible,controla_stock,stock_maximo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [productoId,eid,producto.categoria_id || null,producto.nombre,producto.descripcion || null,producto.codigo,producto.precio_venta,producto.precio_costo || 0,producto.impuesto_pct || 0,producto.impuesto_tipo || 'iva',!!producto.impuesto_incluido,producto.tipo || 'unidad',producto.unidad_medida || 'unidad',producto.destino || (tipoNegocio.includes('restaurante') ? 'cocina' : 'barra'),producto.imagen_url || null,producto.disponible !== false,producto.controla_stock !== false,producto.stock_maximo || null])
            if (producto.controla_stock !== false) await query(`INSERT INTO inventario (id,empresa_id,producto_id,stock_actual,stock_minimo) VALUES (gen_random_uuid(),$1,$2,$3,$4)`, [eid,productoId,producto.stock_inicial || 0,producto.stock_minimo || 0])
            conservados.push(productoId)
            creados += 1
      }
    }
    if (req.method === 'DELETE') {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : []
      if (!ids.length) return res.status(400).json({ ok: false, msg: 'Selecciona al menos un producto' })
      const eliminados = await query(`UPDATE productos SET disponible=false,eliminado_at=NOW(),updated_at=NOW() WHERE empresa_id=$1 AND id = ANY($2::uuid[]) AND eliminado_at IS NULL RETURNING id`, [eid, ids]) as any[]
      return res.status(200).json({ ok: true, data: { eliminados: eliminados.length } })
    }
        const deshabilitados = await query(`UPDATE productos SET disponible=false,eliminado_at=NOW(),updated_at=NOW() WHERE empresa_id=$1 AND eliminado_at IS NULL AND NOT (id = ANY($2::uuid[])) RETURNING id`, [eid, conservados]) as any[]
        return res.status(200).json({ ok: true, data: { creados, actualizados, retirados: deshabilitados.length } })
      }
      if (!nombre || precio_venta===undefined) return res.status(400).json({ ok: false, msg: 'Nombre y precio requeridos' })
      try {
        const pid=uuid()
        const [prod]=await query(
          `INSERT INTO productos (id,empresa_id,categoria_id,nombre,descripcion,codigo,precio_venta,precio_costo,impuesto_pct,impuesto_tipo,impuesto_incluido,tipo,unidad_medida,destino,imagen_url,disponible,controla_stock,stock_maximo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
          [pid,eid,categoria_id||null,nombre,descripcion||null,codigo||null,precio_venta,precio_costo||0,impuesto_pct||0,impuesto_tipo || 'iva',!!impuesto_incluido,tipo||'unidad',unidad_medida||'unidad',destino || (tipoNegocio.includes('restaurante') ? 'cocina' : 'barra'),imagen_url||null,disponible!==false,controla_stock!==false,stock_maximo || null])
        if (controla_stock!==false) {
          await query(`INSERT INTO inventario (id,empresa_id,producto_id,stock_actual,stock_minimo) VALUES (gen_random_uuid(),$1,$2,$3,$4)`, [eid,pid,stock_inicial||0,stock_minimo||0])
        }
        return res.status(201).json({ ok: true, data: prod })
      } catch(e: any) { return res.status(500).json({ ok: false, msg: e.message }) }
    }
  } else {
    const prod = await queryOne(`SELECT * FROM productos WHERE id=$1 AND empresa_id=$2`, [id,eid])
    if (!prod) return res.status(404).json({ ok: false, msg: 'No encontrado' })
    if (req.method === 'GET') return res.status(200).json({ ok: true, data: prod })
    if (req.method === 'PATCH') {
      const { nombre,precio_venta,precio_costo,disponible,categoria_id,descripcion,impuesto_pct,impuesto_tipo,impuesto_incluido,imagen_url,destino,tipo,unidad_medida,controla_stock,stock_maximo,codigo } = req.body||{}
      const [u]=await query(
        `UPDATE productos SET nombre=COALESCE($1,nombre),precio_venta=COALESCE($2,precio_venta),precio_costo=COALESCE($3,precio_costo),disponible=COALESCE($4,disponible),categoria_id=COALESCE($5,categoria_id),descripcion=COALESCE($6,descripcion),impuesto_pct=COALESCE($7,impuesto_pct),impuesto_tipo=COALESCE($8,impuesto_tipo),impuesto_incluido=COALESCE($9,impuesto_incluido),imagen_url=COALESCE($10,imagen_url),destino=COALESCE($11,destino),tipo=COALESCE($12,tipo),unidad_medida=COALESCE($13,unidad_medida),controla_stock=COALESCE($14,controla_stock),stock_maximo=COALESCE($15,stock_maximo),codigo=COALESCE($16,codigo),updated_at=NOW() WHERE id=$17 AND empresa_id=$18 RETURNING *`,
        [nombre,precio_venta,precio_costo,disponible,categoria_id,descripcion,impuesto_pct,impuesto_tipo,impuesto_incluido,imagen_url,destino,tipo,unidad_medida,controla_stock,stock_maximo,codigo,id,eid])
      return res.status(200).json({ ok: true, data: u })
    }
    if (req.method === 'DELETE') {
      await query(`UPDATE productos SET disponible=false,eliminado_at=NOW(),updated_at=NOW() WHERE id=$1 AND empresa_id=$2`, [id,eid])
      return res.status(200).json({ ok: true })
    }
  }
  return res.status(405).end()
}

