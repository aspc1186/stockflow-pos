import { v4 as uuid } from 'uuid'
import { query, transaction } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

type VentaItem = { producto_id?: string; cantidad?: number; descuento_pct?: number }

let schemaReady: Promise<void> | null = null
function ensureSchema() {
  if (!schemaReady) schemaReady = query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS origen VARCHAR(30)`).then(() => undefined)
  return schemaReady
}

export default async function handler(req: any, res: any) {
  cors(res)
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  if (req.method !== 'POST') return res.status(405).end()

  await ensureSchema()
  const items = Array.isArray(req.body?.items) ? req.body.items as VentaItem[] : []
  const metodoPago = String(req.body?.metodo_pago || 'efectivo').trim().toLowerCase()
  const notas = String(req.body?.notas || '').trim() || null
  if (!items.length) return res.status(400).json({ ok: false, msg: 'Agrega al menos un producto a la venta' })
  if (!['efectivo', 'tarjeta', 'transferencia', 'otro', 'mixto'].includes(metodoPago)) return res.status(400).json({ ok: false, msg: 'Selecciona un metodo de pago valido' })

  try {
    const resultado = await transaction(async client => {
      const caja = (await client.query(`SELECT id FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1 FOR UPDATE`, [auth.empresa_id])).rows[0]
      if (!caja) throw new Error('No hay una caja abierta para registrar la venta')

      const pedidoId = uuid()
      const lineas: any[] = []
      let subtotal = 0
      let impuestos = 0

      for (const item of items) {
        const cantidad = Number(item.cantidad)
        if (!item.producto_id || !Number.isFinite(cantidad) || cantidad <= 0) throw new Error('Hay un producto o una cantidad invalida en la venta')
        const producto = (await client.query(
          `SELECT id,nombre,precio_venta,precio_costo,impuesto_pct,destino,disponible,COALESCE(controla_stock,true) as controla_stock
           FROM productos WHERE id=$1 AND empresa_id=$2 FOR UPDATE`,
          [item.producto_id, auth.empresa_id]
        )).rows[0]
        if (!producto || !producto.disponible) throw new Error('Uno de los productos ya no esta disponible')

        let inventario = (await client.query(`SELECT stock_actual,stock_minimo FROM inventario WHERE empresa_id=$1 AND producto_id=$2 FOR UPDATE`, [auth.empresa_id, producto.id])).rows[0]
        if (!inventario) {
          await client.query(`INSERT INTO inventario (id,empresa_id,producto_id,stock_actual,stock_minimo) VALUES (gen_random_uuid(),$1,$2,0,0)`, [auth.empresa_id, producto.id])
          inventario = { stock_actual: 0, stock_minimo: 0 }
        }
        const stockAntes = Number(inventario.stock_actual || 0)
        if (producto.controla_stock && cantidad > stockAntes) throw new Error(`Stock insuficiente para ${producto.nombre}. Disponible: ${stockAntes}`)

        const descuentoPct = Math.max(0, Math.min(100, Number(item.descuento_pct || 0)))
        const precio = Number(producto.precio_venta || 0)
        const bruto = precio * cantidad
        const descuento = bruto * descuentoPct / 100
        const base = bruto - descuento
        const impuesto = base * Number(producto.impuesto_pct || 0) / 100
        subtotal += base
        impuestos += impuesto

        await client.query(
          `INSERT INTO pedido_items (id,pedido_id,empresa_id,producto_id,cantidad,precio_unit,costo_unit,impuesto_pct,subtotal,observaciones,destino)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [uuid(), pedidoId, auth.empresa_id, producto.id, cantidad, precio, producto.precio_costo || 0, producto.impuesto_pct || 0, base, descuentoPct ? `Descuento ${descuentoPct}%` : null, producto.destino || 'venta_directa']
        )
        if (producto.controla_stock) {
          const stockDespues = stockAntes - cantidad
          await client.query(`UPDATE inventario SET stock_actual=$1,updated_at=NOW() WHERE empresa_id=$2 AND producto_id=$3`, [stockDespues, auth.empresa_id, producto.id])
          await client.query(
            `INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues,costo_unit,notas)
             VALUES (gen_random_uuid(),$1,$2,$3,'venta',$4,$5,$6,$7,$8)`,
            [auth.empresa_id, producto.id, auth.id, cantidad, stockAntes, stockDespues, producto.precio_costo || 0, `Venta rapida ${pedidoId}`]
          )
        }
        lineas.push({ producto_id: producto.id, nombre: producto.nombre, cantidad, precio_unit: precio, descuento, impuesto, total: base + impuesto })
      }

      const total = subtotal + impuestos
      await client.query(
        `INSERT INTO pedidos (id,empresa_id,usuario_id,mesero_id,estado,tipo,origen,subtotal,impuestos,total,metodo_pago,notas,cierre_at)
         VALUES ($1,$2,$3,$3,'cobrado','venta_rapida','QUICK_SALE',$4,$5,$6,$7,$8,NOW())`,
        [pedidoId, auth.empresa_id, auth.id, subtotal, impuestos, total, metodoPago, notas]
      )
      await client.query(`UPDATE cajas SET total_ventas=COALESCE(total_ventas,0)+$1 WHERE id=$2`, [total, caja.id])
      await client.query(
        `INSERT INTO caja_movimientos (id,empresa_id,caja_id,usuario_id,pedido_id,tipo,metodo_pago,monto,descripcion)
         VALUES ($1,$2,$3,$4,$5,'venta',$6,$7,$8)`,
        [uuid(), auth.empresa_id, caja.id, auth.id, pedidoId, metodoPago, total, `Venta rapida ${pedidoId}`]
      )
      return { pedido_id: pedidoId, caja_id: caja.id, subtotal, impuestos, total, items: lineas }
    })
    return res.status(201).json({ ok: true, data: resultado })
  } catch (error: any) {
    console.error('[ventas-rapidas]', error?.message)
    return res.status(400).json({ ok: false, msg: error?.message || 'La venta no pudo completarse. No se realizaron cambios.' })
  }
}
