import { formatCurrency } from './utils'

function ventana(html: string) {
  const destino = window.open('', '_blank', 'width=420,height=680')
  if (!destino) return false
  destino.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Comprobante StockFlow</title><style>body{font-family:Arial,sans-serif;margin:0;color:#111}main{width:72mm;margin:0 auto;padding:5mm;font-size:12px}h1{font-size:17px;margin:0 0 4px;text-align:center}p{margin:3px 0}.line{border-top:1px dashed #555;margin:9px 0}.row{display:flex;justify-content:space-between;gap:8px}.muted{color:#555;font-size:11px}.total{font-size:16px;font-weight:bold}@media print{body{margin:0}main{width:72mm}}</style></head><body><main>${html}</main><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`)
  destino.document.close()
  return true
}

export function imprimirPedido(pedido: any, empresa: any) {
  const items = (pedido.items || []).filter((item: any) => item.estado !== 'cancelado').map((item: any) => `<div class="row"><span>${item.cantidad} x ${item.nombre || 'Producto'}</span><strong>${formatCurrency(item.subtotal)}</strong></div>`).join('')
  return ventana(`<h1>${empresa?.nombre || 'StockFlow POS'}</h1><p class="muted" style="text-align:center">Comprobante de venta</p><div class="line"></div><p>Pedido: #${pedido.numero || '-'}</p><p>Mesa: ${pedido.mesa_numero || 'Sin mesa'}</p><p>Fecha: ${new Date(pedido.cierre_at || pedido.updated_at || Date.now()).toLocaleString('es-CO')}</p><p>Pago: ${String(pedido.metodo_pago || 'pendiente').replaceAll('_',' ')}</p><div class="line"></div>${items}<div class="line"></div><div class="row total"><span>TOTAL</span><span>${formatCurrency(pedido.total || 0)}</span></div><p class="muted" style="text-align:center;margin-top:14px">Gracias por su compra</p>`)
}

export function imprimirMovimientoCaja(movimiento: any, empresa: any) {
  const esSalida = ['egreso','compra_inventario','compra_no_inventario'].includes(movimiento.tipo)
  return ventana(`<h1>${empresa?.nombre || 'StockFlow POS'}</h1><p class="muted" style="text-align:center">Comprobante de caja</p><div class="line"></div><p>Fecha: ${new Date(movimiento.created_at || Date.now()).toLocaleString('es-CO')}</p><p>Tipo: ${String(movimiento.tipo || '').replaceAll('_',' ')}</p><p>Metodo: ${String(movimiento.metodo_pago || '').replaceAll('_',' ')}</p><p>Descripcion: ${movimiento.descripcion || '-'}</p><div class="line"></div><div class="row total"><span>${esSalida ? 'SALIDA' : 'INGRESO'}</span><span>${esSalida ? '-' : '+'}${formatCurrency(movimiento.monto || 0)}</span></div>`)
}
