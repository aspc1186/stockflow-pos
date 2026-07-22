import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const parts = (req.url||'').split('?')[0].split('/').filter(Boolean)
  if (parts[1] === 'menu' && req.method === 'GET') {
    const empresa = await queryOne(`SELECT id,nombre,logo_url,tema FROM empresas WHERE slug=$1 AND activa=true`, [parts[2]]) as any
    if (!empresa) return res.status(404).json({ok:false,msg:'Negocio no encontrado'})
    const mesa = await queryOne(`SELECT numero,nombre,capacidad FROM mesas WHERE empresa_id=$1 AND LOWER(numero::text)=LOWER($2) AND activa=true`, [empresa.id, decodeURIComponent(parts[3] || '')]) as any
    if (!mesa) return res.status(404).json({ok:false,msg:'Mesa no encontrada'})
    const productos = await query(`SELECT p.id,p.nombre,p.descripcion,p.imagen_url,p.precio_venta,p.impuesto_pct,p.destino,c.nombre as categoria FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id WHERE p.empresa_id=$1 AND p.disponible=true ORDER BY c.nombre NULLS LAST,p.nombre`,[empresa.id])
    return res.status(200).json({ok:true,data:{empresa,mesa,productos}})
  }
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  const modulo = parts[2]
  const tablas: any = { zonas:'zonas',categorias:'categorias',clientes:'clientes',proveedores:'proveedores',reservas:'reservas',eventos:'eventos' }
  const tabla = tablas[modulo]
  if (!tabla) return res.status(404).end()

  if (req.method==='GET') {
    const { search } = req.query||{}
    let where=`empresa_id=$1`; const params: any[]=[eid]
    if (search) { where+=` AND nombre ILIKE $2`; params.push(`%${search}%`) }
    const rows=await query(`SELECT * FROM ${tabla} WHERE ${where} ORDER BY nombre LIMIT 500`,params)
    return res.status(200).json({ ok:true, data:rows })
  }
  if (req.method==='POST') {
    const { nombre,...rest } = req.body||{}
    if (!nombre && modulo!=='reservas' && modulo!=='eventos') return res.status(400).json({ ok:false, msg:'Nombre requerido' })
    const allData = { id:uuid(), empresa_id:eid, ...req.body }
    const keys=Object.keys(allData)
    const vals=Object.values(allData)
    const phs=vals.map((_: any,i: number)=>`$${i+1}`).join(',')
    try {
      const [row]=await query(`INSERT INTO ${tabla} (${keys.join(',')}) VALUES (${phs}) RETURNING *`,vals)
      return res.status(201).json({ ok:true, data:row })
    } catch(e: any) { return res.status(500).json({ ok:false, msg:e.message }) }
  }
  return res.status(405).end()
}
