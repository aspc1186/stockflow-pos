import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query, queryOne } from '../_db'
import { v4 as uuid } from 'uuid'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  if (req.method === 'GET') {
    const { disponible, search } = req.query as Record<string,string>
    let where=`p.empresa_id=$1`; const params:unknown[]=[eid]; let idx=2
    if (disponible!==undefined){where+=` AND p.disponible=$${idx++}`;params.push(disponible==='true')}
    if (search){where+=` AND p.nombre ILIKE $${idx++}`;params.push(`%${search}%`)}
    const productos = await query(`SELECT p.*,c.nombre as categoria_nombre,COALESCE(i.stock_actual,0) as stock_actual,COALESCE(i.stock_minimo,0) as stock_minimo FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id LEFT JOIN inventario i ON i.producto_id=p.id AND i.empresa_id=p.empresa_id WHERE ${where} ORDER BY p.nombre`,params)
    return res.status(200).json({success:true,data:productos})
  }
  if (req.method === 'POST') {
    if (!['admin','supervisor'].includes(auth.rol)) return res.status(403).json({success:false,message:'Sin permisos'})
    const { categoria_id,nombre,descripcion,codigo,precio_venta,precio_costo,impuesto_pct,unidad_medida,imagen_url,disponible,controla_stock,destino,stock_inicial,stock_minimo,stock_maximo,punto_reorden } = req.body ?? {}
    if (!nombre||precio_venta===undefined) return res.status(400).json({success:false,message:'Nombre y precio requeridos'})
    try {
      const pid=uuid()
      const [prod]=await query(`INSERT INTO productos (id,empresa_id,categoria_id,nombre,descripcion,codigo,precio_venta,precio_costo,impuesto_pct,unidad_medida,imagen_url,disponible,controla_stock,destino) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,[pid,eid,categoria_id||null,nombre,descripcion||null,codigo||null,precio_venta,precio_costo||0,impuesto_pct||0,unidad_medida||'unidad',imagen_url||null,disponible!==false,controla_stock!==false,destino||'ambos'])
      if (controla_stock!==false) {
        await query(`INSERT INTO inventario (id,empresa_id,producto_id,stock_actual,stock_minimo,stock_maximo,punto_reorden) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6)`,[eid,pid,stock_inicial||0,stock_minimo||0,stock_maximo||0,punto_reorden||0])
        if ((stock_inicial||0)>0) await query(`INSERT INTO movimientos_inventario (id,empresa_id,producto_id,usuario_id,tipo,cantidad,stock_antes,stock_despues) VALUES (gen_random_uuid(),$1,$2,$3,'entrada',$4,0,$5)`,[eid,pid,auth.id,stock_inicial,stock_inicial])
      }
      return res.status(201).json({success:true,data:prod})
    } catch(e){console.error(e);return res.status(500).json({success:false,message:'Error interno'})}
  }
  return res.status(405).end()
}
