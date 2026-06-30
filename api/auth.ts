import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { query, queryOne } from '../_db'
import { signToken, requireAuth, cors } from '../_auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { pathname } = new URL(req.url!, `http://${req.headers.host}`)
  const action = pathname.split('/').pop()

  // POST /api/auth/login
  if (action === 'login' && req.method === 'POST') {
    const { username, password } = req.body ?? {}
    if (!username || !password) return res.status(400).json({ success: false, message: 'Requerido' })
    try {
      const user = await queryOne<any>(
        `SELECT u.*,r.nombre as rol_nombre FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.username=$1`,
        [username.toLowerCase()]
      )
      
      // DEBUG: log para ver qué está pasando
      console.log('Usuario encontrado:', user ? 'SÍ' : 'NO')
      console.log('Usuario activo:', user?.activo)
      console.log('Hash en DB:', user?.password_hash?.substring(0, 20) + '...')
      
      if (!user || !user.activo) return res.status(401).json({ success: false, message: 'Credenciales inválidas' })
      
      const valid = await bcrypt.compare(password, user.password_hash)
      console.log('bcrypt.compare resultado:', valid)
      
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
    } catch (e) { 
      console.error('Error en login:', e)
      return res.status(500).json({ success: false, message: 'Error interno' }) 
    }
  }

  // GET /api/auth/me
  if (action === 'me' && req.method === 'GET') {
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

  // POST /api/auth/forgot-password
  if (action === 'forgot-password' && req.method === 'POST') {
    const { email } = req.body ?? {}
    if (!email) return res.status(400).json({ success: false, message: 'Email requerido' })
    try {
      const user = await queryOne<any>(`SELECT id FROM usuarios WHERE email=$1 AND activo=true`, [email.toLowerCase()])
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

  // POST /api/auth/reset-password
  if (action === 'reset-password' && req.method === 'POST') {
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

  return res.status(404).json({ success: false, message: 'Ruta no encontrada' })
}
