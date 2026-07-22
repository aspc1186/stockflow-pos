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
    try {
      const eliminadas=await query(`UPDATE recetas_restaurante SET activa=false,updated_at=NOW() WHERE empresa_id=$1 AND producto_id = ANY($2::uuid[]) AND COALESCE(activa,true)=true RETURNING producto_id`,[eid,productoIds]) as any[]
      await query(`UPDATE productos SET producto_tipo='simple',updated_at=NOW() WHERE empresa_id=$1 AND id = ANY($2::uuid[])`,[eid,productoIds])
      return res.status(200).json({ok:true,data:{eliminadas:eliminadas.length}})
    } catch(error:any) { return res.status(500).json({ok:false,msg:`No se pudieron eliminar las recetas: ${error.message}`}) }
  }
  const productoId=String(req.query?.producto_id||'')
  if(!productoId)return res.status(400).json({ok:false,msg:'Producto requerido'})
  if(restaurante){
    if(req.method==='GET'){
      try {
        const receta=await queryOne(`SELECT * FROM recetas_restaurante WHERE empresa_id=$1 AND producto_id=$2 AND COALESCE(activa,true)=true ORDER BY updated_at DESC NULLS LAST,created_at DESC NULLS LAST LIMIT 1`,[eid,productoId]) as any
        if(!receta)return res.status(200).json({ok:true,data:null})
        const lineas=await query(`SELECT ri.*,i.nombre as ingrediente_nombre,i.stock_actual,i.unidad_consumo FROM receta_ingredientes ri JOIN ingredientes i ON i.id=ri.ingrediente_id WHERE ri.receta_id=$1 AND ri.empresa_id=$2 ORDER BY i.nombre`,[receta.id,eid])
        return res.status(200).json({ok:true,data:{...receta,ingredientes:lineas}})
      } catch(error:any) { return res.status(500).json({ok:false,msg:`No se pudo consultar la receta: ${error.message}`}) }
    }
    if(req.method==='PUT'){
      try {
        const producto=await queryOne(`SELECT id,nombre FROM productos WHERE id=$1 AND empresa_id=$2`,[productoId,eid]) as any
        if(!producto)return res.status(404).json({ok:false,msg:'Producto no encontrado'})
        const b=req.body||{}
        const ingredientes=Array.isArray(b.ingredientes)?b.ingredientes:[]
        if(!ingredientes.length)return res.status(400).json({ok:false,msg:'La receta debe tener al menos un ingrediente'})

        const lineas:any[]=[]
        const usados=new Set<string>()
        for(const item of ingredientes){
          const ingredienteId=String(item?.ingrediente_id||'')
          const neta=Number(item?.cantidad_neta ?? item?.cantidad)
          const merma=Math.max(0,Math.min(99.9,Number(item?.merma_pct)||0))
          if(!ingredienteId||!Number.isFinite(neta)||neta<=0)return res.status(400).json({ok:false,msg:'Cada ingrediente debe tener una cantidad neta mayor que cero'})
          if(usados.has(ingredienteId))return res.status(400).json({ok:false,msg:'No repitas el mismo ingrediente dentro de una receta'})
          const ingrediente=await queryOne(`SELECT id,costo_unitario FROM ingredientes WHERE id=$1 AND empresa_id=$2 AND COALESCE(activo,true)=true`,[ingredienteId,eid]) as any
          if(!ingrediente)return res.status(400).json({ok:false,msg:'Uno de los ingredientes ya no existe o esta inactivo'})
          usados.add(ingredienteId)
          lineas.push({ ingrediente, neta, merma, unidad:String(item?.unidad||'unidad').trim() || 'unidad' })
        }

        const actual=await queryOne(`SELECT * FROM recetas_restaurante WHERE empresa_id=$1 AND producto_id=$2 AND COALESCE(activa,true)=true ORDER BY updated_at DESC NULLS LAST,created_at DESC NULLS LAST LIMIT 1`,[eid,productoId]) as any
        const recetaId=actual?.id||uuid()
        const porciones=Math.max(1,Number(b.porciones)||1)
        const manoObra=Math.max(0,Number(b.mano_obra)||0)
        const costosIndirectos=Math.max(0,Number(b.costos_indirectos)||0)
        const empaque=Math.max(0,Number(b.empaque)||0)
        const otrosCostos=Math.max(0,Number(b.otros_costos ?? b.costos_adicionales)||0)
        if(actual){
          await query(`UPDATE recetas_restaurante SET nombre=$1,porciones=$2,costos_adicionales=$3,mano_obra=$4,costos_indirectos=$5,empaque=$6,otros_costos=$7,activa=true,updated_at=NOW() WHERE id=$8 AND empresa_id=$9`,[b.nombre||`Receta ${producto.nombre}`,porciones,otrosCostos,manoObra,costosIndirectos,empaque,otrosCostos,recetaId,eid])
          await query(`DELETE FROM receta_ingredientes WHERE receta_id=$1 AND empresa_id=$2`,[recetaId,eid])
        } else {
          await query(`INSERT INTO recetas_restaurante (id,empresa_id,producto_id,nombre,porciones,costos_adicionales,mano_obra,costos_indirectos,empaque,otros_costos,activa) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)`,[recetaId,eid,productoId,b.nombre||`Receta ${producto.nombre}`,porciones,otrosCostos,manoObra,costosIndirectos,empaque,otrosCostos])
        }
        for(const linea of lineas){
          const bruta=linea.neta/(1-linea.merma/100)
          const costoUnitario=Number(linea.ingrediente.costo_unitario||0)
          await query(`INSERT INTO receta_ingredientes (id,empresa_id,receta_id,ingrediente_id,cantidad_neta,unidad,merma_pct,cantidad_bruta,costo_unitario,costo_total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[uuid(),eid,recetaId,linea.ingrediente.id,linea.neta,linea.unidad,linea.merma,bruta,costoUnitario,bruta*costoUnitario])
        }
        await recalcularReceta(recetaId,eid)
        const receta=await queryOne(`SELECT * FROM recetas_restaurante WHERE id=$1 AND empresa_id=$2`,[recetaId,eid])
        return res.status(200).json({ok:true,data:receta})
      } catch(error:any) { return res.status(500).json({ok:false,msg:`No se pudo guardar la receta: ${error.message}`}) }
    }
    return res.status(405).end()
  }
  // Compatibilidad para recetas antiguas de empresas no restaurante.
  const create=`CREATE TABLE IF NOT EXISTS recetas_producto (id UUID PRIMARY KEY, empresa_id UUID NOT NULL, producto_id UUID NOT NULL, ingrediente_id UUID NOT NULL, cantidad NUMERIC(12,3) NOT NULL, unidad VARCHAR(30) NOT NULL DEFAULT 'unidad', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(producto_id,ingrediente_id))`; await query(create)
  if(req.method==='GET'){const rows=await query(`SELECT r.*,p.nombre as ingrediente_nombre,p.unidad_medida FROM recetas_producto r JOIN productos p ON p.id=r.ingrediente_id WHERE r.empresa_id=$1 AND r.producto_id=$2 ORDER BY p.nombre`,[eid,productoId]);return res.status(200).json({ok:true,data:rows})}
  if(req.method==='PUT'){const ingredientes=Array.isArray(req.body?.ingredientes)?req.body.ingredientes:[];await query(`DELETE FROM recetas_producto WHERE empresa_id=$1 AND producto_id=$2`,[eid,productoId]);for(const item of ingredientes){const cantidad=Number(item.cantidad);if(item.ingrediente_id&&cantidad>0)await query(`INSERT INTO recetas_producto (id,empresa_id,producto_id,ingrediente_id,cantidad,unidad) VALUES ($1,$2,$3,$4,$5,$6)`,[uuid(),eid,productoId,item.ingrediente_id,cantidad,item.unidad||'unidad'])}return res.status(200).json({ok:true})}
  return res.status(405).end()
}
