import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from './_auth'
import { query, queryOne } from './_db'
import { v4 as uuid } from 'uuid'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id

  const urlPath = (req.url || '').split('?')[0]
  const parts = urlPath.split('/').filter(Boolean)
  // /api/pedidos -> parts = ['api','pedidos']
  // /api/pedidos/ID -> parts = ['api','pedidos','ID']
  // /api/pedidos/ID/items/ITEMID -> parts = ['api','pedidos','ID','items','ITEMID']
  const pedidoId = parts[2] || null
  const isItems = parts[3] === 'items'
  const itemId = parts[4] || null

  // ITEMS endpoint
  if (pedidoId && isItems && itemId) {
    const item = await queryOne(`SELECT pi.* FROM pedido_items pi JOIN pedidos p ON p.id=pi.pedido_id WHERE pi.id=$1 AND pi.pedido_id=$2 AND p.empresa_id=$3`, [itemId,pedidoId,eid])
    if (!item) return res.status(404).json({ success: false, message: 'Item no encontrado' })
    if (req.method === 'PATCH') {
      const { estado, cantidad, observaciones } = req.body ?? {}
      const ups:string[]=[],params:unknown[]=[]; let idx=1
      if (estado){ups.push(`estado=$${idx++}`);params.push(estado)}
      if (cantidad!==undefined){ups.push(`cantidad=$${idx++}`);params.push(cantidad)}
      if (observaciones!==undefined){ups.push(`observaciones=$${idx++}`);params.push(observaciones)}
      if (!ups.length) return res.status(400).end()
      ups.push('updated_at=NOW()'); params.push(itemId)
      const [u]=await query(`UPDATE pedido_items SET ${ups.join(',')} WHERE id=$${idx++} RETURNING *`,params)
      return res.status(200).json({ success: true, data: u })
    }
    if (req.method === 'DELETE') {
      await query(`UPDATE pedido_items SET estado='cancelado' WHERE id=$1`, [itemId])
      return res.status(200).json({ success: true })
    }
    return res.status(405).end()
  }

  // PEDIDO por ID
  if (pedidoId) {
    const pedido = await queryOne<any>(`SELECT * FROM pedidos WHERE id=$1 AND empresa_id=$2`, [pedidoId, eid])
    if (!pedido) return res.status(404).json({ success: false, message: 'Pedido no encontrado' })

    if (req.method === 'GET') {
      const d = await queryOne(`SELECT p.*,m.numero as mesa_numero,u.nombre as usuario_nombre,c.nombre as cliente_nombre,json_agg(json_build_object('id',pi.id,'producto_id',pi.producto_id,'nombre',pr.nombre,'cantidad',pi.cantidad,'precio_unit',pi.precio_unit,'subtotal',pi.subtotal,'impuesto_pct',pi.impuesto_pct,'descuento',pi.descuento,'observaciones',pi.observaciones,'estado',pi.estado,'destino',pi.destino,'created_at',pi.created_at) ORDER BY pi.created_at) as items FROM pedidos p LEFT JOIN mesas m ON m.id=p.mesa_id LEFT JOIN usuarios u ON u.id=p.usuario_id LEFT JOIN clientes c ON c.id=p.cliente_id LEFT JOIN pedido_items pi ON pi.pedido_id=p.id LEFT JOIN productos pr ON pr.id=pi.producto_id WHERE p.id=$1 AND p.empresa_id=$2 GROUP BY p.id,m.numero,u.nombre,c.nombre,c.telefono`, [pedidoId,eid])
      return res.status(200).json({ success: true, data: d })
    }

    if (req.method === 'POST') {
      if (['cobrado','cancelado'].includes(pedido.estado)) return res.status(400).json({ success: false, message: 'Pedido cerrado' })
      const { items } = req.body ?? {}; if (!items?.length) return res.status(400).end()
      for (const item of items) {
        const prod = await queryOne<any>(`SELECT precio_venta,impuesto_pct,destino,disponible FROM productos WHERE id=$1 AND empresa_id=$2`, [item.producto_id,eid])
        if (!prod||!prod.disponible) continue
        await query(`INSERT INTO pedido_items (id,pedido_id,empresa_id,producto_id,cantidad,precio_unit,impuesto_pct,subtotal,observaciones,estado,destino) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10)`, [uuid(),pedidoId,eid,item.producto_id,item.cantidad,prod.precio_venta,prod.impuesto_pct,prod.precio_venta*item.cantidad,item.observaciones||null,prod.destino])
      }
      await recalc(pedidoId,eid)
      const u=await queryOne(`SELECT * FROM pedidos WHERE id=$1`,[pedidoId])
      return res.status(200).json({ success: true, data: u })
    }

    if (req.method === 'PATCH') {
      const { estado, descuento, propina, notas, cliente_id } = req.body ?? {}
      const ups:string[]=[],params:unknown[]=[]; let idx=1
      if (estado) {
        ups.push(`estado=$${idx++}`); params.push(estado)
        if (['cobrado','cancelado'].includes(estado)) {
          ups.push(`cierre_at=NOW()`)
          if (pedido.mesa_id) await query(`UPDATE mesas SET estado='libre' WHERE id=$1 AND empresa_id=$2`, [pedido.mesa_id,eid])
          if (estado==='cobrado') await descontarInv(pedidoId,eid,auth.id)
        }
      }
      if (descuento!==undefined){ups.push(`descuento=$${idx++}`);params.push(descuento)}
      if (propina!==undefined){ups.push(`propina=$${idx++}`);params.push(propina)}
      if (notas!==undefined){ups.push(`notas=$${idx++}`);params.push(notas)}
      if (cliente_id!==undefined){ups.push(`cliente_id=$${idx++}`);params.push(cliente_id)}
      if (!ups.length) return res.status(400).end()
      ups.push('updated_at=NOW()'); params.push(pedidoId,eid)
      const [u]=await query(`UPDATE pedidos SET ${ups.join(',')} WHERE id=$${idx++} AND empresa_id=$${idx++} RETURNING *`,params)
      return res.status(200).json({ success: true, data: u })
    }
    return res.status(405).end()
  }

  // LISTA DE PEDIDOS
  if (req.method === 'GET') {
    const { estado, mesa_id } = req.query as Record<string,string>
    let where=`p.empresa_id=$1`; const params:unknown[]=[eid]; let idx=2
    if (estado){const estados=estado.split(',');where+=` AND p.estado=ANY($${idx++})`;params.push(estados)}
    if (mesa_id){where+=` AND p.mesa_id=$${idx++}`;params.push(mesa_id)}
    const pedidos=await query(`SELECT p.*,m.numero as mesa_numero,u.nombre as usuario_nombre,c.nombre as cliente_nombre FROM pedidos p LEFT JOIN mesas m ON m.id=p.mesa_id LEFT JOIN usuarios u ON u.id=p.usuario_id LEFT JOIN clientes c ON c.id=p.cliente_id WHERE ${where} ORDER BY p.created_at DESC LIMIT 100`,params)
    return res.status(200).json({ success: true, data: pedidos })
  }

  if (req.method === 'POST') {
    const { mesa_id, cliente_id, tipo='mesa', notas, items } = req.body ?? {}
    if (!items?.length) return res.status(400).json({ success: false, message: 'Items requeridos' })
    try {
      const pid=uuid(); let subtotal=0, impuestos=0
      for (const item of items) {
        const prod=await queryOne<any>(`SELECT precio_venta,impuesto_pct,disponible FROM productos WHERE id=$1 AND empresa_id=$2`,[item.producto_id,eid])
        if (!prod||!prod.disponible) return res.status(400).json({ success: false, message: 'Producto no disponible' })
        const s=prod.precio_venta*item.cantidad; subtotal+=s; impuestos+=s*prod.impuesto_pct/100
      }
      await query(`INSERT INTO pedidos (id,empresa_id,mesa_id,cliente_id,usuario_id,estado,subtotal,impuestos,total,notas,tipo) VALUES ($1,$2,$3,$4,$5,'abierto',$6,$7,$8,$9,$10)`,[pid,eid,mesa_id||null,cliente_id||null,auth.id,subtotal,impuestos,subtotal+impuestos,notas||null,tipo])
      for (const item of items) {
        const prod=await queryOne<any>(`SELECT precio_venta,impuesto_pct,destino FROM productos WHERE id=$1`,[item.producto_id])
        if (!prod) continue
        await query(`INSERT INTO pedido_items (id,pedido_id,empresa_id,producto_id,cantidad,precio_unit,impuesto_pct,subtotal,observaciones,estado,destino) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10)`,[uuid(),pid,eid,item.producto_id,item.cantidad,prod.precio_venta,prod.impuesto_pct,prod.precio_venta*item.cantidad,item.observaciones||null,prod.destino])
      }
      if (mesa_id) await query(`UPDATE mesas SET estado='ocupada' WHERE id=$1 AND empresa_id=$2`,[mesa_id,eid])
      const pedido=await queryOne(`SELECT p.*,json_agg(json_build_object('id',pi.id,'producto_id',pi.producto_id,'nombre',pr.nombre,'cantidad',pi.cantidad,'precio_unit',pi.precio_unit,'subtotal',pi.subtotal,'observaciones',pi.observaciones,'estado',pi.estado,'destino',pi.destino)) as items FROM pedidos p JOIN pedido_items pi ON pi.pedido_id=p.id JOIN productos pr ON pr.id=pi.producto_id WHERE p.id=$1 GROUP BY p.id`,[pid])
      return res.status(201).json({ success: true, data: pedido })
    } catch(e){console.error(e);return res.status(500).json({ success: false, message: 'Error interno' })}
  }
  return res.status(405).end()
}

async function recalc(pid:string,eid:string){
  const r=await queryOne<any>(`SELECT COALESCE(SUM(subtotal),0) as s,COALESCE(SUM(subtotal*impuesto_pct/100),0) as i FROM pedido_items WHERE pedido_id=$1 AND estado!='cancelado'`,[pid])
  if(!r)return; const s=parseFloat(r.s),i=parseFloat(r.i)
  await query(`UPDATE pedidos SET subtotal=$1,impuestos=$2,total=$3,updated_at=NOW() WHERE id=$4 AND empresa_id=$5`,[s,i,s+i,pid,eid])
}

async function descontarInv(pid:string,eid:string,uid:string){
  const items=await query<any>(`SELECT producto_id,SUM(cantidad) as cantidad FROM pedido_items WHERE pedido_id=$1 AND estado!='cancelado' GROUP BY producto_id`,[pid])
  for(const item of items){
    const inv=await queryOne<any>(`SELECT stock_actual FROM inventario WHERE producto_id=$1 AND empresa_id=$2`,[item.producto_id,eid])
    if(!inv)continue
    const antes=inv.stock_actual,despues=Math.max(0,antes-item.cantidad)
    await query(`UPDATE inventario SET stock_actual=$1,updated_at=NOW() WHERE producto_id=$2 AND empresa_id=$3`,[despues,item.producto_id,eid])
    await query(`INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues,referencia_id,referencia_tipo) VALUES (gen_random_uuid(),$1,$2,$3,'venta',$4,$5,$6,$7,'pedido')`,[eid,item.producto_id,uid,item.cantidad,antes,despues,pid])
  }
}
