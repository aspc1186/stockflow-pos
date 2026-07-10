import { query, queryOne } from '../_db'
import { authenticate, cors } from '../_auth'

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id

  if (req.method==='GET') {
    const { critico,search } = req.query||{}
    let where=`i.empresa_id=$1`; const params: any[]=[eid]; let idx=2
    if (critico==='true') where+=` AND i.stock_actual<=i.stock_minimo AND i.stock_minimo>0`
    if (search) { where+=` AND p.nombre ILIKE $${idx++}`; params.push(`%${search}%`) }
    const rows=await query(`SELECT i.*,p.nombre as producto_nombre,p.codigo,p.tipo FROM inventario i JOIN productos p ON p.id=i.producto_id WHERE ${where} ORDER BY p.nombre`,params)
    return res.status(200).json({ ok:true, data:rows })
  }
  if (req.method==='POST') {
    const { producto_id,tipo,cantidad,notas,costo_unit } = req.body||{}
    if (!producto_id||!tipo||cantidad===undefined) return res.status(400).json({ ok:false, msg:'Datos requeridos' })
    const inv=await queryOne(`SELECT stock_actual FROM inventario WHERE producto_id=$1 AND empresa_id=$2`,[producto_id,eid]) as any
    if (!inv) return res.status(404).json({ ok:false, msg:'Sin registro de inventario' })
    const q=parseFloat(String(cantidad))||0; const antes=inv.stock_actual; let despues=antes
    if (['entrada','compra'].includes(tipo)) despues=antes+q
    else if (['salida','merma','rotura','venta'].includes(tipo)) despues=Math.max(0,antes-q)
    else if (tipo==='ajuste') despues=q
    await query(`UPDATE inventario SET stock_actual=$1,updated_at=NOW() WHERE producto_id=$2 AND empresa_id=$3`,[despues,producto_id,eid])
    await query(`INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues,costo_unit,notas) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9)`,[eid,producto_id,auth.id,tipo,Math.abs(q),antes,despues,costo_unit||null,notas||null])
    return res.status(201).json({ ok:true, data:{producto_id,tipo,cantidad:q,stock_antes:antes,stock_despues:despues} })
  }
  return res.status(405).end()
}
