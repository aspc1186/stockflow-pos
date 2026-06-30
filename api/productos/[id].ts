import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query, queryOne } from '../_db'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const { id } = req.query; const eid = auth.empresa_id
  const prod = await queryOne(`SELECT * FROM productos WHERE id=$1 AND empresa_id=$2`,[id,eid])
  if (!prod) return res.status(404).json({success:false,message:'Producto no encontrado'})
  if (req.method === 'GET') return res.status(200).json({success:true,data:prod})
  if (req.method === 'PATCH') {
    if (!['admin','supervisor'].includes(auth.rol)) return res.status(403).json({success:false,message:'Sin permisos'})
    const fields:Record<string,unknown>={...req.body}; delete fields.empresa_id
    const ups=Object.entries(fields).filter(([,v])=>v!==undefined).map(([k],i)=>`${k}=$${i+1}`)
    const vals=Object.values(fields).filter(v=>v!==undefined)
    if (!ups.length) return res.status(400).end()
    vals.push(id)
    const [u]=await query(`UPDATE productos SET ${ups.join(',')},updated_at=NOW() WHERE id=$${vals.length} AND empresa_id=$${vals.length+1} RETURNING *`,[...vals,eid])
    return res.status(200).json({success:true,data:u})
  }
  if (req.method === 'DELETE') {
    await query(`UPDATE productos SET disponible=false WHERE id=$1 AND empresa_id=$2`,[id,eid])
    return res.status(200).json({success:true})
  }
  return res.status(405).end()
}
