import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'
import { ensureRestaurantSchema, esRestaurante } from './_restaurante.js'

export default async function handler(req:any,res:any) {
  cors(res); if (req.method==='OPTIONS') return res.status(200).end()
  const auth = await authenticate(req,res); if (!auth?.empresa_id) return
  await ensureRestaurantSchema(); const eid=auth.empresa_id
  if (!(await esRestaurante(eid))) return res.status(403).json({ok:false,msg:'Modulo exclusivo para empresas tipo Restaurante'})
  const id=(req.url||'').split('?')[0].split('/').filter(Boolean)[2]
  if (!id && req.method==='GET') {
    if (req.query?.movimientos === 'true') {
      const rows=await query(`SELECT m.*,i.nombre as ingrediente_nombre,u.nombre as usuario_nombre FROM movimientos_ingredientes m JOIN ingredientes i ON i.id=m.ingrediente_id LEFT JOIN usuarios u ON u.id=m.usuario_id WHERE m.empresa_id=$1 ORDER BY m.created_at DESC LIMIT 500`,[eid])
      return res.status(200).json({ok:true,data:rows})
    }
    const rows=await query(`SELECT *,stock_actual*costo_unitario as valor_inventario FROM ingredientes WHERE empresa_id=$1 AND activo=true ORDER BY nombre`,[eid])
    return res.status(200).json({ok:true,data:rows})
  }
  if (!id && req.method==='POST') {
    const b=req.body||{}; if(!String(b.nombre||'').trim()) return res.status(400).json({ok:false,msg:'Nombre requerido'})
    try {
      const codigo=String(b.codigo||'').trim()
      const existente=codigo?await queryOne(`SELECT id FROM ingredientes WHERE empresa_id=$1 AND LOWER(TRIM(codigo))=LOWER($2)`,[eid,codigo]):null
      if(existente){
        const [row]=await query(`UPDATE ingredientes SET nombre=$1,descripcion=$2,categoria=$3,unidad_compra=$4,unidad_consumo=$5,factor_conversion=$6,stock_minimo=$7,stock_maximo=$8,punto_reorden=$9,merma_pct=$10,rendimiento=$11,proveedor_principal=$12,activo=true,updated_at=NOW() WHERE id=$13 AND empresa_id=$14 RETURNING *`,[String(b.nombre).trim(),b.descripcion||null,b.categoria||null,b.unidad_compra||'unidad',b.unidad_consumo||'unidad',Math.max(0.0001,Number(b.factor_conversion)||1),Number(b.stock_minimo)||0,b.stock_maximo||null,b.punto_reorden||null,Number(b.merma_pct)||0,Math.max(0,Math.min(1,Number(b.rendimiento)||1)),b.proveedor_principal||null,existente.id,eid])
        return res.status(200).json({ok:true,data:row,actualizado:true})
      }
      const [row]=await query(`INSERT INTO ingredientes (id,empresa_id,codigo,nombre,descripcion,categoria,unidad_compra,unidad_consumo,factor_conversion,stock_actual,stock_minimo,stock_maximo,punto_reorden,merma_pct,rendimiento,proveedor_principal,activo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14,$15,true) RETURNING *`,[uuid(),eid,codigo||null,String(b.nombre).trim(),b.descripcion||null,b.categoria||null,b.unidad_compra||'unidad',b.unidad_consumo||'unidad',Math.max(0.0001,Number(b.factor_conversion)||1),Number(b.stock_minimo)||0,b.stock_maximo||null,b.punto_reorden||null,Number(b.merma_pct)||0,Math.max(0,Math.min(1,Number(b.rendimiento)||1)),b.proveedor_principal||null])
      return res.status(201).json({ok:true,data:row})
    } catch(error:any) { return res.status(500).json({ok:false,msg:`No se pudo guardar el ingrediente: ${error.message}`}) }
  }
  if (!id && req.method==='DELETE') {
    const ids=Array.isArray(req.body?.ids)?req.body.ids.filter(Boolean):[]
    if(!ids.length)return res.status(400).json({ok:false,msg:'Selecciona al menos un ingrediente'})
    try {
      const eliminados=await query(`UPDATE ingredientes SET activo=false,updated_at=NOW() WHERE empresa_id=$1 AND id = ANY($2::uuid[]) AND COALESCE(activo,true)=true RETURNING id`,[eid,ids]) as any[]
      return res.status(200).json({ok:true,data:{eliminados:eliminados.length}})
    } catch(error:any) { return res.status(500).json({ok:false,msg:`No se pudieron eliminar los ingredientes: ${error.message}`}) }
  }
  if (!id) return res.status(405).end()
  const actual=await queryOne(`SELECT * FROM ingredientes WHERE id=$1 AND empresa_id=$2`,[id,eid]); if(!actual) return res.status(404).json({ok:false,msg:'Ingrediente no encontrado'})
  if(req.method==='PATCH') { const b=req.body||{}; const [row]=await query(`UPDATE ingredientes SET codigo=COALESCE($1,codigo),nombre=COALESCE($2,nombre),descripcion=COALESCE($3,descripcion),categoria=COALESCE($4,categoria),unidad_compra=COALESCE($5,unidad_compra),unidad_consumo=COALESCE($6,unidad_consumo),factor_conversion=COALESCE($7,factor_conversion),stock_minimo=COALESCE($8,stock_minimo),stock_maximo=COALESCE($9,stock_maximo),punto_reorden=COALESCE($10,punto_reorden),merma_pct=COALESCE($11,merma_pct),rendimiento=COALESCE($12,rendimiento),proveedor_principal=COALESCE($13,proveedor_principal),activo=COALESCE($14,activo),updated_at=NOW() WHERE id=$15 AND empresa_id=$16 RETURNING *`,[b.codigo,b.nombre,b.descripcion,b.categoria,b.unidad_compra,b.unidad_consumo,b.factor_conversion,b.stock_minimo,b.stock_maximo,b.punto_reorden,b.merma_pct,b.rendimiento,b.proveedor_principal,b.activo,id,eid]); return res.status(200).json({ok:true,data:row}) }
  return res.status(405).end()
}
