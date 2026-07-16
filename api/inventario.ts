import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let cajaSchemaReady: Promise<void> | null = null
function ensureCajaSchema() {
  if (!cajaSchemaReady) cajaSchemaReady = query(`ALTER TABLE cajas ADD COLUMN IF NOT EXISTS total_compras_inventario NUMERIC NOT NULL DEFAULT 0`).then(() => undefined)
  return cajaSchemaReady
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  await ensureCajaSchema()
  const eid = auth.empresa_id

  if (req.method==='GET') {
    const { critico,search,movimientos } = req.query||{}
    if (movimientos === 'true') {
      const rows = await query(
        `SELECT mi.created_at,p.nombre as producto,CASE WHEN mi.tipo='compra' THEN 'entrada' ELSE mi.tipo END as tipo,mi.cantidad,mi.stock_antes,mi.stock_despues,mi.notas,u.nombre as usuario
         FROM movimientos_inventario mi
         JOIN productos p ON p.id=mi.producto_id
         LEFT JOIN usuarios u ON u.id=mi.usuario_id
         WHERE mi.empresa_id=$1
         ORDER BY mi.created_at DESC
         LIMIT 500`,
        [eid]
      )
      return res.status(200).json({ ok:true, data:rows })
    }
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
         COALESCE(p.precio_venta,0) - COALESCE(p.precio_costo,0) as margen_unitario,
         COALESCE((SELECT SUM(mi.cantidad) FROM movimientos_inventario mi WHERE mi.empresa_id=p.empresa_id AND mi.producto_id=p.id AND mi.tipo IN ('entrada','compra') AND mi.created_at::date=CURRENT_DATE),0) as entradas_hoy,
         COALESCE((SELECT SUM(mi.cantidad) FROM movimientos_inventario mi WHERE mi.empresa_id=p.empresa_id AND mi.producto_id=p.id AND mi.tipo IN ('venta','salida','merma','rotura') AND mi.created_at::date=CURRENT_DATE),0) as salidas_hoy,
         (SELECT mi.created_at FROM movimientos_inventario mi WHERE mi.empresa_id=p.empresa_id AND mi.producto_id=p.id AND mi.tipo IN ('venta','salida','merma','rotura') ORDER BY mi.created_at DESC LIMIT 1) as ultima_salida_at
       FROM productos p
       LEFT JOIN inventario i ON i.producto_id=p.id AND i.empresa_id=p.empresa_id
       WHERE ${where}
       ORDER BY p.nombre`,params)
    return res.status(200).json({ ok:true, data:rows })
  }

  if (req.method==='POST') {
    const { producto_id,tipo: tipoRecibido,cantidad,notas,costo_unit,pagar_desde_caja,metodo_pago } = req.body||{}
    const tipo = tipoRecibido === 'compra' ? 'entrada' : tipoRecibido
    if (!producto_id||!tipo||cantidad===undefined) return res.status(400).json({ ok:false, msg:'Datos requeridos' })
    const producto = await queryOne(`SELECT nombre,precio_costo FROM productos WHERE id=$1 AND empresa_id=$2`, [producto_id,eid]) as any
    if (!producto) return res.status(404).json({ ok:false, msg:'Producto no encontrado' })
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
    if (tipo === 'entrada') despues=antes+q
    else if (['salida','merma','rotura','venta'].includes(tipo)) despues=Math.max(0,antes-q)
    else if (tipo==='ajuste') despues=q

    const costoFinal = costo_unit !== undefined && costo_unit !== null && costo_unit !== '' ? parseFloat(String(costo_unit)) || 0 : parseFloat(String(producto.precio_costo)) || 0
    const compraTotal = Math.abs(q) * costoFinal
    let cajaPago: any = null
    if (pagar_desde_caja) {
      if (tipo !== 'entrada') return res.status(400).json({ ok:false, msg:'Solo las entradas de producto pueden pagarse desde caja' })
      if (compraTotal <= 0) return res.status(400).json({ ok:false, msg:'Indica el costo unitario para registrar el pago desde caja' })
      cajaPago = await queryOne(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`, [eid])
      if (!cajaPago) return res.status(400).json({ ok:false, msg:'Abre la caja antes de pagar una compra de inventario' })
    }
    if (costo_unit !== undefined && costo_unit !== null && costo_unit !== '') {
      await query(`UPDATE productos SET precio_costo=$1,updated_at=NOW() WHERE id=$2 AND empresa_id=$3`, [costoFinal, producto_id, eid])
    }

    await query(`UPDATE inventario SET stock_actual=$1,updated_at=NOW() WHERE producto_id=$2 AND empresa_id=$3`,[despues,producto_id,eid])
    const notasFinal = pagar_desde_caja && tipo === 'entrada' ? `${notas ? `${notas} - ` : ''}Pagado desde caja` : notas || null
    await query(`INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues,costo_unit,notas) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9)`,[eid,producto_id,auth.id,tipo,Math.abs(q),antes,despues,costoFinal||null,notasFinal])

    if (cajaPago) {
      await query(`INSERT INTO caja_movimientos (id,empresa_id,caja_id,usuario_id,tipo,metodo_pago,monto,descripcion) VALUES (gen_random_uuid(),$1,$2,$3,'compra_inventario',$4,$5,$6)`, [eid,cajaPago.id,auth.id,metodo_pago || 'efectivo',compraTotal,`Compra inventario: ${producto.nombre}`])
      await query(`UPDATE cajas SET total_compras_inventario=total_compras_inventario+$1 WHERE id=$2`, [compraTotal,cajaPago.id])
    }
    return res.status(201).json({ ok:true, data:{producto_id,tipo,cantidad:q,stock_antes:antes,stock_despues:despues} })
  }
  return res.status(405).end()
}
