import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const parts = (req.url||'').split('?')[0].split('/').filter(Boolean)
  if (parts[1] === 'menu') {
    const esQrCorto = parts[2] === 'qr'
    const empresa = esQrCorto
      ? await queryOne(`SELECT e.id,e.nombre,e.logo_url,e.tema,e.tipo FROM mesas m JOIN empresas e ON e.id=m.empresa_id WHERE m.qr_token=$1 AND m.activa=true AND e.activa=true`, [decodeURIComponent(parts[3] || '')]) as any
      : await queryOne(`SELECT id,nombre,logo_url,tema,tipo FROM empresas WHERE (id::text=$1 OR slug=$1) AND activa=true`, [decodeURIComponent(parts[2] || '')]) as any
    if (!empresa) return res.status(404).json({ok:false,msg:'Código QR no válido'})
    const mesa = esQrCorto
      ? await queryOne(`SELECT id,numero,nombre,capacidad,mesero_id FROM mesas WHERE empresa_id=$1 AND qr_token=$2 AND activa=true`, [empresa.id, decodeURIComponent(parts[3] || '')]) as any
      : await queryOne(`SELECT id,numero,nombre,capacidad,mesero_id FROM mesas WHERE empresa_id=$1 AND (id::text=$2 OR LOWER(numero::text)=LOWER($2)) AND activa=true`, [empresa.id, decodeURIComponent(parts[3] || '')]) as any
    if (!mesa) return res.status(404).json({ok:false,msg:'Mesa no encontrada'})
    if (req.method === 'POST' && esQrCorto && parts[4] === 'pedido') {
      if (String(empresa.tipo || '').trim().toLowerCase() !== 'restaurante') return res.status(403).json({ok:false,msg:'Los pedidos desde la carta QR están disponibles solo para restaurantes'})
      const items = Array.isArray(req.body?.items) ? req.body.items.filter((i:any) => i?.producto_id && Number(i.cantidad) > 0).slice(0,30) : []
      if (!items.length) return res.status(400).json({ok:false,msg:'Selecciona al menos un producto'})
      const caja = await queryOne(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`,[empresa.id]) as any
      if (!caja) return res.status(400).json({ok:false,msg:'El negocio no está recibiendo pedidos en este momento'})
      const responsable = mesa.mesero_id || (await queryOne(`SELECT id FROM usuarios WHERE empresa_id=$1 AND activo=true ORDER BY CASE WHEN rol_id IN (SELECT id FROM roles WHERE nombre IN ('admin','supervisor')) THEN 0 ELSE 1 END,nombre LIMIT 1`,[empresa.id]) as any)?.id
      if (!responsable) return res.status(400).json({ok:false,msg:'No hay un responsable operativo asignado a esta mesa'})
      let pedido = await queryOne(`SELECT id FROM pedidos WHERE empresa_id=$1 AND mesa_id=$2 AND estado IN ('abierto','en_preparacion','listo') ORDER BY created_at DESC LIMIT 1`,[empresa.id,mesa.id]) as any
      const pedidoId = pedido?.id || uuid()
      if (!pedido) await query(`INSERT INTO pedidos (id,empresa_id,mesa_id,usuario_id,mesero_id,estado,tipo,subtotal,impuestos,total,notas) VALUES ($1,$2,$3,$4,$5,'en_preparacion','mesa',0,0,0,'Pedido solicitado desde el menú QR')`,[pedidoId,empresa.id,mesa.id,responsable,mesa.mesero_id || responsable])
      for (const item of items) {
        const cantidad = Math.min(100, Math.max(1, Number(item.cantidad) || 1))
        const producto = await queryOne(`SELECT id,precio_venta,precio_costo,impuesto_pct,destino,disponible FROM productos WHERE id=$1 AND empresa_id=$2`,[item.producto_id,empresa.id]) as any
        if (!producto?.disponible) return res.status(400).json({ok:false,msg:'Uno de los productos ya no está disponible'})
        await query(`INSERT INTO pedido_items (id,pedido_id,empresa_id,producto_id,cantidad,precio_unit,costo_unit,impuesto_pct,subtotal,observaciones,destino) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[uuid(),pedidoId,empresa.id,producto.id,cantidad,producto.precio_venta,producto.precio_costo || 0,producto.impuesto_pct || 0,producto.precio_venta*cantidad,'Solicitado desde QR',producto.destino || 'barra'])
      }
      const totales = await queryOne(`SELECT COALESCE(SUM(subtotal),0) as subtotal,COALESCE(SUM(subtotal*impuesto_pct/100),0) as impuestos FROM pedido_items WHERE pedido_id=$1 AND estado!='cancelado'`,[pedidoId]) as any
      await query(`UPDATE pedidos SET estado='en_preparacion',subtotal=$1,impuestos=$2,total=$3,updated_at=NOW() WHERE id=$4`,[totales.subtotal,totales.impuestos,Number(totales.subtotal)+Number(totales.impuestos),pedidoId])
      await query(`UPDATE mesas SET estado='ocupada' WHERE id=$1 AND empresa_id=$2`,[mesa.id,empresa.id])
      return res.status(201).json({ok:true,data:{pedido_id:pedidoId,mesa:mesa.numero}})
    }
    if (req.method !== 'GET') return res.status(405).end()
    const productos = await query(`SELECT p.id,p.nombre,p.descripcion,p.imagen_url,p.precio_venta,p.impuesto_pct,p.destino,c.nombre as categoria FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id WHERE p.empresa_id=$1 AND p.disponible=true ORDER BY c.nombre NULLS LAST,p.nombre`,[empresa.id])
    // The public QR must work even before an administrator has opened Eventos.
    await query(`CREATE TABLE IF NOT EXISTS eventos_promocionales (id UUID PRIMARY KEY, empresa_id UUID NOT NULL, titulo VARCHAR(160) NOT NULL, descripcion TEXT, fecha_inicio TIMESTAMPTZ, fecha_fin TIMESTAMPTZ, imagen_url TEXT, tipo VARCHAR(30) NOT NULL DEFAULT 'evento', activo BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    const eventos = await query(`SELECT id,titulo,descripcion,fecha_inicio,fecha_fin,imagen_url,tipo FROM eventos_promocionales WHERE empresa_id=$1 AND activo=true AND (fecha_fin IS NULL OR fecha_fin>=NOW()) ORDER BY fecha_inicio NULLS LAST,created_at DESC`,[empresa.id])
    return res.status(200).json({ok:true,data:{empresa,mesa,productos,eventos}})
  }
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  const modulo = parts[2]
  const tablas: any = { zonas:'zonas',categorias:'categorias',clientes:'clientes',proveedores:'proveedores',reservas:'reservas',eventos:'eventos' }
  const tabla = tablas[modulo]
  if (!tabla) return res.status(404).end()

  if (req.method==='GET') {
    const { search } = req.query||{}
    let where=`empresa_id=$1`; const params: any[]=[eid]
    if (search) { where+=` AND nombre ILIKE $2`; params.push(`%${search}%`) }
    const rows=await query(`SELECT * FROM ${tabla} WHERE ${where} ORDER BY nombre LIMIT 500`,params)
    return res.status(200).json({ ok:true, data:rows })
  }
  if (req.method==='POST') {
    const { nombre,...rest } = req.body||{}
    if (!nombre && modulo!=='reservas' && modulo!=='eventos') return res.status(400).json({ ok:false, msg:'Nombre requerido' })
    const allData = { id:uuid(), empresa_id:eid, ...req.body }
    const keys=Object.keys(allData)
    const vals=Object.values(allData)
    const phs=vals.map((_: any,i: number)=>`$${i+1}`).join(',')
    try {
      const [row]=await query(`INSERT INTO ${tabla} (${keys.join(',')}) VALUES (${phs}) RETURNING *`,vals)
      return res.status(201).json({ ok:true, data:row })
    } catch(e: any) { return res.status(500).json({ ok:false, msg:e.message }) }
  }
  return res.status(405).end()
}
