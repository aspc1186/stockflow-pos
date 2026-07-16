import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let cajaSchemaReady: Promise<void> | null = null
function ensureCajaSchema() {
  if (!cajaSchemaReady) cajaSchemaReady = query(`ALTER TABLE cajas ADD COLUMN IF NOT EXISTS total_compras_inventario NUMERIC NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS total_compras_no_inventario NUMERIC NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS fecha_operativa DATE`)
    .then(() => query(`UPDATE cajas SET fecha_operativa=(apertura_at AT TIME ZONE 'America/Bogota')::date WHERE fecha_operativa IS NULL`))
    .then(() => undefined)
  return cajaSchemaReady
}

export default async function handler(req: any, res: any) {
  cors(res)
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  await ensureCajaSchema()
  const eid = auth.empresa_id

  if (req.method==='GET') {
    const caja=await queryOne(`SELECT c.*,u.nombre as cajero_nombre FROM cajas c LEFT JOIN usuarios u ON u.id=c.usuario_id WHERE c.empresa_id=$1 AND c.estado='abierta' ORDER BY c.apertura_at DESC LIMIT 1`,[eid])
    const movs=caja?await query(`SELECT cm.*,u.nombre as usuario_nombre FROM caja_movimientos cm LEFT JOIN usuarios u ON u.id=cm.usuario_id WHERE cm.caja_id=$1 ORDER BY cm.created_at DESC LIMIT 100`,[(caja as any).id]):[]
    const ultimoCierre=await queryOne(`SELECT c.*,u.nombre as cajero_nombre FROM cajas c LEFT JOIN usuarios u ON u.id=c.usuario_id WHERE c.empresa_id=$1 AND c.estado='cerrada' ORDER BY c.cierre_at DESC NULLS LAST LIMIT 1`,[eid])
    const movimientosUltimoCierre=ultimoCierre ? await query(`SELECT cm.*,u.nombre as usuario_nombre FROM caja_movimientos cm LEFT JOIN usuarios u ON u.id=cm.usuario_id WHERE cm.caja_id=$1 ORDER BY cm.created_at DESC LIMIT 200`, [(ultimoCierre as any).id]) : []
    const cierres=await query(`SELECT c.*,u.nombre as cajero_nombre FROM cajas c LEFT JOIN usuarios u ON u.id=c.usuario_id WHERE c.empresa_id=$1 AND c.estado='cerrada' ORDER BY c.cierre_at DESC NULLS LAST LIMIT 20`, [eid])
    return res.status(200).json({ ok:true, data:{caja,movimientos:movs,ultimo_cierre:ultimoCierre,movimientos_ultimo_cierre:movimientosUltimoCierre,cierres} })
  }
  if (req.method==='POST') {
    const { accion,saldo_inicial,tipo,metodo_pago,monto,descripcion,pedido_id,notas } = req.body||{}
    if (accion==='abrir') {
      const existe=await queryOne(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta'`,[eid])
      if (existe) return res.status(400).json({ ok:false, msg:'Ya hay una caja abierta' })
      const [c]=await query(`INSERT INTO cajas (id,empresa_id,usuario_id,saldo_inicial,estado,total_ventas,total_ingresos,total_egresos,total_compras_inventario,total_compras_no_inventario,fecha_operativa) VALUES ($1,$2,$3,$4,'abierta',0,0,0,0,0,(NOW() AT TIME ZONE 'America/Bogota')::date) RETURNING *`,[uuid(),eid,auth.id,saldo_inicial||0])
      return res.status(201).json({ ok:true, data:c })
    }
    if (accion==='movimiento') {
      if (!['ingreso','egreso','compra_no_inventario'].includes(tipo)) return res.status(400).json({ ok:false, msg:'Tipo de movimiento no permitido' })
      if (!String(descripcion || '').trim()) return res.status(400).json({ ok:false, msg:'Describe el ingreso o gasto para conservar la trazabilidad' })
      const caja=await queryOne(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`,[eid]) as any
      if (!caja) return res.status(400).json({ ok:false, msg:'Sin caja abierta' })
      const [m]=await query(`INSERT INTO caja_movimientos (id,empresa_id,caja_id,usuario_id,pedido_id,tipo,metodo_pago,monto,descripcion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[uuid(),eid,caja.id,auth.id,pedido_id||null,tipo||'ingreso',metodo_pago||'efectivo',monto,descripcion||null])
      const campo = tipo === 'ingreso' ? 'total_ingresos' : tipo === 'compra_no_inventario' ? 'total_compras_no_inventario' : 'total_egresos'
      await query(`UPDATE cajas SET ${campo}=${campo}+$1 WHERE id=$2`, [parseFloat(String(monto)) || 0, caja.id])
      return res.status(201).json({ ok:true, data:m })
    }
    if (accion==='cerrar') {
      const caja=await queryOne(`SELECT * FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`,[eid]) as any
      if (!caja) return res.status(400).json({ ok:false, msg:'Sin caja abierta' })
      const pedidosActivos=await queryOne(`SELECT COUNT(*) as total FROM pedidos WHERE empresa_id=$1 AND estado IN ('abierto','en_preparacion','listo','precierre')`,[eid]) as any
      if (parseInt(pedidosActivos?.total || '0') > 0) return res.status(400).json({ ok:false, msg:'No puedes cerrar caja mientras existan pedidos activos' })
      const sf=parseFloat(caja.saldo_inicial)+parseFloat(caja.total_ventas)+parseFloat(caja.total_ingresos)-parseFloat(caja.total_egresos)-parseFloat(caja.total_compras_inventario || 0)-parseFloat(caja.total_compras_no_inventario || 0)
      const [u]=await query(`UPDATE cajas SET estado='cerrada',saldo_final=$1,cierre_at=NOW(),notas=$2 WHERE id=$3 RETURNING *`,[sf,notas||null,caja.id])
      return res.status(200).json({ ok:true, data:u })
    }
    return res.status(400).json({ ok:false, msg:'Acción no válida. Use: abrir, movimiento, cerrar' })
  }
  return res.status(405).end()
}
