import { formatCurrency } from './utils'

function textoSeguro(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char] || char))
}

function etiquetaPago(value: unknown) {
  const pago = String(value || 'pendiente').replaceAll('_', ' ')
  return pago.charAt(0).toUpperCase() + pago.slice(1)
}

function ventana(html: string) {
  const destino = window.open('', '_blank', 'width=420,height=680')
  if (!destino) return false
  destino.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Comprobante StockFlow</title><style>body{font-family:Arial,sans-serif;margin:0;color:#111}main{width:72mm;margin:0 auto;padding:5mm;font-size:12px}h1{font-size:17px;margin:0 0 4px;text-align:center}p{margin:3px 0}.line{border-top:1px dashed #555;margin:9px 0}.row{display:flex;justify-content:space-between;gap:8px}.muted{color:#555;font-size:11px}.total{font-size:16px;font-weight:bold}.item{padding:5px 0;border-bottom:1px dotted #aaa}.item-name{font-weight:bold}.item-detail{display:flex;justify-content:space-between;gap:8px;color:#444;font-size:11px;margin-top:2px}.summary{margin-top:5px}.summary .row{margin:3px 0}@media print{body{margin:0}main{width:72mm}}</style></head><body><main>${html}</main><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`)
  destino.document.close()
  return true
}

export function imprimirPedido(pedido: any, empresa: any) {
  const items = (pedido.items || []).filter((item: any) => item.estado !== 'cancelado').map((item: any) => {
    const cantidad = Number(item.cantidad || 0)
    const precioUnitario = Number(item.precio_unit || 0)
    const subtotal = Number(item.subtotal ?? cantidad * precioUnitario)
    return `<div class="item"><div class="item-name">${textoSeguro(item.nombre || 'Producto')}</div><div class="item-detail"><span>${cantidad} x ${formatCurrency(precioUnitario)}</span><strong>${formatCurrency(subtotal)}</strong></div></div>`
  }).join('') || '<p class="muted">Sin productos registrados</p>'
  const subtotal = Number(pedido.subtotal || 0)
  const impuestos = Number(pedido.impuestos || 0)
  const descuento = Number(pedido.descuento || 0)
  const propina = Number(pedido.propina || 0)
  return ventana(`<h1>${textoSeguro(empresa?.nombre || 'StockFlow POS')}</h1><p class="muted" style="text-align:center">Comprobante de venta</p><div class="line"></div><p>Pedido: #${textoSeguro(pedido.numero || '-')}</p><p>Mesa: ${textoSeguro(pedido.mesa_numero || 'Sin mesa')}</p>${pedido.cliente_nombre ? `<p>Cliente: ${textoSeguro(pedido.cliente_nombre)}</p>` : ''}<p>Fecha: ${new Date(pedido.cierre_at || pedido.updated_at || Date.now()).toLocaleString('es-CO')}</p><p>Pago: ${textoSeguro(etiquetaPago(pedido.metodo_pago))}</p><div class="line"></div><p class="muted">DETALLE DE PRODUCTOS</p>${items}<div class="line"></div><div class="summary"><div class="row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>${impuestos > 0 ? `<div class="row"><span>Impuestos</span><span>${formatCurrency(impuestos)}</span></div>` : ''}${descuento > 0 ? `<div class="row"><span>Descuento</span><span>-${formatCurrency(descuento)}</span></div>` : ''}${propina > 0 ? `<div class="row"><span>Propina</span><span>${formatCurrency(propina)}</span></div>` : ''}</div><div class="line"></div><div class="row total"><span>TOTAL PAGADO</span><span>${formatCurrency(pedido.total || 0)}</span></div><p class="muted" style="text-align:center;margin-top:14px">Gracias por su compra</p>`)
}

export function imprimirMovimientoCaja(movimiento: any, empresa: any) {
  const esSalida = ['egreso','compra_inventario','compra_no_inventario'].includes(movimiento.tipo)
  return ventana(`<h1>${empresa?.nombre || 'StockFlow POS'}</h1><p class="muted" style="text-align:center">Comprobante de caja</p><div class="line"></div><p>Fecha: ${new Date(movimiento.created_at || Date.now()).toLocaleString('es-CO')}</p><p>Tipo: ${String(movimiento.tipo || '').replaceAll('_',' ')}</p><p>Metodo: ${String(movimiento.metodo_pago || '').replaceAll('_',' ')}</p><p>Descripcion: ${movimiento.descripcion || '-'}</p><div class="line"></div><div class="row total"><span>${esSalida ? 'SALIDA' : 'INGRESO'}</span><span>${esSalida ? '-' : '+'}${formatCurrency(movimiento.monto || 0)}</span></div>`)
}
