import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

const ROLES_PERMITIDOS = ['admin', 'supervisor', 'cajero', 'mesero', 'barra', 'cocina']

function cleanUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  if (!['admin','supervisor'].includes(auth.rol)) return res.status(403).json({ ok:false, msg:'Sin permisos' })
  const eid = auth.empresa_id
  const parts=(req.url||'').split('?')[0].split('/').filter(Boolean)
  const id=parts[2]||null

  if (!id) {
    if (req.method==='GET') {
      const rows=await query(`SELECT u.id,u.nombre,u.email,u.username,u.telefono,u.activo,u.ultimo_acceso,r.nombre as rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.empresa_id=$1 ORDER BY u.nombre`,[eid])
      return res.status(200).json({ ok:true, data:rows })
    }
    if (req.method==='POST') {
      const { nombre,email,username,password,rol_id,rol,telefono } = req.body||{}
      const rolNombre = String(rol || rol_id || '').trim().toLowerCase()
      if (!nombre || !password || !rolNombre) return res.status(400).json({ ok:false, msg:'Campos requeridos: nombre, password y rol' })
      if (!ROLES_PERMITIDOS.includes(rolNombre)) return res.status(400).json({ ok:false, msg:'Rol no permitido' })
      if (String(password).length < 6) return res.status(400).json({ ok:false, msg:'La contraseña debe tener al menos 6 caracteres' })

      const roleRow = await queryOne(`SELECT id,nombre FROM roles WHERE nombre=$1`, [rolNombre])
      if (!roleRow) return res.status(400).json({ ok:false, msg:`Rol no existe en la base: ${rolNombre}` })

      const baseUsername = username || email?.split('@')[0] || nombre
      const uname = cleanUsername(baseUsername)
      if (!uname) return res.status(400).json({ ok:false, msg:'Username invalido' })

      const existing = await queryOne(`SELECT id FROM usuarios WHERE empresa_id=$1 AND LOWER(username)=LOWER($2)`, [eid, uname])
      if (existing) return res.status(409).json({ ok:false, msg:'Ya existe un usuario con ese username' })

      const hash=await bcrypt.hash(String(password),12)
      try {
        const [u]=await query(
          `INSERT INTO usuarios (id,empresa_id,rol_id,nombre,email,username,password_hash,telefono,activo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING id,nombre,email,username,telefono,activo`,
          [uuid(),eid,roleRow.id,String(nombre).trim(),email?.toLowerCase()||null,uname,hash,telefono||null]
        )
        return res.status(201).json({ ok:true, data:{...u, rol: roleRow.nombre} })
      } catch(e: any) { return res.status(500).json({ ok:false, msg:e.message }) }
    }
  } else {
    const u=await queryOne(`SELECT * FROM usuarios WHERE id=$1 AND empresa_id=$2`,[id,eid])
    if (!u) return res.status(404).json({ ok:false, msg:'Usuario no encontrado' })
    if (req.method==='PATCH') {
      const { nombre,telefono,activo,rol_id,rol,password } = req.body||{}
      const ups:string[]=[],params:any[]=[]; let idx=1
      if (nombre!==undefined){ups.push(`nombre=$${idx++}`);params.push(nombre)}
      if (telefono!==undefined){ups.push(`telefono=$${idx++}`);params.push(telefono)}
      if (activo!==undefined){ups.push(`activo=$${idx++}`);params.push(activo)}
      const rolNombre = rol || rol_id
      if (rolNombre!==undefined){
        const roleRow = await queryOne(`SELECT id FROM roles WHERE nombre=$1`, [String(rolNombre).trim().toLowerCase()])
        if (!roleRow) return res.status(400).json({ ok:false, msg:'Rol no existe' })
        ups.push(`rol_id=$${idx++}`);params.push(roleRow.id)
      }
      if (password){
        if (String(password).length < 6) return res.status(400).json({ ok:false, msg:'La contraseña debe tener al menos 6 caracteres' })
        const h=await bcrypt.hash(String(password),12);ups.push(`password_hash=$${idx++}`);params.push(h)
      }
      if (!ups.length) return res.status(400).end()
      ups.push('updated_at=NOW()'); params.push(id,eid)
      const [updated]=await query(`UPDATE usuarios SET ${ups.join(',')} WHERE id=$${idx++} AND empresa_id=$${idx} RETURNING id,nombre,email,username,telefono,activo`,params)
      return res.status(200).json({ ok:true, data:updated })
    }
  }
  return res.status(405).end()
}