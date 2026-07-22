import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'
import { ensureRestaurantSchema, esRestaurante, recalcularReceta } from './_restaurante.js'

export default async function handler(req:any,res:any) {
  cors(res); if(req.method==='OPTIONS')return res.status(200).end(); const auth=await authenticate(req,res); if(!auth?.empresa_id)return
  await ensureRestaurantSchema(); const eid=auth.empresa_id; const restaurante=await esRestaurante(eid)
  if (restaurante && req.method==='DELETE') {
    const productoIds=Array.isArray(req.body?.producto_ids)?req.body.producto_ids.filter(Boolean):[]
    if(!productoIds.length)return res.status(400).json({ok:false,msg:'Selecciona al menos una receta'})
    const eliminadas=await query(`UPDATE recetas_restaurante SET activa=false,updated_at=NOW() WHERE empresa_id=$1 AND producto_id = ANY($2::uuid[]) AND activa=true RETURNING producto_id`,[eid,productoIds]) as any[]
    await query(`UPDATE productos SET producto_tipo='simple',updated_at=NOW() WHERE empresa_id=$1 AND id = ANY($2::uuid[])`,[eid,productoIds])
    return res.status(200).json({ok:true,data:{eliminadas:eliminadas.length}})
  }
  const productoId=String(req.query?.producto_id||'')
  if(!productoId)return res.status(400).json({ok:false,msg:'Producto requerido'})
  if(restaurante){
    if(req.method==='GET'){const receta=await queryOne(`SELECT * FROM recetas_restaurante WHERE empresa_id=$1 AND producto_id=$2 AND activa=true`,[eid,productoId]) as any;if(!receta)return res.status(200).json({ok:true,data:null});const lineas=await query(`SELECT ri.*,i.nombre as ingrediente_nombre,i.stock_actual,i.unidad_consumo FROM receta_ingredientes ri JOIN ingredientes i ON i.id=ri.ingrediente_id WHERE ri.receta_id=$1 ORDER BY i.nombre`,[receta.id]);return res.status(200).json({ok:true,data:{...receta,ingredientes:lineas}})}
    if(req.method==='PUT'){const producto=await queryOne(`SELECT id,nombre FROM productos WHERE id=$1 AND empresa_id=$2`,[productoId,eid]) as any;if(!producto)return res.status(404).json({ok:false,msg:'Producto no encontrado'});const b=req.body||{};const ingredientes=Array.isArray(b.ingredientes)?b.ingredientes:[];const actual=await queryOne(`SELECT * FROM recetas_restaurante WHERE empresa_id=$1 AND producto_id=$2 AND activa=true`,[eid,productoId]) as any;const recetaId=actual?.id||uuid();if(actual){await query(`UPDATE recetas_restaurante SET nombre=$1,porciones=$2,costos_adicionales=$3,updated_at=NOW() WHERE id=$4`,[b.nombre||`Receta ${producto.nombre}`,Math.max(1,Number(b.porciones)||1),Math.max(0,Number(b.costos_adicionales)||0),recetaId]);await query(`DELETE FROM receta_ingredientes WHERE receta_id=$1`,[recetaId])}else await query(`INSERT INTO recetas_restaurante (id,empresa_id,producto_id,nombre,porciones,costos_adicionales) VALUES ($1,$2,$3,$4,$5,$6)`,[recetaId,eid,productoId,b.nombre||`Receta ${producto.nombre}`,Math.max(1,Number(b.porciones)||1),Math.max(0,Number(b.costos_adicionales)||0)])
      for(const item of ingredientes){const ingrediente=await queryOne(`SELECT id,costo_unitario FROM ingredientes WHERE id=$1 AND empresa_id=$2 AND activo=true`,[item.ingrediente_id,eid]) as any;const neta=Number(item.cantidad_neta ?? item.cantidad);const merma=Math.max(0,Math.min(99.9,Number(item.merma_pct)||0));if(!ingrediente||!Number.isFinite(neta)||neta<=0)continue;const bruta=neta/(1-merma/100);await query(`INSERT INTO receta_ingredientes (id,empresa_id,receta_id,ingrediente_id,cantidad_neta,unidad,merma_pct,cantidad_bruta,costo_unitario,costo_total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[uuid(),eid,recetaId,ingrediente.id,neta,item.unidad||'unidad',merma,bruta,ingrediente.costo_unitario||0,bruta*Number(ingrediente.costo_unitario||0)])}
      await recalcularReceta(recetaId,eid);const receta=await queryOne(`SELECT * FROM recetas_restaurante WHERE id=$1`,[recetaId]);return res.status(200).json({ok:true,data:receta})}
    return res.status(405).end()
  }
  // Compatibilidad para recetas antiguas de empresas no restaurante.
  const create=`CREATE TABLE IF NOT EXISTS recetas_producto (id UUID PRIMARY KEY, empresa_id UUID NOT NULL, producto_id UUID NOT NULL, ingrediente_id UUID NOT NULL, cantidad NUMERIC(12,3) NOT NULL, unidad VARCHAR(30) NOT NULL DEFAULT 'unidad', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(producto_id,ingrediente_id))`; await query(create)
  if(req.method==='GET'){const rows=await query(`SELECT r.*,p.nombre as ingrediente_nombre,p.unidad_medida FROM recetas_producto r JOIN productos p ON p.id=r.ingrediente_id WHERE r.empresa_id=$1 AND r.producto_id=$2 ORDER BY p.nombre`,[eid,productoId]);return res.status(200).json({ok:true,data:rows})}
  if(req.method==='PUT'){const ingredientes=Array.isArray(req.body?.ingredientes)?req.body.ingredientes:[];await query(`DELETE FROM recetas_producto WHERE empresa_id=$1 AND producto_id=$2`,[eid,productoId]);for(const item of ingredientes){const cantidad=Number(item.cantidad);if(item.ingrediente_id&&cantidad>0)await query(`INSERT INTO recetas_producto (id,empresa_id,producto_id,ingrediente_id,cantidad,unidad) VALUES ($1,$2,$3,$4,$5,$6)`,[uuid(),eid,productoId,item.ingrediente_id,cantidad,item.unidad||'unidad'])}return res.status(200).json({ok:true})}
  return res.status(405).end()
}
