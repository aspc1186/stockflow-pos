import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSuperAdmin, cors } from '../../_auth'
import { query, queryOne } from '../../_db'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireSuperAdmin(req, res); if (!auth) return
  const { id } = req.query
  const e = await queryOne(`SELECT * FROM empresas WHERE id=$1`,[id])
  if (!e) return res.status(404).json({success:false,message:'Empresa no encontrada'})
  if (req.method === 'GET') {
    const d=await queryOne(`SELECT e.*,(SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id=e.id) as total_usuarios,(SELECT COUNT(*) FROM pedidos p WHERE p.empresa_id=e.id) as total_pedidos,(SELECT COALESCE(SUM(p.total),0) FROM pedidos p WHERE p.empresa_id=e.id AND p.estado='cobrado') as ventas_totales FROM empresas e WHERE e.id=$1`,[id])
    const u=await query(`SELECT u.id,u.nombre,u.email,u.username,u.activo,u.ultimo_acceso,r.nombre as rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.empresa_id=$1 ORDER BY u.nombre`,[id])
    return res.status(200).json({success:true,data:{...d,usuarios:u}})
  }
  if (req.method === 'PATCH') {
    const { activa,licencia_fin,nombre,telefono,email,ciudad,tipo } = req.body ?? {}
    const [u]=await query(`UPDATE empresas SET activa=COALESCE($1,activa),licencia_fin=COALESCE($2,licencia_fin),nombre=COALESCE($3,nombre),telefono=COALESCE($4,telefono),email=COALESCE($5,email),ciudad=COALESCE($6,ciudad),tipo=COALESCE($7,tipo),updated_at=NOW() WHERE id=$8 RETURNING *`,[activa,licencia_fin,nombre,telefono,email,ciudad,tipo,id])
    return res.status(200).json({success:true,data:u})
  }
  return res.status(405).end()
}
