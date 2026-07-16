import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, authSuperAdmin, cors } from '../_auth.js'

let empresaSchemaReady: Promise<void> | null = null
function ensureEmpresaSchema() {
  if (!empresaSchemaReady) empresaSchemaReady = query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS plan VARCHAR(30) DEFAULT 'basico', ADD COLUMN IF NOT EXISTS tema VARCHAR(30) DEFAULT 'noche', ADD COLUMN IF NOT EXISTS fondo_url TEXT`).then(() => undefined)
  return empresaSchemaReady
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const urlPath = (req.url || '').split('?')[0]
  const parts = urlPath.split('/').filter(Boolean)

  // /api/empresas/[id] — accesible por admin de empresa también
  if (parts[1] === 'empresas' && parts[0] === 'api' && !urlPath.includes('superadmin')) {
    const auth = await authenticate(req, res)
    if (!auth) return
    const id = parts[2]
    if (!id) return res.status(400).json({ ok: false, msg: 'ID requerido' })
    if (auth.rol !== 'superadmin' && auth.empresa_id !== id) {
      return res.status(403).json({ ok: false, msg: 'Sin permisos' })
    }
    if (req.method === 'GET') {
      await ensureEmpresaSchema()
      const e = await queryOne(`SELECT * FROM empresas WHERE id=$1`, [id])
      return res.status(e ? 200 : 404).json(e ? { ok: true, data: e } : { ok: false, msg: 'No encontrada' })
    }
    if (req.method === 'PATCH') {
      await ensureEmpresaSchema()
      const { nombre, tipo, telefono, email, ciudad, direccion, logo_url, color_primario, tema, fondo_url } = req.body || {}
      const [u] = await query(
        `UPDATE empresas SET nombre=COALESCE($1,nombre),tipo=COALESCE($2,tipo),telefono=COALESCE($3,telefono),email=COALESCE($4,email),ciudad=COALESCE($5,ciudad),direccion=COALESCE($6,direccion),logo_url=COALESCE($7,logo_url),color_primario=COALESCE($8,color_primario),tema=COALESCE($9,tema),fondo_url=COALESCE($10,fondo_url),updated_at=NOW() WHERE id=$11 RETURNING *`,
        [nombre, tipo, telefono, email, ciudad, direccion, logo_url, color_primario, tema, fondo_url, id]
      )
      return res.status(200).json({ ok: true, data: u })
    }
    return res.status(405).end()
  }

  // /api/superadmin/* — solo superadmin
  const auth = await authSuperAdmin(req, res)
  if (!auth) return
  await ensureEmpresaSchema()

  // parts: ['api','superadmin','empresas'] o ['api','superadmin','empresas','ID']
  const empresaId = parts[3] || null

  if (!empresaId) {
    // GET todas las empresas
    if (req.method === 'GET') {
      try {
        const rows = await query(`
          SELECT e.*,
            (SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id=e.id AND u.activo=true) as total_usuarios,
            (SELECT COUNT(*) FROM pedidos p WHERE p.empresa_id=e.id AND DATE(p.created_at)=CURRENT_DATE) as pedidos_hoy,
            (SELECT COALESCE(SUM(p.total),0) FROM pedidos p WHERE p.empresa_id=e.id AND p.estado='cobrado' AND DATE(p.created_at)=CURRENT_DATE) as ventas_hoy
          FROM empresas e
          ORDER BY e.created_at DESC
        `)
        return res.status(200).json({ ok: true, data: rows })
      } catch(e: any) {
        console.error('[superadmin GET]', e.message)
        return res.status(500).json({ ok: false, msg: e.message })
      }
    }

    // POST crear empresa
    if (req.method === 'POST') {
      const { nombre, nit, telefono, email, ciudad, direccion, tipo, plan, licencia_fin, admin_nombre, admin_email, admin_username, admin_password } = req.body || {}
      if (!nombre || !admin_email || !admin_password) {
        return res.status(400).json({ ok: false, msg: 'Nombre, email admin y contraseña son requeridos' })
      }
      try {
        const eid = uuid()
        const slug = nombre.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').slice(0,50) + '-' + eid.slice(0,6)

        await query(
          `INSERT INTO empresas (id,nombre,slug,tipo,nit,telefono,email,ciudad,direccion,plan,activa,licencia_fin) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)`,
          [eid, nombre, slug, tipo||'bar', nit||null, telefono||null, email||null, ciudad||null, direccion||null, plan||'basico', licencia_fin||null]
        )

        const adminRol = await queryOne(`SELECT id FROM roles WHERE nombre='admin'`)
        if (!adminRol) throw new Error('Rol admin no existe. Ejecuta el schema SQL.')

        const hash = await bcrypt.hash(admin_password, 12)
        const uname = (admin_username || admin_email.split('@')[0]).toLowerCase().replace(/[^a-z0-9._]/g,'')

        await query(
          `INSERT INTO usuarios (id,empresa_id,rol_id,nombre,email,username,password_hash,activo) VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
          [uuid(), eid, adminRol.id, admin_nombre||'Administrador', admin_email.toLowerCase(), uname, hash]
        )

        const empresa = await queryOne(`SELECT * FROM empresas WHERE id=$1`, [eid])
        return res.status(201).json({ ok: true, data: empresa })
      } catch(e: any) {
        console.error('[superadmin POST]', e.message)
        return res.status(500).json({ ok: false, msg: e.message })
      }
    }
  } else {
    // GET /api/superadmin/empresas/[id]
    if (req.method === 'GET') {
      const e = await queryOne(`SELECT * FROM empresas WHERE id=$1`, [empresaId])
      if (!e) return res.status(404).json({ ok: false, msg: 'No encontrada' })
      const usuarios = await query(`SELECT u.id,u.nombre,u.email,u.username,u.activo,u.ultimo_acceso,r.nombre as rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.empresa_id=$1 ORDER BY u.nombre`, [empresaId])
      return res.status(200).json({ ok: true, data: { ...e, usuarios } })
    }
    // PATCH /api/superadmin/empresas/[id]
    if (req.method === 'PATCH') {
      const { activa, plan, licencia_fin, nombre } = req.body || {}
      const [u] = await query(
        `UPDATE empresas SET activa=COALESCE($1,activa),plan=COALESCE($2,plan),licencia_fin=COALESCE($3,licencia_fin),nombre=COALESCE($4,nombre),updated_at=NOW() WHERE id=$5 RETURNING *`,
        [activa, plan, licencia_fin, nombre, empresaId]
      )
      return res.status(200).json({ ok: true, data: u })
    }
  }
  return res.status(405).end()
}
