const bcrypt = require('bcryptjs')
const { v4: uuid } = require('uuid')
const { requireAuth, requireSuperAdmin, cors } = require('../_auth')
const { query, queryOne } = require('../_db')

module.exports = async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const urlPath = (req.url || '').split('?')[0]
  console.log('superadmin handler - urlPath:', urlPath, 'method:', req.method)

  // /api/empresas/[id]
  if (urlPath.includes('/empresas') && !urlPath.includes('/superadmin')) {
    const auth = await requireAuth(req, res)
    if (!auth) return
    const id = urlPath.split('/').filter(Boolean).pop()
    if (!id || id === 'empresas') return res.status(400).end()
    if (auth.rol !== 'superadmin' && auth.empresa_id !== id) {
      return res.status(403).json({ success: false, message: 'Sin permisos' })
    }
    const e = await queryOne(`SELECT * FROM empresas WHERE id=$1`, [id])
    if (!e) return res.status(404).json({ success: false, message: 'Empresa no encontrada' })
    if (req.method === 'GET') return res.status(200).json({ success: true, data: e })
    if (req.method === 'PATCH') {
      const { nombre, telefono, email, ciudad, tipo, logo_url } = req.body ?? {}
      const [u] = await query(`UPDATE empresas SET nombre=COALESCE($1,nombre),telefono=COALESCE($2,telefono),email=COALESCE($3,email),ciudad=COALESCE($4,ciudad),tipo=COALESCE($5,tipo),logo_url=COALESCE($6,logo_url),updated_at=NOW() WHERE id=$7 RETURNING *`, [nombre, telefono, email, ciudad, tipo, logo_url, id])
      return res.status(200).json({ success: true, data: u })
    }
    return res.status(405).end()
  }

  // /api/superadmin/*
  const auth = await requireSuperAdmin(req, res)
  if (!auth) return

  const parts = urlPath.split('/').filter(Boolean)
  // /api/superadmin/empresas → parts=['api','superadmin','empresas']
  // /api/superadmin/empresas/ID → parts=['api','superadmin','empresas','ID']
  const id = parts.length >= 4 ? parts[3] : null

  console.log('superadmin - parts:', parts, 'id:', id)

  if (!id) {
    if (req.method === 'GET') {
      try {
        const rows = await query(`SELECT e.*, (SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id=e.id AND u.activo=true) as total_usuarios FROM empresas e ORDER BY e.created_at DESC`)
        console.log('empresas encontradas:', rows.length)
        return res.status(200).json({ success: true, data: rows })
      } catch (err: any) {
        console.error('GET empresas error:', err.message)
        return res.status(500).json({ success: false, message: err.message })
      }
    }

    if (req.method === 'POST') {
      console.log('POST crear empresa - body:', JSON.stringify(req.body))
      const { nombre, nit, telefono, email, ciudad, tipo, licencia_inicio, licencia_fin, admin_nombre, admin_email, admin_username, admin_password } = req.body ?? {}
      if (!nombre || !admin_email || !admin_password) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos: nombre, admin_email, admin_password' })
      }
      try {
        const eid = uuid()
        const slug = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + eid.slice(0, 6)
        
        await query(`INSERT INTO empresas (id,nombre,slug,nit,telefono,email,ciudad,tipo,activa) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
          [eid, nombre, slug, nit || null, telefono || null, email || null, ciudad || null, tipo || 'restaurante'])
        
        const ar = await queryOne(`SELECT id FROM roles WHERE nombre='admin'`)
        if (!ar) throw new Error('Rol admin no existe en la base de datos')
        
        const hash = await bcrypt.hash(admin_password, 12)
        const uname = (admin_username || admin_email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]/g, '')
        
        await query(`INSERT INTO usuarios (id,empresa_id,rol_id,nombre,email,username,password_hash,activo) VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
          [uuid(), eid, ar.id, admin_nombre || 'Administrador', admin_email.toLowerCase(), uname, hash])
        
        const empresa = await queryOne(`SELECT * FROM empresas WHERE id=$1`, [eid])
        console.log('Empresa creada:', empresa?.nombre)
        return res.status(201).json({ success: true, data: empresa })
      } catch (err: any) {
        console.error('POST empresa error:', err.message)
        return res.status(500).json({ success: false, message: err.message })
      }
    }
  } else {
    const e = await queryOne(`SELECT * FROM empresas WHERE id=$1`, [id])
    if (!e) return res.status(404).json({ success: false, message: 'Empresa no encontrada' })
    if (req.method === 'GET') {
      const usuarios = await query(`SELECT u.id,u.nombre,u.email,u.username,u.activo,r.nombre as rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.empresa_id=$1`, [id])
      return res.status(200).json({ success: true, data: { ...e, usuarios } })
    }
    if (req.method === 'PATCH') {
      const { activa, nombre, telefono, email, ciudad, tipo } = req.body ?? {}
      const [u] = await query(`UPDATE empresas SET activa=COALESCE($1,activa),nombre=COALESCE($2,nombre),telefono=COALESCE($3,telefono),email=COALESCE($4,email),ciudad=COALESCE($5,ciudad),tipo=COALESCE($6,tipo),updated_at=NOW() WHERE id=$7 RETURNING *`,
        [activa, nombre, telefono, email, ciudad, tipo, id])
      return res.status(200).json({ success: true, data: u })
    }
  }
  return res.status(405).end()
}
