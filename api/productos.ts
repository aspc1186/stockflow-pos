import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  const parts = (req.url||'').split('?')[0].split('/').filter(Boolean)
  const id = parts[2] || null

  if (!id) {
    if (req.method === 'GET') {
      const { disponible, search, categoria_id } = req.query||{}
      let where = `p.empresa_id=$1`; const params: any[]=[eid]; let idx=2
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
      const { categoria_id,nombre,descripcion,codigo,precio_venta,precio_costo,impuesto_pct,tipo,unidad_medida,destino,imagen_url,disponible,controla_stock,stock_inicial,stock_minimo } = req.body||{}
      if (!nombre || precio_venta===undefined) return res.status(400).json({ ok: false, msg: 'Nombre y precio requeridos' })
      try {
        const pid=uuid()
        const [prod]=await query(
          `INSERT INTO productos (id,empresa_id,categoria_id,nombre,descripcion,codigo,precio_venta,precio_costo,impuesto_pct,tipo,unidad_medida,destino,imagen_url,disponible,controla_stock)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
          [pid,eid,categoria_id||null,nombre,descripcion||null,codigo||null,precio_venta,precio_costo||0,impuesto_pct||0,tipo||'unidad',unidad_medida||'unidad',destino||'barra',imagen_url||null,disponible!==false,controla_stock!==false])
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
      const { nombre,precio_venta,precio_costo,disponible,categoria_id,descripcion,impuesto_pct,imagen_url,destino,tipo } = req.body||{}
      const [u]=await query(
        `UPDATE productos SET nombre=COALESCE($1,nombre),precio_venta=COALESCE($2,precio_venta),precio_costo=COALESCE($3,precio_costo),disponible=COALESCE($4,disponible),categoria_id=COALESCE($5,categoria_id),descripcion=COALESCE($6,descripcion),impuesto_pct=COALESCE($7,impuesto_pct),imagen_url=COALESCE($8,imagen_url),destino=COALESCE($9,destino),tipo=COALESCE($10,tipo),updated_at=NOW() WHERE id=$11 AND empresa_id=$12 RETURNING *`,
        [nombre,precio_venta,precio_costo,disponible,categoria_id,descripcion,impuesto_pct,imagen_url,destino,tipo,id,eid])
      return res.status(200).json({ ok: true, data: u })
    }
    if (req.method === 'DELETE') {
      await query(`UPDATE productos SET disponible=false WHERE id=$1 AND empresa_id=$2`, [id,eid])
      return res.status(200).json({ ok: true })
    }
  }
  return res.status(405).end()
}
