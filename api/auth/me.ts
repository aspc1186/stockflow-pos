import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { queryOne } from '../_db'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth) return
  const user = await queryOne(
    `SELECT u.id,u.empresa_id,u.nombre,u.email,u.username,u.telefono,u.activo,u.ultimo_acceso,
     json_build_object('id',r.id,'nombre',r.nombre) as rol,
     CASE WHEN u.empresa_id IS NULL THEN NULL
     ELSE json_build_object('id',e.id,'nombre',e.nombre,'slug',e.slug,'tipo',e.tipo,'activa',e.activa) END as empresa
     FROM usuarios u JOIN roles r ON r.id=u.rol_id LEFT JOIN empresas e ON e.id=u.empresa_id WHERE u.id=$1`,
    [auth.id]
  )
  return res.status(200).json({ success: true, data: user })
}
