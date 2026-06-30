import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query, queryOne } from '../_db'
import { v4 as uuid } from 'uuid'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  if (req.method === 'GET') {
    const caja = await queryOne(`SELECT c.*,u.nombre as cajero_nombre FROM cajas c LEFT JOIN usuarios u ON u.id=c.usuario_id WHERE c.empresa_id=$1 AND c.estado='abierta' ORDER BY c.apertura_at DESC LIMIT 1`,[eid])
    const movs = caja ? await query(`SELECT cm.*,u.nombre as usuario_nombre FROM caja_movimientos cm LEFT JOIN usuarios u ON u.id=cm.usuario_id WHERE cm.caja_id=$1 ORDER BY cm.created_at DESC LIMIT 50`,[(caja as any).id]) : []
    return res.status(200).json({success:true,data:{caja,movimientos:movs}})
  }
  if (req.method === 'POST') {
    const { accion,saldo_inicial,tipo,metodo_pago,monto,descripcion,pedido_id,notas } = req.body ?? {}
    if (accion==='abrir') {
      if (!['admin','cajero','supervisor'].includes(auth.rol)) return res.status(403).json({success:false,message:'Sin permisos'})
      const existe = await queryOne(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta'`,[eid])
      if (existe) return res.status(400).json({success:false,message:'Ya hay caja abierta'})
      const [c]=await query(`INSERT INTO cajas (id,empresa_id,usuario_id,saldo_inicial,estado) VALUES ($1,$2,$3,$4,'abierta') RETURNING *`,[uuid(),eid,auth.id,saldo_inicial||0])
      return res.status(201).json({success:true,data:c})
    }
    if (accion==='movimiento') {
      const caja = await queryOne<any>(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`,[eid])
      if (!caja) return res.status(400).json({success:false,message:'Sin caja abierta'})
      const [m]=await query(`INSERT INTO caja_movimientos (id,empresa_id,caja_id,usuario_id,pedido_id,tipo,metodo_pago,monto,descripcion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[uuid(),eid,caja.id,auth.id,pedido_id||null,tipo||'ingreso',metodo_pago||'efectivo',monto,descripcion||null])
      await query(`UPDATE cajas SET total_ventas=(SELECT COALESCE(SUM(monto),0) FROM caja_movimientos WHERE caja_id=$1 AND tipo='venta'),total_ingresos=(SELECT COALESCE(SUM(monto),0) FROM caja_movimientos WHERE caja_id=$1 AND tipo='ingreso'),total_egresos=(SELECT COALESCE(SUM(monto),0) FROM caja_movimientos WHERE caja_id=$1 AND tipo='egreso') WHERE id=$1`,[caja.id])
      return res.status(201).json({success:true,data:m})
    }
    if (accion==='cerrar') {
      if (!['admin','cajero','supervisor'].includes(auth.rol)) return res.status(403).json({success:false,message:'Sin permisos'})
      const caja = await queryOne<any>(`SELECT * FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`,[eid])
      if (!caja) return res.status(400).json({success:false,message:'Sin caja abierta'})
      const sf=caja.saldo_inicial+caja.total_ventas+caja.total_ingresos-caja.total_egresos
      const [u]=await query(`UPDATE cajas SET estado='cerrada',saldo_final=$1,cierre_at=NOW(),notas=$2 WHERE id=$3 RETURNING *`,[sf,notas||null,caja.id])
      return res.status(200).json({success:true,data:u})
    }
    return res.status(400).json({success:false,message:'Acción no válida'})
  }
  return res.status(405).end()
}
