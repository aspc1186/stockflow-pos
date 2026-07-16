import bcrypt from 'bcryptjs'
import { query, queryOne } from '../_db.js'
import { signToken, authenticate, cors } from '../_auth.js'

const LEGACY_SUPERADMIN_HASH = 'a2/bin/shZnp6kO.xY.Qif1jSrJqx.O39UNBdkuFEE4tiT3yJf3fcIpBfFT4i'
let empresaSchemaReady: Promise<void> | null = null
function fechaColombia() {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value || ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}
function ensureEmpresaSchema() {
  if (!empresaSchemaReady) empresaSchemaReady = query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tema VARCHAR(30) DEFAULT 'noche', ADD COLUMN IF NOT EXISTS fondo_url TEXT, ADD COLUMN IF NOT EXISTS notificacion_pago TEXT, ADD COLUMN IF NOT EXISTS notificacion_pago_at TIMESTAMPTZ`).then(() => undefined)
  return empresaSchemaReady
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const action = (req.url || '').split('?')[0].split('/').pop()

  // POST /api/auth/login
  if (action === 'login' && req.method === 'POST') {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ ok: false, msg: 'Usuario y contraseña requeridos' })
    }
    try {
      const user = await queryOne(
        `SELECT u.*, CASE WHEN LOWER(TRIM(r.nombre)) IN ('superadmin','super_admin','super administrador','superadministrador') THEN 'superadmin' ELSE LOWER(TRIM(r.nombre)) END as rol_nombre
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         WHERE LOWER(u.username) = LOWER($1) AND u.activo = true`,
        [username.trim()]
      )
      if (!user) {
        return res.status(401).json({ ok: false, msg: 'Credenciales inválidas' })
      }
      let valid = await bcrypt.compare(password, user.password_hash)
      if (!valid && user.username === 'superadmin' && user.password_hash === LEGACY_SUPERADMIN_HASH && password === 'Admin1234') {
        const repairedHash = await bcrypt.hash(password, 12)
        await query(`UPDATE usuarios SET password_hash=$1 WHERE id=$2`, [repairedHash, user.id])
        valid = true
      }
      if (!valid) {
        return res.status(401).json({ ok: false, msg: 'Credenciales inválidas' })
      }
      let empresa = null
      if (user.empresa_id) {
        await ensureEmpresaSchema()
        empresa = await queryOne(`SELECT id,nombre,slug,tipo,activa,logo_url,color_primario,telefono,email,ciudad,licencia_fin,tema,fondo_url,notificacion_pago,notificacion_pago_at FROM empresas WHERE id=$1`, [user.empresa_id])
        if (!empresa?.activa) {
          return res.status(403).json({ ok: false, msg: 'Empresa inactiva' })
        }
        if (empresa.licencia_fin && String(empresa.licencia_fin).slice(0, 10) < fechaColombia()) {
          return res.status(403).json({ ok: false, msg: 'Servicio suspendido por mora. Regulariza el pago para continuar.' })
        }
      }
      await query(`UPDATE usuarios SET ultimo_acceso=NOW() WHERE id=$1`, [user.id])
      const token = signToken({ sub: user.id, empresa_id: user.empresa_id, rol: user.rol_nombre })
      return res.status(200).json({
        ok: true,
        token,
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          username: user.username,
          rol: user.rol_nombre,
          empresa_id: user.empresa_id,
          empresa
        }
      })
    } catch(e: any) {
      console.error('[auth/login]', e.message)
      return res.status(500).json({ ok: false, msg: 'Error interno' })
    }
  }

  // GET /api/auth/me
  if (action === 'me' && req.method === 'GET') {
    const auth = await authenticate(req, res)
    if (!auth) return
    let empresa = null
    if (auth.empresa_id) {
      await ensureEmpresaSchema()
      empresa = await queryOne(`SELECT id,nombre,slug,tipo,activa,logo_url,color_primario,telefono,email,ciudad,licencia_fin,tema,fondo_url,notificacion_pago,notificacion_pago_at FROM empresas WHERE id=$1`, [auth.empresa_id])
    }
    return res.status(200).json({ ok: true, data: { ...auth, empresa } })
  }

  return res.status(404).json({ ok: false, msg: 'Ruta no encontrada' })
}
