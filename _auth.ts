const jwt = require('jsonwebtoken')
const { queryOne } = require('./_db')

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'

function signToken(p: any): string {
  return jwt.sign(p, JWT_SECRET, { expiresIn: '8h' })
}

function verifyToken(t: string): any {
  return jwt.verify(t, JWT_SECRET)
}

function extractToken(req: any): string | null {
  const a = req.headers.authorization
  if (!a?.startsWith('Bearer ')) return null
  return a.slice(7)
}

async function requireAuth(req: any, res: any): Promise<any | null> {
  const token = extractToken(req)
  if (!token) {
    res.status(401).json({ success: false, message: 'Token requerido' })
    return null
  }
  try {
    const payload = verifyToken(token)
    const user = await queryOne(
      `SELECT u.id,u.empresa_id,r.nombre as rol,u.nombre,u.email 
       FROM usuarios u JOIN roles r ON r.id=u.rol_id 
       WHERE u.id=$1 AND u.activo=true`,
      [payload.sub]
    )
    if (!user) {
      res.status(401).json({ success: false, message: 'Usuario no valido' })
      return null
    }
    return user
  } catch {
    res.status(401).json({ success: false, message: 'Token invalido' })
    return null
  }
}

async function requireSuperAdmin(req: any, res: any): Promise<any | null> {
  const user = await requireAuth(req, res)
  if (!user) return null
  if (user.rol !== 'superadmin') {
    res.status(403).json({ success: false, message: 'Acceso denegado' })
    return null
  }
  return user
}

function cors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

module.exports = { signToken, verifyToken, extractToken, requireAuth, requireSuperAdmin, cors }
