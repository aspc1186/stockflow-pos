import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let cajaSchemaReady: Promise<void> | null = null
function ensureCajaSchema() {
  if (!cajaSchemaReady) cajaSchemaReady = query(`ALTER TABLE cajas ADD COLUMN IF NOT EXISTS total_compras_inventario NUMERIC NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS total_compras_no_inventario NUMERIC NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS fecha_operativa DATE`)
    .then(() => query(`UPDATE cajas SET fecha_operativa=(apertura_at AT TIME ZONE 'America/Bogota')::date WHERE fecha_operativa IS NULL`))
    .then(() => query(`CREATE TABLE IF NOT EXISTS caja_movimientos_correcciones (id UUID PRIMARY KEY, empresa_id UUID NOT NULL, caja_movimiento_id UUID NOT NULL, superadmin_id UUID NOT NULL, accion VARCHAR(20) NOT NULL, anterior JSONB, nuevo JSONB, motivo TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`))
    .then(() => undefined)
  return cajaSchemaReady
}

const TIPOS_MANUALES = ['ingreso', 'egreso', 'compra_no_inventario']

async function recalcularCaja(cajaId: string) {
  const caja = await queryOne(`SELECT id,saldo_inicial,estado FROM cajas WHERE id=$1`, [cajaId]) as any
  if (!caja) return
  const totales = await queryOne(`
    SELECT COALESCE(SUM(CASE WHEN tipo='venta' THEN monto ELSE 0 END),0) as ventas,
      COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END),0) as ingresos,
      COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END),0) as egresos,
      COALESCE(SUM(CASE WHEN tipo='compra_inventario' THEN monto ELSE 0 END),0) as compras_inventario,
      COALESCE(SUM(CASE WHEN tipo='compra_no_inventario' THEN monto ELSE 0 END),0) as compras_no_inventario
    FROM caja_movimientos WHERE caja_id=$1`, [cajaId]) as any
  const ventas = Number(totales?.ventas || 0), ingresos = Number(totales?.ingresos || 0), egresos = Number(totales?.egresos || 0)
  const comprasInventario = Number(totales?.compras_inventario || 0), comprasNoInventario = Number(totales?.compras_no_inventario || 0)
  const saldoFinal = Number(caja.saldo_inicial || 0) + ventas + ingresos - egresos - comprasInventario - comprasNoInventario
  await query(`UPDATE cajas SET total_ventas=$1,total_ingresos=$2,total_egresos=$3,total_compras_inventario=$4,total_compras_no_inventario=$5,saldo_final=CASE WHEN estado='cerrada' THEN $6 ELSE saldo_final END WHERE id=$7`, [ventas, ingresos, egresos, comprasInventario, comprasNoInventario, saldoFinal, cajaId])
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
    const jornadasMes=await query(`
      SELECT c.*,u.nombre as cajero_nombre
      FROM cajas c
      LEFT JOIN usuarios u ON u.id=c.usuario_id
      WHERE c.empresa_id=$1
        AND DATE_TRUNC('month',COALESCE(c.fecha_operativa,(c.apertura_at AT TIME ZONE 'America/Bogota')::date))=DATE_TRUNC('month',(NOW() AT TIME ZONE 'America/Bogota')::date)
      ORDER BY c.apertura_at DESC
      LIMIT 100`, [eid])
    const movimientosCierresMes=await query(`
      SELECT cm.*,u.nombre as usuario_nombre,c.fecha_operativa,c.cierre_at,c.saldo_final
      FROM caja_movimientos cm
      JOIN cajas c ON c.id=cm.caja_id
      LEFT JOIN usuarios u ON u.id=cm.usuario_id
      WHERE c.empresa_id=$1 AND c.estado='cerrada'
        AND DATE_TRUNC('month',COALESCE(c.fecha_operativa,(c.apertura_at AT TIME ZONE 'America/Bogota')::date))=DATE_TRUNC('month',(NOW() AT TIME ZONE 'America/Bogota')::date)
      ORDER BY c.cierre_at DESC NULLS LAST,cm.created_at DESC
      LIMIT 1000`, [eid])
    return res.status(200).json({ ok:true, data:{caja,movimientos:movs,ultimo_cierre:ultimoCierre,movimientos_ultimo_cierre:movimientosUltimoCierre,cierres,jornadas_mes:jornadasMes,movimientos_cierres_mes:movimientosCierresMes} })
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
  if (req.method === 'PATCH' || req.method === 'DELETE') {
    if (!auth.modo_soporte) return res.status(403).json({ ok:false, msg:'Solo el superadministrador en modo soporte puede corregir movimientos de caja' })
    const { movimiento_id, tipo, metodo_pago, monto, descripcion, motivo } = req.body || {}
    if (!movimiento_id) return res.status(400).json({ ok:false, msg:'Movimiento requerido' })
    if (!String(motivo || '').trim()) return res.status(400).json({ ok:false, msg:'Indica el motivo de la correccion para conservar la trazabilidad' })
    const movimiento = await queryOne(`SELECT cm.* FROM caja_movimientos cm WHERE cm.id=$1 AND cm.empresa_id=$2`, [movimiento_id, eid]) as any
    if (!movimiento) return res.status(404).json({ ok:false, msg:'Movimiento no encontrado' })
    if (!TIPOS_MANUALES.includes(movimiento.tipo)) return res.status(400).json({ ok:false, msg:'Las ventas y compras de inventario se corrigen desde su modulo de origen para no romper la trazabilidad' })

    const anterior = { tipo: movimiento.tipo, metodo_pago: movimiento.metodo_pago, monto: movimiento.monto, descripcion: movimiento.descripcion }
    if (req.method === 'PATCH') {
      if (!TIPOS_MANUALES.includes(String(tipo || ''))) return res.status(400).json({ ok:false, msg:'Tipo de movimiento no permitido' })
      const valor = Number(monto)
      if (!Number.isFinite(valor) || valor <= 0) return res.status(400).json({ ok:false, msg:'El monto debe ser mayor que cero' })
      if (!String(descripcion || '').trim()) return res.status(400).json({ ok:false, msg:'La descripcion es requerida' })
      const nuevo = { tipo, metodo_pago: metodo_pago || 'efectivo', monto: valor, descripcion: String(descripcion).trim() }
      const [actualizado] = await query(`UPDATE caja_movimientos SET tipo=$1,metodo_pago=$2,monto=$3,descripcion=$4 WHERE id=$5 RETURNING *`, [nuevo.tipo, nuevo.metodo_pago, nuevo.monto, nuevo.descripcion, movimiento.id])
      await query(`INSERT INTO caja_movimientos_correcciones (id,empresa_id,caja_movimiento_id,superadmin_id,accion,anterior,nuevo,motivo) VALUES ($1,$2,$3,$4,'edicion',$5::jsonb,$6::jsonb,$7)`, [uuid(), eid, movimiento.id, auth.soporte_superadmin_id || auth.id, JSON.stringify(anterior), JSON.stringify(nuevo), String(motivo).trim()])
      await recalcularCaja(movimiento.caja_id)
      return res.status(200).json({ ok:true, data: actualizado })
    }

    await query(`DELETE FROM caja_movimientos WHERE id=$1`, [movimiento.id])
    await query(`INSERT INTO caja_movimientos_correcciones (id,empresa_id,caja_movimiento_id,superadmin_id,accion,anterior,nuevo,motivo) VALUES ($1,$2,$3,$4,'eliminacion',$5::jsonb,NULL,$6)`, [uuid(), eid, movimiento.id, auth.soporte_superadmin_id || auth.id, JSON.stringify(anterior), String(motivo).trim()])
    await recalcularCaja(movimiento.caja_id)
    return res.status(200).json({ ok:true })
  }
  return res.status(405).end()
}
