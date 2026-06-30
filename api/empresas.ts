import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from './_auth'
import { query, queryOne } from './_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth) return
  const parts = (req.url || '').split('?')[0].split('/').filter(Boolean)
  const id = parts[2] || null
  if (!id) return res.status(400).end()
  if (auth.rol!=='superadmin' && auth.empresa_id!==id) return res.status(403).json({ success: false, message: 'Sin permisos' })
  const e=await queryOne(`SELECT * FROM empresas WHERE id=$1`,[id])
  if (!e) return res.status(404).json({ success: false, message: 'Empresa no encontrada' })
  if (req.method === 'GET') return res.status(200).json({ success: true, data: e })
  if (req.method === 'PATCH') {
    if (!['admin','superadmin'].includes(auth.rol)) return res.status(403).json({ success: false, message: 'Sin permisos' })
    const { nombre,telefono,email,ciudad,tipo,logo_url } = req.body ?? {}
    const [u]=await query(`UPDATE empresas SET nombre=COALESCE($1,nombre),telefono=COALESCE($2,telefono),email=COALESCE($3,email),ciudad=COALESCE($4,ciudad),tipo=COALESCE($5,tipo),logo_url=COALESCE($6,logo_url),updated_at=NOW() WHERE id=$7 RETURNING *`,[nombre,telefono,email,ciudad,tipo,logo_url,id])
    return res.status(200).json({ success: true, data: u })
  }
  return res.status(405).end()
}
