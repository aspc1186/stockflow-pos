const { v4: uuid } = require('uuid')
const { query, queryOne } = require('../_db')
const { authenticate, cors } = require('../_auth')

module.exports = async function(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id

  if (req.method==='GET') {
    const caja=await queryOne(`SELECT c.*,u.nombre as cajero_nombre FROM cajas c LEFT JOIN usuarios u ON u.id=c.usuario_id WHERE c.empresa_id=$1 AND c.estado='abierta' ORDER BY c.apertura_at DESC LIMIT 1`,[eid])
    const movs=caja?await query(`SELECT cm.*,u.nombre as usuario_nombre FROM caja_movimientos cm LEFT JOIN usuarios u ON u.id=cm.usuario_id WHERE cm.caja_id=$1 ORDER BY cm.created_at DESC LIMIT 100`,[(caja as any).id]):[]
    return res.status(200).json({ ok:true, data:{caja,movimientos:movs} })
  }
  if (req.method==='POST') {
    const { accion,saldo_inicial,tipo,metodo_pago,monto,descripcion,pedido_id,notas } = req.body||{}
    if (accion==='abrir') {
      const existe=await queryOne(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta'`,[eid])
      if (existe) return res.status(400).json({ ok:false, msg:'Ya hay una caja abierta' })
      const [c]=await query(`INSERT INTO cajas (id,empresa_id,usuario_id,saldo_inicial,estado,total_ventas,total_ingresos,total_egresos) VALUES ($1,$2,$3,$4,'abierta',0,0,0) RETURNING *`,[uuid(),eid,auth.id,saldo_inicial||0])
      return res.status(201).json({ ok:true, data:c })
    }
    if (accion==='movimiento') {
      const caja=await queryOne(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`,[eid]) as any
      if (!caja) return res.status(400).json({ ok:false, msg:'Sin caja abierta' })
      const [m]=await query(`INSERT INTO caja_movimientos (id,empresa_id,caja_id,usuario_id,pedido_id,tipo,metodo_pago,monto,descripcion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[uuid(),eid,caja.id,auth.id,pedido_id||null,tipo||'ingreso',metodo_pago||'efectivo',monto,descripcion||null])
      return res.status(201).json({ ok:true, data:m })
    }
    if (accion==='cerrar') {
      const caja=await queryOne(`SELECT * FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`,[eid]) as any
      if (!caja) return res.status(400).json({ ok:false, msg:'Sin caja abierta' })
      const sf=parseFloat(caja.saldo_inicial)+parseFloat(caja.total_ventas)+parseFloat(caja.total_ingresos)-parseFloat(caja.total_egresos)
      const [u]=await query(`UPDATE cajas SET estado='cerrada',saldo_final=$1,cierre_at=NOW(),notas=$2 WHERE id=$3 RETURNING *`,[sf,notas||null,caja.id])
      return res.status(200).json({ ok:true, data:u })
    }
    return res.status(400).json({ ok:false, msg:'Acción no válida. Use: abrir, movimiento, cerrar' })
  }
  return res.status(405).end()
}

export {}
