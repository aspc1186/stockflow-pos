import type { VercelRequest, VercelResponse } from '@vercel/node'
import jwt from 'jsonwebtoken'
import { queryOne } from './_db'
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'
export interface JWTPayload { sub: string; empresa_id?: string; rol: string }
export function signToken(p: JWTPayload): string { return jwt.sign(p, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }) }
export function verifyToken(t: string): JWTPayload { return jwt.verify(t, JWT_SECRET) as JWTPayload }
export function extractToken(req: VercelRequest): string | null {
  const a = req.headers.authorization; if (!a?.startsWith('Bearer ')) return null; return a.slice(7)
}
export interface AuthUser { id: string; empresa_id?: string; rol: string; nombre: string; email: string }
export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<AuthUser | null> {
  const token = extractToken(req)
  if (!token) { res.status(401).json({ success: false, message: 'Token requerido' }); return null }
  try {
    const payload = verifyToken(token)
    const user = await queryOne<AuthUser>(
      `SELECT u.id,u.empresa_id,r.nombre as rol,u.nombre,u.email FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=$1 AND u.activo=true`,
      [payload.sub]
    )
    if (!user) { res.status(401).json({ success: false, message: 'Usuario no válido' }); return null }
    return user
  } catch { res.status(401).json({ success: false, message: 'Token inválido' }); return null }
}
export async function requireSuperAdmin(req: VercelRequest, res: VercelResponse): Promise<AuthUser | null> {
  const user = await requireAuth(req, res); if (!user) return null
  if (user.rol !== 'superadmin') { res.status(403).json({ success: false, message: 'Acceso denegado' }); return null }
  return user
}
export function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}
