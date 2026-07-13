import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let mesasSchemaReady: Promise<void> | null = null

function ensureMesasSchema() {
  if (!mesasSchemaReady) mesasSchemaReady = query(`ALTER TABLE mesas ADD COLUMN IF NOT EXISTS mesero_id UUID`).then(() => undefined)
  return mesasSchemaReady
}

function puedeAdministrarPedidos(rol: string) {
  return ['admin', 'supervisor', 'superadmin'].includes(rol)
}

async function puedeAccederMesa(empresaId: string, mesaId: string, auth: any) {
  const mesa = await queryOne(`SELECT mesero_id FROM mesas WHERE id=$1 AND empresa_id=$2 AND activa=true`, [mesaId, empresaId]) as any
  return !!mesa && (puedeAdministrarPedidos(auth.rol) || mesa.mesero_id === auth.id)
}

async function moverInventario(empresaId: string, productoId: string, usuarioId: string, cantidad: any, tipo: 'venta' | 'devolucion', notas: string) {
  const q = Math.abs(parseFloat(String(cantidad)) || 0)
  if (!q) return

  const prod = await queryOne(
    `SELECT id,precio_costo,controla_stock FROM productos WHERE id=$1 AND empresa_id=$2`,
    [productoId, empresaId]
  ) as any
  if (!prod || prod.controla_stock === false) return

  let inv = await queryOne(
    `SELECT stock_actual FROM inventario WHERE producto_id=$1 AND empresa_id=$2`,
    [productoId, empresaId]
  ) as any

  if (!inv) {
    await query(
      `INSERT INTO inventario (id,empresa_id,producto_id,stock_actual,stock_minimo)
       VALUES (gen_random_uuid(),$1,$2,0,0)`,
      [empresaId, productoId]
    )
    inv = { stock_actual: 0 }
  }

  const antes = parseFloat(String(inv.stock_actual)) || 0
  const despues = tipo === 'venta' ? Math.max(0, antes - q) : antes + q

  await query(
    `UPDATE inventario SET stock_actual=$1,updated_at=NOW() WHERE producto_id=$2 AND empresa_id=$3`,
    [despues, productoId, empresaId]
  )
  await query(
    `INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues,costo_unit,notas)
     VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [empresaId, productoId, usuarioId, tipo, q, antes, despues, prod.precio_costo || 0, notas]
  )
}

async function recalcularPedido(pedidoId: string) {
  const totales = await queryOne(
    `SELECT COALESCE(SUM(subtotal),0) as s,COALESCE(SUM(subtotal*impuesto_pct/100),0) as i
     FROM pedido_items WHERE pedido_id=$1 AND estado!='cancelado'`,
    [pedidoId]
  ) as any
  const s = parseFloat(totales?.s ?? '0')
  const i = parseFloat(totales?.i ?? '0')
  await query(`UPDATE pedidos SET subtotal=$1,impuestos=$2,total=$3,updated_at=NOW() WHERE id=$4`, [s, i, s + i, pedidoId])
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  await ensureMesasSchema()
  const urlPath = (req.url||'').split('?')[0]
  const parts = urlPath.split('/').filter(Boolean)
  const pedidoId = parts[2]||null
  const isItems = parts[3]==='items'
  const itemId = parts[4]||null

  if (pedidoId && isItems && itemId) {
    const pedidoDelItem = await queryOne(`SELECT mesa_id FROM pedidos WHERE id=$1 AND empresa_id=$2`, [pedidoId, eid]) as any
    if (!pedidoDelItem) return res.status(404).json({ ok: false, msg: 'Pedido no encontrado' })
    if (pedidoDelItem.mesa_id && !(await puedeAccederMesa(eid, pedidoDelItem.mesa_id, auth))) return res.status(403).json({ ok: false, msg: 'No tienes acceso a este pedido' })
    if (req.method==='PATCH') {
      const actual = await queryOne(`SELECT * FROM pedido_items WHERE id=$1 AND pedido_id=$2 AND empresa_id=$3`, [itemId, pedidoId, eid]) as any
      if (!actual) return res.status(404).json({ ok: false, msg: 'Item no encontrado' })

      const { estado, cantidad, observaciones } = req.body||{}
      const ups:string[]=[],params:any[]=[]; let idx=1
      if (estado){ups.push(`estado=$${idx++}`);params.push(estado)}
      if (cantidad!==undefined){
        const nueva = Math.max(0, parseFloat(String(cantidad)) || 0)
        const anterior = parseFloat(String(actual.cantidad)) || 0
        const delta = nueva - anterior
        if (actual.estado !== 'cancelado' && delta > 0) await moverInventario(eid, actual.producto_id, auth.id, delta, 'venta', `Aumento pedido ${pedidoId}`)
        if (actual.estado !== 'cancelado' && delta < 0) await moverInventario(eid, actual.producto_id, auth.id, Math.abs(delta), 'devolucion', `Disminucion pedido ${pedidoId}`)
        ups.push(`cantidad=$${idx++}`);params.push(nueva)
        ups.push(`subtotal=$${idx++}`);params.push((parseFloat(String(actual.precio_unit)) || 0) * nueva)
      }
      if (estado === 'cancelado' && actual.estado !== 'cancelado') {
        await moverInventario(eid, actual.producto_id, auth.id, actual.cantidad, 'devolucion', `Cancelacion item pedido ${pedidoId}`)
      }
      if (observaciones!==undefined){ups.push(`observaciones=$${idx++}`);params.push(observaciones)}
      if (!ups.length) return res.status(400).end()
      params.push(itemId)
      const [u]=await query(`UPDATE pedido_items SET ${ups.join(',')} WHERE id=$${idx} RETURNING *`,params)
      await recalcularPedido(pedidoId)
      return res.status(200).json({ ok: true, data: u })
    }
    if (req.method==='DELETE') {
      const actual = await queryOne(`SELECT * FROM pedido_items WHERE id=$1 AND pedido_id=$2 AND empresa_id=$3`, [itemId, pedidoId, eid]) as any
      if (actual && actual.estado !== 'cancelado') {
        await moverInventario(eid, actual.producto_id, auth.id, actual.cantidad, 'devolucion', `Cancelacion item pedido ${pedidoId}`)
      }
      await query(`UPDATE pedido_items SET estado='cancelado' WHERE id=$1`,[itemId])
      await recalcularPedido(pedidoId)
      return res.status(200).json({ ok: true })
    }
    return res.status(405).end()
  }

  if (!pedidoId) {
    if (req.method==='GET') {
      const { estado, mesa_id, limit=50 } = req.query||{}
      if (!puedeAdministrarPedidos(auth.rol) && !mesa_id) return res.status(403).json({ ok: false, msg: 'Debes consultar una mesa asignada' })
      if (mesa_id && !(await puedeAccederMesa(eid, String(mesa_id), auth))) return res.status(403).json({ ok: false, msg: 'Esta mesa no esta asignada a tu usuario' })
      let where=`p.empresa_id=$1`; const params:any[]=[eid]; let idx=2
      if (estado) { const estados=estado.split(','); where+=` AND p.estado=ANY($${idx++})`; params.push(estados) }
      if (mesa_id) { where+=` AND p.mesa_id=$${idx++}`; params.push(mesa_id) }
      const rows=await query(
        `SELECT p.*,m.numero as mesa_numero,u.nombre as mesero_nombre,c.nombre as cliente_nombre
         FROM pedidos p
         LEFT JOIN mesas m ON m.id=p.mesa_id
         LEFT JOIN usuarios u ON u.id=p.usuario_id
         LEFT JOIN clientes c ON c.id=p.cliente_id
         WHERE ${where} ORDER BY p.created_at DESC LIMIT $${idx}`,
        [...params, parseInt(String(limit))])
      return res.status(200).json({ ok: true, data: rows })
    }
    if (req.method==='POST') {
      const { mesa_id,cliente_id,tipo,notas,items } = req.body||{}
      if (!items?.length) return res.status(400).json({ ok: false, msg: 'Items requeridos' })
      if (mesa_id && !(await puedeAccederMesa(eid, String(mesa_id), auth))) return res.status(403).json({ ok: false, msg: 'Esta mesa no esta asignada a tu usuario' })
      try {
        const pid=uuid(); let subtotal=0,impuestos=0
        for (const item of items) {
          const prod=await queryOne(`SELECT precio_venta,impuesto_pct,disponible FROM productos WHERE id=$1 AND empresa_id=$2`,[item.producto_id,eid]) as any
          if (!prod||!prod.disponible) return res.status(400).json({ ok: false, msg: `Producto no disponible: ${item.producto_id}` })
          const s=prod.precio_venta*item.cantidad; subtotal+=s; impuestos+=s*(prod.impuesto_pct/100)
        }
        await query(
          `INSERT INTO pedidos (id,empresa_id,mesa_id,cliente_id,usuario_id,estado,tipo,subtotal,impuestos,total,notas)
           VALUES ($1,$2,$3,$4,$5,'abierto',$6,$7,$8,$9,$10)`,
          [pid,eid,mesa_id||null,cliente_id||null,auth.id,tipo||'mesa',subtotal,impuestos,subtotal+impuestos,notas||null])
        for (const item of items) {
          const prod=await queryOne(`SELECT precio_venta,impuesto_pct,destino FROM productos WHERE id=$1 AND empresa_id=$2`,[item.producto_id,eid]) as any
          if (!prod) continue
          await query(
            `INSERT INTO pedido_items (id,pedido_id,empresa_id,producto_id,cantidad,precio_unit,impuesto_pct,subtotal,observaciones,destino)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [uuid(),pid,eid,item.producto_id,item.cantidad,prod.precio_venta,prod.impuesto_pct,prod.precio_venta*item.cantidad,item.observaciones||null,prod.destino||'barra'])
          await moverInventario(eid, item.producto_id, auth.id, item.cantidad, 'venta', `Pedido ${pid}`)
        }
        if (mesa_id) await query(`UPDATE mesas SET estado='ocupada' WHERE id=$1 AND empresa_id=$2`,[mesa_id,eid])
        const pedido=await queryOne(`SELECT p.*,json_agg(json_build_object('id',pi.id,'producto_id',pi.producto_id,'cantidad',pi.cantidad,'precio_unit',pi.precio_unit,'subtotal',pi.subtotal,'estado',pi.estado,'observaciones',pi.observaciones,'destino',pi.destino)) as items FROM pedidos p LEFT JOIN pedido_items pi ON pi.pedido_id=p.id WHERE p.id=$1 GROUP BY p.id`,[pid])
        return res.status(201).json({ ok: true, data: pedido })
      } catch(e: any) { console.error(e.message); return res.status(500).json({ ok: false, msg: e.message }) }
    }
  } else {
    const pedido=await queryOne(`SELECT * FROM pedidos WHERE id=$1 AND empresa_id=$2`,[pedidoId,eid]) as any
    if (!pedido) return res.status(404).json({ ok: false, msg: 'Pedido no encontrado' })
    if (pedido.mesa_id && !(await puedeAccederMesa(eid, pedido.mesa_id, auth))) return res.status(403).json({ ok: false, msg: 'No tienes acceso a este pedido' })

    if (req.method==='GET') {
      const d=await queryOne(
        `SELECT p.*,m.numero as mesa_numero,u.nombre as mesero_nombre,c.nombre as cliente_nombre,
         json_agg(json_build_object('id',pi.id,'producto_id',pi.producto_id,'nombre',pr.nombre,'cantidad',pi.cantidad,'precio_unit',pi.precio_unit,'subtotal',pi.subtotal,'estado',pi.estado,'observaciones',pi.observaciones,'destino',pi.destino,'created_at',pi.created_at) ORDER BY pi.created_at) as items
         FROM pedidos p
         LEFT JOIN mesas m ON m.id=p.mesa_id
         LEFT JOIN usuarios u ON u.id=p.usuario_id
         LEFT JOIN clientes c ON c.id=p.cliente_id
         LEFT JOIN pedido_items pi ON pi.pedido_id=p.id
         LEFT JOIN productos pr ON pr.id=pi.producto_id
         WHERE p.id=$1 AND p.empresa_id=$2 GROUP BY p.id,m.numero,u.nombre,c.nombre`,[pedidoId,eid])
      return res.status(200).json({ ok: true, data: d })
    }

    if (req.method==='POST') {
      const { items } = req.body||{}
      if (!items?.length) return res.status(400).json({ ok: false, msg: 'Items requeridos' })
      for (const item of items) {
        const prod=await queryOne(`SELECT precio_venta,impuesto_pct,destino,disponible FROM productos WHERE id=$1 AND empresa_id=$2`,[item.producto_id,eid]) as any
        if (!prod||!prod.disponible) continue
        await query(`INSERT INTO pedido_items (id,pedido_id,empresa_id,producto_id,cantidad,precio_unit,impuesto_pct,subtotal,observaciones,destino) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [uuid(),pedidoId,eid,item.producto_id,item.cantidad,prod.precio_venta,prod.impuesto_pct,prod.precio_venta*item.cantidad,item.observaciones||null,prod.destino||'barra'])
        await moverInventario(eid, item.producto_id, auth.id, item.cantidad, 'venta', `Pedido ${pedidoId}`)
      }
      await recalcularPedido(pedidoId)
      const updated=await queryOne(`SELECT * FROM pedidos WHERE id=$1`,[pedidoId])
      return res.status(200).json({ ok: true, data: updated })
    }

    if (req.method==='PATCH') {
      const { estado,descuento,propina,notas,cliente_id } = req.body||{}
      const ups:string[]=[],params:any[]=[]; let idx=1
      if (estado){ups.push(`estado=$${idx++}`);params.push(estado)}
      if (descuento!==undefined){ups.push(`descuento=$${idx++}`);params.push(descuento)}
      if (propina!==undefined){ups.push(`propina=$${idx++}`);params.push(propina)}
      if (notas!==undefined){ups.push(`notas=$${idx++}`);params.push(notas)}
      if (cliente_id!==undefined){ups.push(`cliente_id=$${idx++}`);params.push(cliente_id)}
      if (!ups.length) return res.status(400).end()
      if (estado==='cancelado' && pedido.estado !== 'cancelado') {
        const items = await query(`SELECT producto_id,cantidad FROM pedido_items WHERE pedido_id=$1 AND empresa_id=$2 AND estado!='cancelado'`, [pedidoId, eid])
        for (const item of items as any[]) await moverInventario(eid, item.producto_id, auth.id, item.cantidad, 'devolucion', `Cancelacion pedido ${pedidoId}`)
        await query(`UPDATE pedido_items SET estado='cancelado' WHERE pedido_id=$1 AND empresa_id=$2 AND estado!='cancelado'`, [pedidoId, eid])
      }
      if (estado==='cobrado'||estado==='cancelado') {
        ups.push('cierre_at=NOW()')
        if (pedido.mesa_id) await query(`UPDATE mesas SET estado='libre' WHERE id=$1 AND empresa_id=$2`,[pedido.mesa_id,eid])
      }
      ups.push('updated_at=NOW()'); params.push(pedidoId,eid)
      const [u]=await query(`UPDATE pedidos SET ${ups.join(',')} WHERE id=$${idx++} AND empresa_id=$${idx} RETURNING *`,params)
      return res.status(200).json({ ok: true, data: u })
    }
  }
  return res.status(405).end()
}
