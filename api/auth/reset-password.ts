import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '../_db'
import { cors } from '../_auth'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()
  const { token, password } = req.body ?? {}
  if (!token || !password || password.length < 8) return res.status(400).json({ success: false, message: 'Datos inválidos' })
  try {
    const reset = await queryOne<any>(`SELECT * FROM password_resets WHERE token=$1`, [token])
    if (!reset || reset.usado || new Date(reset.expires_at) < new Date()) return res.status(400).json({ success: false, message: 'Enlace inválido o expirado' })
    const hash = await bcrypt.hash(password, 12)
    await query(`UPDATE usuarios SET password_hash=$1,updated_at=NOW() WHERE id=$2`, [hash, reset.usuario_id])
    await query(`UPDATE password_resets SET usado=true WHERE id=$1`, [reset.id])
    return res.status(200).json({ success: true, message: 'Contraseña actualizada' })
  } catch(e) { console.error(e); return res.status(500).json({ success: false, message: 'Error interno' }) }
}
