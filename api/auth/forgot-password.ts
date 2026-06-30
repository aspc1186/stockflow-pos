import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { query, queryOne } from '../_db'
import { cors } from '../_auth'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()
  const { email } = req.body ?? {}
  if (!email) return res.status(400).json({ success: false, message: 'Email requerido' })
  try {
    const user = await queryOne<{id:string}>(`SELECT id FROM usuarios WHERE email=$1 AND activo=true`, [email.toLowerCase()])
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const exp = new Date(Date.now() + 2*60*60*1000)
      await query(`UPDATE password_resets SET usado=true WHERE usuario_id=$1 AND usado=false`, [user.id])
      await query(`INSERT INTO password_resets (usuario_id,token,expires_at) VALUES ($1,$2,$3)`, [user.id, token, exp])
      console.log(`Reset token for ${email}: ${token}`)
    }
    return res.status(200).json({ success: true, message: 'Si el email existe recibirás un enlace' })
  } catch(e) { console.error(e); return res.status(500).json({ success: false, message: 'Error interno' }) }
}
