import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let ready: Promise<void> | null = null
function ensureSchema() {
  if (!ready) ready = query(`
    CREATE TABLE IF NOT EXISTS reservas (id UUID PRIMARY KEY, empresa_id UUID NOT NULL, mesa_id UUID, nombre VARCHAR(160) NOT NULL, telefono VARCHAR(60), fecha_hora TIMESTAMPTZ NOT NULL, personas INTEGER NOT NULL DEFAULT 1, estado VARCHAR(30) NOT NULL DEFAULT 'pendiente', notas TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS eventos_promocionales (id UUID PRIMARY KEY, empresa_id UUID NOT NULL, titulo VARCHAR(160) NOT NULL, descripcion TEXT, fecha_inicio TIMESTAMPTZ, fecha_fin TIMESTAMPTZ, imagen_url TEXT, tipo VARCHAR(30) NOT NULL DEFAULT 'evento', activo BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())
  `).then(()=>undefined)
  return ready
}

export default async function handler(req:any,res:any) {
  cors(res); if(req.method==='OPTIONS') return res.status(200).end()
  const auth=await authenticate(req,res); if(!auth?.empresa_id) return
  if(!['admin','supervisor'].includes(auth.rol)) return res.status(403).json({ok:false,msg:'Sin permisos'})
  await ensureSchema(); const eid=auth.empresa_id
  const parts=(req.url||'').split('?')[0].split('/').filter(Boolean); const modulo=parts[1]; const id=parts[2]
  if(modulo==='reservas') {
    if(req.method==='GET') { const rows=await query(`SELECT r.*,m.numero as mesa_numero FROM reservas r LEFT JOIN mesas m ON m.id=r.mesa_id WHERE r.empresa_id=$1 ORDER BY r.fecha_hora DESC LIMIT 300`,[eid]); return res.status(200).json({ok:true,data:rows}) }
    if(req.method==='POST') { const b=req.body||{}; if(!String(b.nombre||'').trim()||!b.fecha_hora)return res.status(400).json({ok:false,msg:'Nombre y fecha requeridos'}); const [row]=await query(`INSERT INTO reservas (id,empresa_id,mesa_id,nombre,telefono,fecha_hora,personas,estado,notas) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[uuid(),eid,b.mesa_id||null,String(b.nombre).trim(),b.telefono||null,b.fecha_hora,Math.max(1,Number(b.personas)||1),b.estado||'pendiente',b.notas||null]); return res.status(201).json({ok:true,data:row}) }
    const actual=await queryOne(`SELECT id FROM reservas WHERE id=$1 AND empresa_id=$2`,[id,eid]); if(!actual)return res.status(404).json({ok:false,msg:'Reserva no encontrada'})
    if(req.method==='PATCH'){const b=req.body||{};const [row]=await query(`UPDATE reservas SET mesa_id=COALESCE($1,mesa_id),nombre=COALESCE($2,nombre),telefono=COALESCE($3,telefono),fecha_hora=COALESCE($4,fecha_hora),personas=COALESCE($5,personas),estado=COALESCE($6,estado),notas=COALESCE($7,notas),updated_at=NOW() WHERE id=$8 RETURNING *`,[b.mesa_id,b.nombre,b.telefono,b.fecha_hora,b.personas,b.estado,b.notas,id]);return res.status(200).json({ok:true,data:row})}
    if(req.method==='DELETE'){await query(`DELETE FROM reservas WHERE id=$1 AND empresa_id=$2`,[id,eid]);return res.status(200).json({ok:true})}
  }
  if(modulo==='eventos') {
    if(req.method==='GET'){const rows=await query(`SELECT * FROM eventos_promocionales WHERE empresa_id=$1 ORDER BY fecha_inicio DESC NULLS LAST,created_at DESC LIMIT 200`,[eid]);return res.status(200).json({ok:true,data:rows})}
    if(req.method==='POST'){const b=req.body||{};if(!String(b.titulo||'').trim())return res.status(400).json({ok:false,msg:'Titulo requerido'});const [row]=await query(`INSERT INTO eventos_promocionales (id,empresa_id,titulo,descripcion,fecha_inicio,fecha_fin,imagen_url,tipo,activo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[uuid(),eid,String(b.titulo).trim(),b.descripcion||null,b.fecha_inicio||null,b.fecha_fin||null,b.imagen_url||null,b.tipo||'evento',b.activo!==false]);return res.status(201).json({ok:true,data:row})}
    const actual=await queryOne(`SELECT id FROM eventos_promocionales WHERE id=$1 AND empresa_id=$2`,[id,eid]);if(!actual)return res.status(404).json({ok:false,msg:'Evento no encontrado'})
    if(req.method==='PATCH'){const b=req.body||{};const [row]=await query(`UPDATE eventos_promocionales SET titulo=COALESCE($1,titulo),descripcion=COALESCE($2,descripcion),fecha_inicio=COALESCE($3,fecha_inicio),fecha_fin=COALESCE($4,fecha_fin),imagen_url=COALESCE($5,imagen_url),tipo=COALESCE($6,tipo),activo=COALESCE($7,activo),updated_at=NOW() WHERE id=$8 RETURNING *`,[b.titulo,b.descripcion,b.fecha_inicio,b.fecha_fin,b.imagen_url,b.tipo,b.activo,id]);return res.status(200).json({ok:true,data:row})}
    if(req.method==='DELETE'){await query(`DELETE FROM eventos_promocionales WHERE id=$1 AND empresa_id=$2`,[id,eid]);return res.status(200).json({ok:true})}
  }
  return res.status(405).end()
}
