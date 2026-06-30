import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { requireAuth, cors } from '../_auth'
import { query, queryOne } from '../_db'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  if (!['admin','supervisor'].includes(auth.rol)) return res.status(403).json({success:false,message:'Sin permisos'})
  const { id } = req.query; const eid = auth.empresa_id
  const u = await queryOne(`SELECT * FROM usuarios WHERE id=$1 AND empresa_id=$2`,[id,eid])
  if (!u) return res.status(404).json({success:false,message:'Usuario no encontrado'})
  if (req.method === 'PATCH') {
    const { nombre,telefono,activo,rol_id,password } = req.body ?? {}
    const ups:string[]=[],params:unknown[]=[]; let idx=1
    if (nombre!==undefined){ups.push(`nombre=$${idx++}`);params.push(nombre)}
    if (telefono!==undefined){ups.push(`telefono=$${idx++}`);params.push(telefono)}
    if (activo!==undefined){ups.push(`activo=$${idx++}`);params.push(activo)}
    if (rol_id!==undefined){ups.push(`rol_id=$${idx++}`);params.push(rol_id)}
    if (password){const h=await bcrypt.hash(password,12);ups.push(`password_hash=$${idx++}`);params.push(h)}
    if (!ups.length) return res.status(400).end()
    ups.push('updated_at=NOW()'); params.push(id)
    const [updated]=await query(`UPDATE usuarios SET ${ups.join(',')} WHERE id=$${idx++} RETURNING id,nombre,email,username,activo,rol_id`,params)
    return res.status(200).json({success:true,data:updated})
  }
  return res.status(405).end()
}
