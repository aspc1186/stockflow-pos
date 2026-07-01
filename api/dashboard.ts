const { requireAuth, cors } = require('../_auth')
const { query, queryOne } = require('../_db')

module.exports = async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  const urlPath = (req.url || '').split('?')[0]

  if (urlPath.includes('/reportes')) {
    if (!['admin','supervisor'].includes(auth.rol)) {
      return res.status(403).json({ success: false, message: 'Sin permisos' })
    }
    const { desde, hasta, agrupacion = 'dia' } = req.query || {}
    const fd = desde || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]
    const fh = hasta || new Date().toISOString().split('T')[0]
    const fmtMap: any = { dia: 'YYYY-MM-DD', semana: 'IYYY-IW', mes: 'YYYY-MM' }
    const fmt = fmtMap[agrupacion] || 'YYYY-MM-DD'
    try {
      const [vpp, tp, vm, r] = await Promise.all([
        query(`SELECT TO_CHAR(DATE_TRUNC($1,cierre_at),'${fmt}') as periodo,COUNT(*) as pedidos,SUM(total) as total FROM pedidos WHERE empresa_id=$2 AND estado='cobrado' AND cierre_at::date BETWEEN $3 AND $4 GROUP BY 1 ORDER BY 1`, [agrupacion, eid, fd, fh]),
        query(`SELECT p.nombre,SUM(pi.cantidad) as unidades,SUM(pi.subtotal) as total FROM pedido_items pi JOIN productos p ON p.id=pi.producto_id JOIN pedidos ped ON ped.id=pi.pedido_id WHERE pi.empresa_id=$1 AND ped.estado='cobrado' AND ped.cierre_at::date BETWEEN $2 AND $3 GROUP BY p.id,p.nombre ORDER BY total DESC LIMIT 20`, [eid, fd, fh]),
        query(`SELECT u.nombre,COUNT(ped.id) as pedidos,SUM(ped.total) as total FROM pedidos ped JOIN usuarios u ON u.id=ped.usuario_id WHERE ped.empresa_id=$1 AND ped.estado='cobrado' AND ped.cierre_at::date BETWEEN $2 AND $3 GROUP BY u.id,u.nombre ORDER BY total DESC`, [eid, fd, fh]),
        query(`SELECT COUNT(*) as total_pedidos,COALESCE(SUM(total),0) as total_ventas,COALESCE(AVG(total),0) as ticket_promedio FROM pedidos WHERE empresa_id=$1 AND estado='cobrado' AND cierre_at::date BETWEEN $2 AND $3`, [eid, fd, fh]),
      ])
      return res.status(200).json({ success: true, data: { periodo: { desde: fd, hasta: fh }, resumen: r[0], ventas_por_periodo: vpp, top_productos: tp, ventas_por_mesero: vm } })
    } catch (e: any) { console.error(e.message); return res.status(500).json({ success: false, message: 'Error interno' }) }
  }

  try {
    const [vh, vm, pa, em, ic, ca, tp, vph] = await Promise.all([
      queryOne(`SELECT COALESCE(SUM(total),0) as total FROM pedidos WHERE empresa_id=$1 AND estado='cobrado' AND DATE(cierre_at)=CURRENT_DATE`, [eid]),
      queryOne(`SELECT COALESCE(SUM(total),0) as total FROM pedidos WHERE empresa_id=$1 AND estado='cobrado' AND DATE_TRUNC('month',cierre_at)=DATE_TRUNC('month',CURRENT_DATE)`, [eid]),
      queryOne(`SELECT COUNT(*) as total FROM pedidos WHERE empresa_id=$1 AND estado IN ('abierto','en_preparacion','listo')`, [eid]),
      query(`SELECT estado,COUNT(*) as total FROM mesas WHERE empresa_id=$1 AND activa=true GROUP BY estado`, [eid]),
      queryOne(`SELECT COUNT(*) as total FROM inventario WHERE empresa_id=$1 AND stock_actual<=stock_minimo AND stock_minimo>0`, [eid]),
      queryOne(`SELECT saldo_inicial,total_ventas,total_ingresos,total_egresos FROM cajas WHERE empresa_id=$1 AND estado='abierta' ORDER BY apertura_at DESC LIMIT 1`, [eid]),
      query(`SELECT p.nombre,SUM(pi.cantidad) as total FROM pedido_items pi JOIN productos p ON p.id=pi.producto_id JOIN pedidos ped ON ped.id=pi.pedido_id WHERE pi.empresa_id=$1 AND DATE(ped.created_at)=CURRENT_DATE GROUP BY p.id,p.nombre ORDER BY total DESC LIMIT 8`, [eid]),
      query(`SELECT TO_CHAR(cierre_at,'HH24:00') as hora,COALESCE(SUM(total),0) as total FROM pedidos WHERE empresa_id=$1 AND estado='cobrado' AND DATE(cierre_at)=CURRENT_DATE GROUP BY hora ORDER BY hora`, [eid]),
    ])
    const mp = em.reduce((a: any, r: any) => { a[r.estado] = parseInt(r.total); return a }, {})
    const caja = ca ? parseFloat(ca.saldo_inicial) + parseFloat(ca.total_ventas) + parseFloat(ca.total_ingresos) - parseFloat(ca.total_egresos) : 0
    return res.status(200).json({
      success: true, data: {
        ventas_hoy: parseFloat(vh?.total ?? '0'), ventas_mes: parseFloat(vm?.total ?? '0'),
        pedidos_activos: parseInt(pa?.total ?? '0'),
        mesas_ocupadas: (mp['ocupada'] ?? 0) + (mp['preparando'] ?? 0) + (mp['lista_cobrar'] ?? 0),
        mesas_libres: mp['libre'] ?? 0, inventario_critico: parseInt(ic?.total ?? '0'),
        caja_actual: caja, usuarios_conectados: 0,
        productos_mas_vendidos: tp.map((r: any) => ({ nombre: r.nombre, total: parseFloat(r.total) })),
        ventas_por_hora: vph.map((r: any) => ({ hora: r.hora, total: parseFloat(r.total) }))
      }
    })
  } catch (e: any) { console.error(e.message); return res.status(500).json({ success: false, message: 'Error interno' }) }
}
