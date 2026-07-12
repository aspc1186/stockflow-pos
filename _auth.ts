import jwt from 'jsonwebtoken'
import { queryOne } from './_db.js'

const SECRET = process.env.JWT_SECRET || 'barpos_secret_2024'

function signToken(payload: any): string {
  return jwt.sign(payload, SECRET, { expiresIn: '12h' })
}

function verifyToken(token: string): any {
  return jwt.verify(token, SECRET)
}

function getToken(req: any): string | null {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

async function authenticate(req: any, res: any): Promise<any | null> {
  const token = getToken(req)
  if (!token) {
    res.status(401).json({ ok: false, msg: 'Token requerido' })
    return null
  }
  try {
    const payload = verifyToken(token)
    const user = await queryOne(
      `SELECT u.id, u.empresa_id, u.nombre, u.email, u.username, r.nombre as rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.id = $1 AND u.activo = true`,
      [payload.sub]
    )
    if (!user) {
      res.status(401).json({ ok: false, msg: 'Usuario no válido' })
      return null
    }
    return user
  } catch {
    res.status(401).json({ ok: false, msg: 'Token inválido' })
    return null
  }
}

async function authSuperAdmin(req: any, res: any): Promise<any | null> {
  const user = await authenticate(req, res)
  if (!user) return null
  if (user.rol !== 'superadmin') {
    res.status(403).json({ ok: false, msg: 'Solo superadmin' })
    return null
  }
  return user
}

function cors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

export { signToken, verifyToken, getToken, authenticate, authSuperAdmin, cors }
