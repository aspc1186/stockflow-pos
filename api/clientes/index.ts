import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query } from '../_db'
import { v4 as uuid } from 'uuid'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  if (req.method === 'GET') {
    const rows = await query(`SELECT * FROM clientes WHERE empresa_id=$1 ORDER BY nombre`,[eid])
    return res.status(200).json({success:true,data:rows})
  }
  if (req.method === 'POST') {
    const { nombre, ...rest } = req.body ?? {}
    if (!nombre) return res.status(400).json({success:false,message:'Nombre requerido'})
    const keys=['id','empresa_id','nombre',...Object.keys(rest)]
    const vals=[uuid(),eid,nombre,...Object.values(rest)]
    const placeholders=vals.map((_,i)=>'$'+(i+1)).join(',')
    const [row]=await query(`INSERT INTO clientes (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`,vals)
    return res.status(201).json({success:true,data:row})
  }
  return res.status(405).end()
}
