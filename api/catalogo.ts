import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const parts = (req.url||'').split('?')[0].split('/').filter(Boolean)
  if (parts[1] === 'menu' && req.method === 'GET') {
    // QR codes use immutable UUIDs. Slugs can be renamed and must not decide
    // which customer's public catalog is shown.
    const empresa = await queryOne(`SELECT id,nombre,logo_url,tema FROM empresas WHERE (id::text=$1 OR slug=$1) AND activa=true`, [decodeURIComponent(parts[2] || '')]) as any
    if (!empresa) return res.status(404).json({ok:false,msg:'Negocio no encontrado'})
    const mesa = await queryOne(`SELECT id,numero,nombre,capacidad FROM mesas WHERE empresa_id=$1 AND (id::text=$2 OR LOWER(numero::text)=LOWER($2)) AND activa=true`, [empresa.id, decodeURIComponent(parts[3] || '')]) as any
    if (!mesa) return res.status(404).json({ok:false,msg:'Mesa no encontrada'})
    const productos = await query(`SELECT p.id,p.nombre,p.descripcion,p.imagen_url,p.precio_venta,p.impuesto_pct,p.destino,c.nombre as categoria FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id WHERE p.empresa_id=$1 AND p.disponible=true ORDER BY c.nombre NULLS LAST,p.nombre`,[empresa.id])
    // The public QR must work even before an administrator has opened Eventos.
    await query(`CREATE TABLE IF NOT EXISTS eventos_promocionales (id UUID PRIMARY KEY, empresa_id UUID NOT NULL, titulo VARCHAR(160) NOT NULL, descripcion TEXT, fecha_inicio TIMESTAMPTZ, fecha_fin TIMESTAMPTZ, imagen_url TEXT, tipo VARCHAR(30) NOT NULL DEFAULT 'evento', activo BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    const eventos = await query(`SELECT id,titulo,descripcion,fecha_inicio,fecha_fin,imagen_url,tipo FROM eventos_promocionales WHERE empresa_id=$1 AND activo=true AND (fecha_inicio IS NULL OR fecha_inicio<=NOW()) AND (fecha_fin IS NULL OR fecha_fin>=NOW()) ORDER BY fecha_inicio NULLS LAST,created_at DESC LIMIT 8`,[empresa.id])
    return res.status(200).json({ok:true,data:{empresa,mesa,productos,eventos}})
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
