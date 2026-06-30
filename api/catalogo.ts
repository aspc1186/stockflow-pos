import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, cors } from '../_auth'
import { query } from '../_db'
import { v4 as uuid } from 'uuid'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res); if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  const parts = (req.url || '').split('?')[0].split('/').filter(Boolean)
  const modulo = parts[1] // zonas, categorias, clientes

  const tablas: Record<string,string> = { zonas:'zonas', categorias:'categorias', clientes:'clientes' }
  const tabla = tablas[modulo]
  if (!tabla) return res.status(404).end()

  if (req.method === 'GET') {
    const { search } = req.query as Record<string,string>
    let where = `empresa_id=$1`; const params:unknown[]=[eid]
    if (search && modulo==='clientes') { where+=` AND (nombre ILIKE $2 OR telefono ILIKE $2 OR email ILIKE $2)`; params.push(`%${search}%`) }
    const rows=await query(`SELECT * FROM ${tabla} WHERE ${where} ORDER BY nombre LIMIT 200`,params)
    return res.status(200).json({ success: true, data: rows })
  }

  if (req.method === 'POST') {
    const { nombre, ...rest } = req.body ?? {}
    if (!nombre) return res.status(400).json({ success: false, message: 'Nombre requerido' })
    const keys=['id','empresa_id','nombre',...Object.keys(rest)]
    const vals=[uuid(),eid,nombre,...Object.values(rest)]
    const placeholders=vals.map((_,i)=>`$${i+1}`).join(',')
    const [row]=await query(`INSERT INTO ${tabla} (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`,vals)
    return res.status(201).json({ success: true, data: row })
  }

  return res.status(405).end()
}
