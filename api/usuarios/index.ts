import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { requireAuth, cors } from '../_auth'
import { query, queryOne } from '../_db'
import { v4 as uuid } from 'uuid'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  if (!['admin','supervisor'].includes(auth.rol)) return res.status(403).json({success:false,message:'Sin permisos'})
  const eid = auth.empresa_id
  if (req.method === 'GET') {
    const u = await query(`SELECT u.id,u.nombre,u.email,u.username,u.telefono,u.activo,u.ultimo_acceso,u.created_at,json_build_object('id',r.id,'nombre',r.nombre) as rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.empresa_id=$1 ORDER BY u.nombre`,[eid])
    return res.status(200).json({success:true,data:u})
  }
  if (req.method === 'POST') {
    const { nombre,email,username,password,rol_id,telefono } = req.body ?? {}
    if (!nombre||!email||!password||!rol_id) return res.status(400).json({success:false,message:'Campos requeridos'})
    const rol = await queryOne<any>(`SELECT nombre FROM roles WHERE id=$1`,[rol_id])
    if (rol?.nombre==='superadmin') return res.status(403).json({success:false,message:'No permitido'})
    const existeEmail = await queryOne(`SELECT id FROM usuarios WHERE empresa_id=$1 AND email=$2`,[eid,email.toLowerCase()])
    if (existeEmail) return res.status(400).json({success:false,message:'Email ya registrado'})
    const uname = username || email.split('@')[0].toLowerCase()
    const existeUser = await queryOne(`SELECT id FROM usuarios WHERE empresa_id=$1 AND username=$2`,[eid,uname])
    if (existeUser) return res.status(400).json({success:false,message:'Usuario ya existe'})
    const hash = await bcrypt.hash(password, 12)
    const [u]=await query(`INSERT INTO usuarios (id,empresa_id,rol_id,nombre,email,username,password_hash,telefono) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,nombre,email,username,telefono,activo,created_at`,[uuid(),eid,rol_id,nombre,email.toLowerCase(),uname,hash,telefono||null])
    return res.status(201).json({success:true,data:u})
  }
  return res.status(405).end()
}
