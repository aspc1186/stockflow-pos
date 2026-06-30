import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSuperAdmin, cors } from '../_auth'
import { query, queryOne } from '../_db'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireSuperAdmin(req, res); if (!auth) return
  if (req.method === 'GET') {
    const rows = await query(`SELECT e.*,(SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id=e.id AND u.activo=true) as total_usuarios,(SELECT COUNT(*) FROM pedidos p WHERE p.empresa_id=e.id AND DATE(p.created_at)=CURRENT_DATE) as pedidos_hoy FROM empresas e ORDER BY e.created_at DESC`)
    return res.status(200).json({success:true,data:rows})
  }
  if (req.method === 'POST') {
    const { nombre,nit,telefono,email,ciudad,tipo,licencia_inicio,licencia_fin,admin_nombre,admin_email,admin_username,admin_password } = req.body ?? {}
    if (!nombre||!admin_email||!admin_password) return res.status(400).json({success:false,message:'Datos requeridos'})
    try {
      const eid=uuid()
      const slug=nombre.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')+'-'+eid.slice(0,6)
      await query(`INSERT INTO empresas (id,nombre,slug,nit,telefono,email,ciudad,tipo,activa,licencia_inicio,licencia_fin) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)`,[eid,nombre,slug,nit||null,telefono||null,email||null,ciudad||null,tipo||'restaurante',licencia_inicio||null,licencia_fin||null])
      const hash=await bcrypt.hash(admin_password,12)
      const ar=await queryOne<any>(`SELECT id FROM roles WHERE nombre='admin'`)
      const uname=admin_username||(admin_email.split('@')[0]).toLowerCase()
      await query(`INSERT INTO usuarios (id,empresa_id,rol_id,nombre,email,username,password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)`,[uuid(),eid,ar!.id,admin_nombre||'Administrador',admin_email.toLowerCase(),uname,hash])
      const e=await queryOne(`SELECT * FROM empresas WHERE id=$1`,[eid])
      return res.status(201).json({success:true,data:e})
    } catch(e){console.error(e);return res.status(500).json({success:false,message:'Error interno'})}
  }
  return res.status(405).end()
}
