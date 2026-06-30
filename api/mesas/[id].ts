import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query, queryOne } from '../_db'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const { id } = req.query; const eid = auth.empresa_id
  const mesa = await queryOne(`SELECT * FROM mesas WHERE id=$1 AND empresa_id=$2`,[id,eid])
  if (!mesa) return res.status(404).json({success:false,message:'Mesa no encontrada'})
  if (req.method === 'GET') return res.status(200).json({success:true,data:mesa})
  if (req.method === 'PATCH') {
    const { estado, numero, nombre, capacidad, activa } = req.body ?? {}
    const [u] = await query(`UPDATE mesas SET estado=COALESCE($1,estado),numero=COALESCE($2,numero),nombre=COALESCE($3,nombre),capacidad=COALESCE($4,capacidad),activa=COALESCE($5,activa) WHERE id=$6 AND empresa_id=$7 RETURNING *`,[estado,numero,nombre,capacidad,activa,id,eid])
    return res.status(200).json({success:true,data:u})
  }
  return res.status(405).end()
}
