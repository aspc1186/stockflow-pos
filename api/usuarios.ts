const bcrypt = require('bcryptjs')
const { v4: uuid } = require('uuid')
const { query, queryOne } = require('../_db')
const { authenticate, cors } = require('../_auth')

module.exports = async function(req: any, res: any) {
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
      const { nombre,email,username,password,rol_id,telefono } = req.body||{}
      if (!nombre||!password||!rol_id) return res.status(400).json({ ok:false, msg:'Campos requeridos: nombre, password, rol_id' })
      const hash=await bcrypt.hash(password,12)
      const uname=(username||email?.split('@')[0]||nombre.toLowerCase()).replace(/[^a-z0-9._]/gi,'').toLowerCase()
      try {
        const [u]=await query(`INSERT INTO usuarios (id,empresa_id,rol_id,nombre,email,username,password_hash,telefono,activo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING id,nombre,email,username,activo`,[uuid(),eid,rol_id,nombre,email?.toLowerCase()||null,uname,hash,telefono||null])
        return res.status(201).json({ ok:true, data:u })
      } catch(e: any) { return res.status(500).json({ ok:false, msg:e.message }) }
    }
  } else {
    const u=await queryOne(`SELECT * FROM usuarios WHERE id=$1 AND empresa_id=$2`,[id,eid])
    if (!u) return res.status(404).json({ ok:false, msg:'Usuario no encontrado' })
    if (req.method==='PATCH') {
      const { nombre,telefono,activo,rol_id,password } = req.body||{}
      const ups:string[]=[],params:any[]=[]; let idx=1
      if (nombre!==undefined){ups.push(`nombre=$${idx++}`);params.push(nombre)}
      if (telefono!==undefined){ups.push(`telefono=$${idx++}`);params.push(telefono)}
      if (activo!==undefined){ups.push(`activo=$${idx++}`);params.push(activo)}
      if (rol_id!==undefined){ups.push(`rol_id=$${idx++}`);params.push(rol_id)}
      if (password){const h=await bcrypt.hash(password,12);ups.push(`password_hash=$${idx++}`);params.push(h)}
      if (!ups.length) return res.status(400).end()
      ups.push('updated_at=NOW()'); params.push(id)
      const [updated]=await query(`UPDATE usuarios SET ${ups.join(',')} WHERE id=$${idx} RETURNING id,nombre,email,username,activo`,params)
      return res.status(200).json({ ok:true, data:updated })
    }
  }
  return res.status(405).end()
}

export {}
