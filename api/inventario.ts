import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id

  if (req.method==='GET') {
    const { critico,search,detalle } = req.query||{}
    let where=`p.empresa_id=$1 AND COALESCE(p.controla_stock,true)=true`; const params: any[]=[eid]; let idx=2
    if (critico==='true') where+=` AND COALESCE(i.stock_actual,0)<=COALESCE(i.stock_minimo,0) AND COALESCE(i.stock_minimo,0)>0`
    if (search) { where+=` AND p.nombre ILIKE $${idx++}`; params.push(`%${search}%`) }
    const rows=await query(
      `SELECT
         p.id as producto_id,
         p.nombre as producto_nombre,
         p.codigo,
         p.tipo,
         p.precio_costo,
         p.precio_venta,
         COALESCE(i.stock_actual,0) as stock_actual,
         COALESCE(i.stock_minimo,0) as stock_minimo,
         COALESCE(i.stock_actual,0) * COALESCE(p.precio_costo,0) as valor_costo,
         COALESCE(i.stock_actual,0) * COALESCE(p.precio_venta,0) as valor_venta,
         COALESCE(p.precio_venta,0) - COALESCE(p.precio_costo,0) as margen_unitario
       FROM productos p
       LEFT JOIN inventario i ON i.producto_id=p.id AND i.empresa_id=p.empresa_id
       WHERE ${where}
       ORDER BY p.nombre`,params)
    if (detalle === 'true') {
      const movimientos = await query(
        `SELECT mi.*,p.nombre as producto_nombre,u.nombre as usuario_nombre
         FROM movimientos_inventario mi
         JOIN productos p ON p.id=mi.producto_id
         LEFT JOIN usuarios u ON u.id=mi.usuario_id
         WHERE mi.empresa_id=$1
         ORDER BY mi.created_at DESC
         LIMIT 100`,
        [eid]
      )
      return res.status(200).json({ ok:true, data:{productos:rows,movimientos} })
    }
    return res.status(200).json({ ok:true, data:rows })
  }

  if (req.method==='POST') {
    const { producto_id,tipo,cantidad,notas,costo_unit } = req.body||{}
    if (!producto_id||!tipo||cantidad===undefined) return res.status(400).json({ ok:false, msg:'Datos requeridos' })
    let inv=await queryOne(`SELECT stock_actual FROM inventario WHERE producto_id=$1 AND empresa_id=$2`,[producto_id,eid]) as any
    if (!inv) {
      await query(
        `INSERT INTO inventario (id,empresa_id,producto_id,stock_actual,stock_minimo)
         VALUES (gen_random_uuid(),$1,$2,0,0)`,
        [eid, producto_id]
      )
      inv = { stock_actual: 0 }
    }
    const q=parseFloat(String(cantidad))||0; const antes=parseFloat(String(inv.stock_actual))||0; let despues=antes
    if (['entrada','compra'].includes(tipo)) despues=antes+q
    else if (['salida','merma','rotura','venta'].includes(tipo)) despues=Math.max(0,antes-q)
    else if (tipo==='ajuste') despues=q

    if (costo_unit !== undefined && costo_unit !== null && costo_unit !== '') {
      await query(`UPDATE productos SET precio_costo=$1,updated_at=NOW() WHERE id=$2 AND empresa_id=$3`, [parseFloat(String(costo_unit))||0, producto_id, eid])
    }

    await query(`UPDATE inventario SET stock_actual=$1,updated_at=NOW() WHERE producto_id=$2 AND empresa_id=$3`,[despues,producto_id,eid])
    await query(`INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues,costo_unit,notas) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9)`,[eid,producto_id,auth.id,tipo,Math.abs(q),antes,despues,costo_unit||null,notas||null])
    return res.status(201).json({ ok:true, data:{producto_id,tipo,cantidad:q,stock_antes:antes,stock_despues:despues} })
  }
  return res.status(405).end()
}
