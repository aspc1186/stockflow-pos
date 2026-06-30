import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '../_db'
import { signToken, cors } from '../_auth'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()
  const { username, password } = req.body ?? {}
  if (!username || !password) return res.status(400).json({ success: false, message: 'Requerido' })
  try {
    const user = await queryOne<any>(
      `SELECT u.*,r.nombre as rol_nombre FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.username=$1`,
      [username.toLowerCase()]
    )
    if (!user || !user.activo) return res.status(401).json({ success: false, message: 'Credenciales inválidas' })
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ success: false, message: 'Credenciales inválidas' })
    let empresa = null
    if (user.empresa_id) {
      empresa = await queryOne(`SELECT id,nombre,slug,tipo,activa,logo_url FROM empresas WHERE id=$1`, [user.empresa_id])
      if (!(empresa as any)?.activa) return res.status(403).json({ success: false, message: 'Empresa inactiva' })
    }
    await query(`UPDATE usuarios SET ultimo_acceso=NOW() WHERE id=$1`, [user.id])
    const token = signToken({ sub: user.id, empresa_id: user.empresa_id ?? undefined, rol: user.rol_nombre })
    const { password_hash, ...safeUser } = user
    return res.status(200).json({ success: true, token, user: { ...safeUser, rol: { id: user.rol_id, nombre: user.rol_nombre }, empresa } })
  } catch (e) { console.error(e); return res.status(500).json({ success: false, message: 'Error interno' }) }
}
