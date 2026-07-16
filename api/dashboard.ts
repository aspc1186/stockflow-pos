import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let pedidoSchemaReady: Promise<void> | null = null
function ensurePedidoSchema() {
  if (!pedidoSchemaReady) pedidoSchemaReady = query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS usuario_cierre_id UUID, ADD COLUMN IF NOT EXISTS mesero_id UUID`)
    .then(() => query(`ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS costo_unit NUMERIC`))
    .then(() => undefined)
  return pedidoSchemaReady
}

let cajaSchemaReady: Promise<void> | null = null
function ensureCajaSchema() {
  if (!cajaSchemaReady) cajaSchemaReady = query(`ALTER TABLE cajas ADD COLUMN IF NOT EXISTS total_compras_inventario NUMERIC NOT NULL DEFAULT 0`).then(() => undefined)
  return cajaSchemaReady
}

export default async function handler(req: any, res: any) {
  cors(res)
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  await Promise.all([ensurePedidoSchema(), ensureCajaSchema()])
  const eid = auth.empresa_id
  const urlPath = (req.url||'').split('?')[0]

  if (urlPath.includes('/arqueo')) {
    if (!['admin','supervisor','superadmin'].includes(auth.rol)) return res.status(403).json({ ok:false, msg:'Sin permisos' })
    try {
      const rows = await query(`
        SELECT u.id,u.nombre,u.username,COUNT(p.id) as ventas_precierre,COALESCE(SUM(p.total),0) as dinero_por_entregar
        FROM pedidos p
        JOIN usuarios u ON u.id=COALESCE(p.mesero_id,p.usuario_id)
        WHERE p.empresa_id=$1 AND p.estado='precierre'
        GROUP BY u.id,u.nombre,u.username
        ORDER BY dinero_por_entregar DESC
      `, [eid])
      return res.status(200).json({ ok:true, data:rows })
    } catch (e:any) { return res.status(500).json({ ok:false, msg:e.message }) }
  }

  // Reportes
  if (urlPath.includes('/reportes')) {
    const { desde, hasta, agrupacion='dia' } = req.query||{}
    const fd=desde||new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0]
    const fh=hasta||new Date().toISOString().split('T')[0]
    const fmtMap: any={dia:'YYYY-MM-DD',semana:'IYYY-IW',mes:'YYYY-MM'}
    const fmt=fmtMap[agrupacion]||'YYYY-MM-DD'
    try {
      const fechaVenta = "COALESCE(p.cierre_at,p.created_at)"
      const [vpp,tp,vm,vmesa,resumen]=await Promise.all([
        query(`SELECT TO_CHAR(${fechaVenta},'${fmt}') as periodo,COUNT(*) as pedidos,COALESCE(SUM(p.total),0) as total FROM pedidos p WHERE p.empresa_id=$1 AND p.estado='cobrado' AND ${fechaVenta}::date BETWEEN $2 AND $3 GROUP BY 1 ORDER BY 1`,[eid,fd,fh]),
        query(`SELECT pr.nombre,SUM(pi.cantidad) as unidades,SUM(pi.subtotal) as total FROM pedido_items pi JOIN productos pr ON pr.id=pi.producto_id JOIN pedidos p ON p.id=pi.pedido_id WHERE pi.empresa_id=$1 AND p.estado='cobrado' AND ${fechaVenta}::date BETWEEN $2 AND $3 GROUP BY pr.id,pr.nombre ORDER BY total DESC LIMIT 20`,[eid,fd,fh]),
        query(`SELECT u.nombre,COUNT(p.id) as pedidos,SUM(p.total) as total FROM pedidos p JOIN usuarios u ON u.id=COALESCE(p.mesero_id,p.usuario_id) WHERE p.empresa_id=$1 AND p.estado='cobrado' AND ${fechaVenta}::date BETWEEN $2 AND $3 GROUP BY u.id,u.nombre ORDER BY total DESC`,[eid,fd,fh]),
        query(`SELECT COALESCE(m.numero::text,'Sin mesa') as mesa,COUNT(p.id) as pedidos,SUM(p.total) as total FROM pedidos p LEFT JOIN mesas m ON m.id=p.mesa_id WHERE p.empresa_id=$1 AND p.estado='cobrado' AND ${fechaVenta}::date BETWEEN $2 AND $3 GROUP BY m.numero ORDER BY total DESC`,[eid,fd,fh]),
        queryOne(`SELECT COUNT(*) as total_pedidos,COALESCE(SUM(p.total),0) as total_ventas,COALESCE(AVG(p.total),0) as ticket_promedio FROM pedidos p WHERE p.empresa_id=$1 AND p.estado='cobrado' AND ${fechaVenta}::date BETWEEN $2 AND $3`,[eid,fd,fh]),
      ])
      return res.status(200).json({ ok:true, data:{periodo:{desde:fd,hasta:fh},resumen,ventas_por_periodo:vpp,top_productos:tp,ventas_por_mesero:vm,ventas_por_mesa:vmesa} })
    } catch(e: any) { return res.status(500).json({ ok:false, msg:e.message }) }
  }

  // Dashboard stats
  try {
    // Orders created before cierre_at existed must keep their original sale date.
    // updated_at is deliberately excluded because edits can move an old sale into today.
    const fechaVenta = "COALESCE(p.cierre_at,p.created_at)"
    const [vm2,utilidadMesData,pa,em,capacidades,ic,valorInventario,ca,utilidadDiaData,tp2,vph,ventasCaja]=await Promise.all([
      queryOne(`SELECT COALESCE(SUM(p.total),0) as total FROM pedidos p WHERE p.empresa_id=$1 AND p.estado='cobrado' AND DATE_TRUNC('month',${fechaVenta} AT TIME ZONE 'America/Bogota')=DATE_TRUNC('month',NOW() AT TIME ZONE 'America/Bogota')`,[eid]),
      queryOne(`SELECT COALESCE(SUM((pi.precio_unit-COALESCE(pi.costo_unit,mi.costo_unit,pr.precio_costo,0))*pi.cantidad),0) as utilidad,COALESCE(SUM(pi.precio_unit*pi.cantidad),0) as ventas FROM pedido_items pi JOIN pedidos p ON p.id=pi.pedido_id JOIN productos pr ON pr.id=pi.producto_id LEFT JOIN LATERAL (SELECT costo_unit FROM movimientos_inventario mi WHERE mi.empresa_id=p.empresa_id AND mi.producto_id=pi.producto_id AND mi.tipo='venta' AND mi.notas=CONCAT('Pedido ',p.id) ORDER BY mi.created_at ASC LIMIT 1) mi ON true WHERE p.empresa_id=$1 AND p.estado='cobrado' AND pi.estado!='cancelado' AND DATE_TRUNC('month',${fechaVenta} AT TIME ZONE 'America/Bogota')=DATE_TRUNC('month',NOW() AT TIME ZONE 'America/Bogota')`,[eid]),
      queryOne(`SELECT COUNT(*) as total FROM pedidos WHERE empresa_id=$1 AND estado IN ('abierto','en_preparacion','listo','precierre')`,[eid]),
      query(`SELECT estado,COUNT(*) as total FROM mesas WHERE empresa_id=$1 AND activa=true GROUP BY estado`,[eid]),
      queryOne(`SELECT COALESCE(SUM(capacidad),0) as total,COALESCE(SUM(CASE WHEN estado IN ('ocupada','reservada') THEN capacidad ELSE 0 END),0) as ocupada FROM mesas WHERE empresa_id=$1 AND activa=true`,[eid]),
      queryOne(`SELECT COUNT(*) as total FROM inventario WHERE empresa_id=$1 AND stock_actual<=stock_minimo AND stock_minimo>0`,[eid]),
      queryOne(`SELECT COALESCE(SUM(i.stock_actual * p.precio_costo),0) as total FROM inventario i JOIN productos p ON p.id=i.producto_id AND p.empresa_id=i.empresa_id WHERE i.empresa_id=$1`,[eid]),
      queryOne(`SELECT id,saldo_inicial,total_ventas,total_ingresos,total_egresos,total_compras_inventario FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`,[eid]),
      queryOne(`SELECT COALESCE(SUM((pi.precio_unit-COALESCE(pi.costo_unit,mi.costo_unit,pr.precio_costo,0))*pi.cantidad),0) as utilidad,COALESCE(SUM(pi.precio_unit*pi.cantidad),0) as ventas FROM pedido_items pi JOIN pedidos p ON p.id=pi.pedido_id JOIN productos pr ON pr.id=pi.producto_id LEFT JOIN LATERAL (SELECT costo_unit FROM movimientos_inventario mi WHERE mi.empresa_id=p.empresa_id AND mi.producto_id=pi.producto_id AND mi.tipo='venta' AND mi.notas=CONCAT('Pedido ',p.id) ORDER BY mi.created_at ASC LIMIT 1) mi ON true WHERE p.empresa_id=$1 AND p.estado='cobrado' AND pi.estado!='cancelado' AND (${fechaVenta} AT TIME ZONE 'America/Bogota')::date=(NOW() AT TIME ZONE 'America/Bogota')::date`,[eid]),
      query(`SELECT pr.nombre,SUM(pi.cantidad) as total FROM pedido_items pi JOIN productos pr ON pr.id=pi.producto_id JOIN pedidos p ON p.id=pi.pedido_id JOIN caja_movimientos cm ON cm.pedido_id=p.id AND cm.empresa_id=p.empresa_id JOIN cajas c ON c.id=cm.caja_id AND c.estado='abierta' WHERE p.empresa_id=$1 AND p.estado='cobrado' AND cm.tipo='venta' GROUP BY pr.id,pr.nombre ORDER BY total DESC LIMIT 8`,[eid]),
      query(`SELECT TO_CHAR(cm.created_at AT TIME ZONE 'America/Bogota','HH24:00') as hora,COALESCE(SUM(cm.monto),0) as total FROM caja_movimientos cm JOIN cajas c ON c.id=cm.caja_id AND c.estado='abierta' WHERE cm.empresa_id=$1 AND cm.tipo='venta' GROUP BY hora ORDER BY hora`,[eid]),
      queryOne(`SELECT COUNT(cm.id) as cantidad FROM caja_movimientos cm JOIN cajas c ON c.id=cm.caja_id AND c.estado='abierta' WHERE cm.empresa_id=$1 AND cm.tipo='venta'`,[eid]),
    ])
    const mp=em.reduce((a: any,r: any)=>{a[r.estado]=parseInt(r.total);return a},{})
    const caja=ca?parseFloat(ca.saldo_inicial)+parseFloat(ca.total_ventas)+parseFloat(ca.total_ingresos)-parseFloat(ca.total_egresos)-parseFloat((ca as any).total_compras_inventario || 0):0
    const ventasDia = parseFloat((ca as any)?.total_ventas??'0')
    const ventasMes = parseFloat((vm2 as any)?.total??'0')
    const ventasUtilidadDia = parseFloat((utilidadDiaData as any)?.ventas??'0')
    const ventasUtilidadMes = parseFloat((utilidadMesData as any)?.ventas??'0')
    const utilidadDia = parseFloat((utilidadDiaData as any)?.utilidad??'0')
    const utilidadMes = parseFloat((utilidadMesData as any)?.utilidad??'0')
    return res.status(200).json({ ok:true, data:{
      ventas_hoy:ventasDia,
      ventas_confirmadas:parseInt((ventasCaja as any)?.cantidad??'0'),
      ventas_mes:ventasMes,
      utilidad_dia:utilidadDia,
      margen_dia:ventasUtilidadDia > 0 ? utilidadDia / ventasUtilidadDia * 100 : 0,
      utilidad_mes:utilidadMes,
      margen_mes:ventasUtilidadMes > 0 ? utilidadMes / ventasUtilidadMes * 100 : 0,
      pedidos_activos:parseInt((pa as any)?.total??'0'),
      mesas_ocupadas:(mp['ocupada']??0)+(mp['reservada']??0),
      mesas_libres:mp['libre']??0,
      capacidad_total:parseInt((capacidades as any)?.total??'0'),
      capacidad_ocupada:parseInt((capacidades as any)?.ocupada??'0'),
      inventario_critico:parseInt((ic as any)?.total??'0'),
      valor_inventario:parseFloat((valorInventario as any)?.total??'0'),
      caja_actual:caja,
      productos_mas_vendidos:tp2.map((r: any)=>({nombre:r.nombre,total:parseFloat(r.total)})),
      ventas_por_hora:vph.map((r: any)=>({hora:r.hora,total:parseFloat(r.total)}))
    }})
  } catch(e: any) { return res.status(500).json({ ok:false, msg:e.message }) }
}
