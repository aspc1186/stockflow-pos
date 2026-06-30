import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query, queryOne } from '../_db'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  if (req.method === 'GET') {
    const { critico, search } = req.query as Record<string,string>
    let where=`i.empresa_id=$1`; const params:unknown[]=[eid]; let idx=2
    if (critico==='true') where+=` AND i.stock_actual<=i.stock_minimo AND i.stock_minimo>0`
    if (search){where+=` AND p.nombre ILIKE $${idx++}`;params.push(`%${search}%`)}
    const items = await query(`SELECT i.*,p.nombre as producto_nombre,p.codigo,p.unidad_medida,c.nombre as categoria_nombre FROM inventario i JOIN productos p ON p.id=i.producto_id LEFT JOIN categorias c ON c.id=p.categoria_id WHERE ${where} ORDER BY p.nombre`,params)
    return res.status(200).json({success:true,data:items})
  }
  if (req.method === 'POST') {
    if (!['admin','supervisor','bodeguero'].includes(auth.rol)) return res.status(403).json({success:false,message:'Sin permisos'})
    const { producto_id,tipo,cantidad,costo_unit,notas } = req.body ?? {}
    if (!producto_id||!tipo||cantidad===undefined) return res.status(400).json({success:false,message:'Datos requeridos'})
    const inv = await queryOne<any>(`SELECT stock_actual FROM inventario WHERE producto_id=$1 AND empresa_id=$2`,[producto_id,eid])
    if (!inv) return res.status(404).json({success:false,message:'Sin inventario'})
    const q=parseFloat(String(cantidad))||0; const antes=inv.stock_actual
    let despues=antes
    if (['entrada','compra'].includes(tipo)) despues=antes+q
    else if (['salida','merma','venta'].includes(tipo)) despues=Math.max(0,antes-q)
    else if (tipo==='ajuste') despues=q
    await query(`UPDATE inventario SET stock_actual=$1,updated_at=NOW() WHERE producto_id=$2 AND empresa_id=$3`,[despues,producto_id,eid])
    const [mov]=await query(`INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues,costo_unit,notas) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[eid,producto_id,auth.id,tipo,Math.abs(q),antes,despues,costo_unit||null,notas||null])
    return res.status(201).json({success:true,data:mov})
  }
  return res.status(405).end()
}
