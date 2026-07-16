import jwt from 'jsonwebtoken'
import { queryOne } from './_db.js'

const SECRET = process.env.JWT_SECRET || 'barpos_secret_2024'

function fechaColombia() {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value || ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

function signToken(payload: any, expiresIn: any = '12h'): string {
  return jwt.sign(payload, SECRET, { expiresIn })
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
      `SELECT u.id, u.empresa_id, u.nombre, u.email, u.username,
       CASE WHEN LOWER(TRIM(r.nombre)) IN ('superadmin','super_admin','super administrador','superadministrador') THEN 'superadmin' ELSE LOWER(TRIM(r.nombre)) END as rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.id = $1 AND u.activo = true`,
      [payload.sub]
    )
    if (!user) {
      res.status(401).json({ ok: false, msg: 'Usuario no válido' })
      return null
    }
    const supportEmpresaId = payload.support === true ? String(payload.support_empresa_id || '') : ''
    if (supportEmpresaId && user.rol === 'superadmin') {
      const empresaSoporte = await queryOne(`SELECT id FROM empresas WHERE id=$1`, [supportEmpresaId])
      if (!empresaSoporte) {
        res.status(404).json({ ok: false, msg: 'Empresa de soporte no encontrada' })
        return null
      }
      user.empresa_id = empresaSoporte.id
      user.rol = 'admin'
      user.modo_soporte = true
      user.soporte_superadmin_id = payload.sub
    }
    if (user.empresa_id && !user.modo_soporte) {
      const empresa = await queryOne(`SELECT activa,licencia_fin FROM empresas WHERE id=$1`, [user.empresa_id]) as any
      if (!empresa?.activa) { res.status(403).json({ ok: false, msg: 'Empresa inactiva' }); return null }
      if (empresa.licencia_fin && String(empresa.licencia_fin).slice(0, 10) < fechaColombia()) {
        res.status(403).json({ ok: false, msg: 'Servicio suspendido por mora. Regulariza el pago para continuar.' })
        return null
      }
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
  if (String(user.rol).toLowerCase() !== 'superadmin') {
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
