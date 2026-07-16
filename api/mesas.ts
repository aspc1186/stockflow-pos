import { v4 as uuid } from 'uuid'
import { query, queryOne } from '../_db.js'
import { authenticate, cors } from '../_auth.js'

let schemaReady: Promise<void> | null = null

function ensureMesasSchema() {
  if (!schemaReady) schemaReady = query(`
    ALTER TABLE mesas
      ADD COLUMN IF NOT EXISTS mesero_id UUID,
      ADD COLUMN IF NOT EXISTS consumo_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pos_x NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pos_y NUMERIC(12,2) NOT NULL DEFAULT 0
  `).then(() => undefined)
  return schemaReady
}

function puedeAdministrarMesas(rol: string) {
  return ['admin', 'supervisor', 'superadmin'].includes(rol)
}

function separarNumero(valor: unknown) {
  const texto = String(valor ?? '').trim()
  const coincidencia = texto.match(/^(.*?)(\d+)$/)
  return { prefijo: coincidencia?.[1] ?? '', numero: coincidencia ? Number(coincidencia[2]) : 0, texto }
}

function siguienteNumero(mesas: any[]) {
  const partes = mesas.map(mesa => separarNumero(mesa.numero)).filter(parte => parte.numero > 0)
  const prefijos = new Map<string, number>()
  partes.forEach(parte => prefijos.set(parte.prefijo, (prefijos.get(parte.prefijo) || 0) + 1))
  const prefijo = [...prefijos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  const usados = new Set(partes.filter(parte => parte.prefijo === prefijo).map(parte => parte.numero))
  let numero = 1
  while (usados.has(numero)) numero += 1
  return `${prefijo}${numero}`
}

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await authenticate(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  const parts = (req.url||'').split('?')[0].split('/').filter(Boolean)
  const id = parts[2] || null
  const esAsignacionDirecta = req.method === 'PATCH' && ((id && Object.keys(req.body || {}).length === 1 && Object.prototype.hasOwnProperty.call(req.body || {}, 'mesero_id')) || (!id && req.body?.asignar_todas === true))
  if (!esAsignacionDirecta) await ensureMesasSchema()

  const validarResponsable = async (responsableId: string | null | undefined) => {
    if (!responsableId) return true
    const responsable = await queryOne(
      `SELECT u.id FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=$1 AND u.empresa_id=$2 AND u.activo=true AND LOWER(TRIM(r.nombre)) IN ('mesero','cajero','barra')`,
      [responsableId, eid]
    )
    return !!responsable
  }

  if (!id) {
    if (req.method === 'GET') {
      const esOperativo = !puedeAdministrarMesas(auth.rol)
      const rows = await query(
        `SELECT m.*,z.nombre as zona_nombre,
         p.id as pedido_id,p.estado as pedido_estado,p.total as pedido_total,p.apertura_at,
         u.nombre as mesero_nombre,
         asignado.nombre as mesero_asignado_nombre
         FROM mesas m
         LEFT JOIN zonas z ON z.id=m.zona_id
         LEFT JOIN pedidos p ON p.mesa_id=m.id AND p.estado NOT IN ('cobrado','cancelado')
         LEFT JOIN usuarios u ON u.id=p.usuario_id
         LEFT JOIN usuarios asignado ON asignado.id=m.mesero_id
         WHERE m.empresa_id=$1 AND m.activa=true AND ($2::boolean=false OR m.mesero_id=$3)
         ORDER BY NULLIF(regexp_replace(m.numero::text,'\\D','','g'),'')::integer NULLS LAST,m.numero`, [eid, esOperativo, auth.id])
      return res.status(200).json({ ok: true, data: rows })
    }
    if (req.method === 'POST') {
      if (!puedeAdministrarMesas(auth.rol)) return res.status(403).json({ ok: false, msg: 'Sin permisos para crear mesas' })
      if (req.body?.accion === 'renumerar') {
        const mesas = await query(`SELECT id,numero FROM mesas WHERE empresa_id=$1 AND activa=true`, [eid])
        const prefijos = new Map<string, number>()
        mesas.map(mesa => separarNumero(mesa.numero)).filter(parte => parte.numero > 0).forEach(parte => prefijos.set(parte.prefijo, (prefijos.get(parte.prefijo) || 0) + 1))
        const prefijo = [...prefijos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
        const ordenadas = [...mesas].sort((a, b) => {
          const primera = separarNumero(a.numero), segunda = separarNumero(b.numero)
          return primera.numero - segunda.numero || primera.texto.localeCompare(segunda.texto)
        })
        await query(`UPDATE mesas SET numero=CONCAT('_r_',substring(id::text,1,16)) WHERE empresa_id=$1 AND activa=true`, [eid])
        for (const [indice, mesa] of ordenadas.entries()) await query(`UPDATE mesas SET numero=$1 WHERE id=$2 AND empresa_id=$3`, [`${prefijo}${indice + 1}`, mesa.id, eid])
        return res.status(200).json({ ok: true, data: ordenadas.length })
      }
      const { zona_id, numero, nombre, capacidad, tipo, consumo_minimo, pos_x, pos_y } = req.body||{}
      const existentes = await query(`SELECT numero FROM mesas WHERE empresa_id=$1 AND activa=true`, [eid])
      const numeroFinal = String(numero || siguienteNumero(existentes)).trim()
      if (!numeroFinal) return res.status(400).json({ ok: false, msg: 'No fue posible calcular el numero de mesa' })
      const repetida = existentes.some(mesa => String(mesa.numero).trim().toLowerCase() === numeroFinal.toLowerCase())
      if (repetida) return res.status(409).json({ ok: false, msg: `La mesa ${numeroFinal} ya existe` })
      try {
        const [m] = await query(
          `INSERT INTO mesas (id,empresa_id,zona_id,numero,nombre,capacidad,tipo,consumo_minimo,pos_x,pos_y,estado,activa)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'libre',true) RETURNING *`,
          [uuid(),eid,zona_id||null,numeroFinal,nombre||null,capacidad||4,tipo||'mesa',consumo_minimo||0,pos_x||0,pos_y||0])
        return res.status(201).json({ ok: true, data: m })
      } catch(e: any) { return res.status(500).json({ ok: false, msg: e.message }) }
    }
    if (req.method === 'PATCH' && req.body?.asignar_todas === true) {
      if (!puedeAdministrarMesas(auth.rol)) return res.status(403).json({ ok: false, msg: 'Sin permisos para asignar mesas' })
      const responsableId = req.body.mesero_id || null
      if (!(await validarResponsable(responsableId))) return res.status(400).json({ ok: false, msg: 'Selecciona un responsable operativo activo de esta empresa' })
      const mesas = await query(
        `UPDATE mesas SET mesero_id=$1 WHERE empresa_id=$2 AND activa=true RETURNING id,mesero_id`,
        [responsableId, eid]
      )
      return res.status(200).json({ ok: true, data: mesas })
    }
  } else {
    const mesa = await queryOne(`SELECT * FROM mesas WHERE id=$1 AND empresa_id=$2`, [id,eid])
    if (!mesa) return res.status(404).json({ ok: false, msg: 'Mesa no encontrada' })
    if (!puedeAdministrarMesas(auth.rol) && mesa.mesero_id !== auth.id) return res.status(403).json({ ok: false, msg: 'Esta mesa no esta asignada a tu usuario' })
    if (req.method === 'GET') return res.status(200).json({ ok: true, data: mesa })
    if (req.method === 'PATCH') {
      if (!puedeAdministrarMesas(auth.rol)) return res.status(403).json({ ok: false, msg: 'Sin permisos para modificar mesas' })
      const { estado, numero, nombre, capacidad, activa, zona_id, consumo_minimo, pos_x, pos_y, mesero_id } = req.body||{}
      const cambiaMesero = Object.prototype.hasOwnProperty.call(req.body || {}, 'mesero_id')
      const cambiaNumero = Object.prototype.hasOwnProperty.call(req.body || {}, 'numero')
      if (cambiaMesero && mesero_id) {
        if (!(await validarResponsable(mesero_id))) return res.status(400).json({ ok: false, msg: 'Selecciona un responsable operativo activo de esta empresa' })
      }
      try {
        if (cambiaNumero) {
          const numeroFinal = String(numero || '').trim()
          if (!numeroFinal) return res.status(400).json({ ok: false, msg: 'El numero de mesa es requerido' })
          const repetida = await queryOne(`SELECT id FROM mesas WHERE empresa_id=$1 AND activa=true AND LOWER(TRIM(numero::text))=LOWER($2) AND id<>$3`, [eid, numeroFinal, id])
          if (repetida) return res.status(409).json({ ok: false, msg: `La mesa ${numeroFinal} ya existe` })
        }
        const soloAsignacion = cambiaMesero && !cambiaNumero && estado === undefined && nombre === undefined && capacidad === undefined && activa === undefined && zona_id === undefined && consumo_minimo === undefined && pos_x === undefined && pos_y === undefined
        if (soloAsignacion) {
          const [asignada] = await query(`UPDATE mesas SET mesero_id=$1 WHERE id=$2 AND empresa_id=$3 RETURNING *`, [mesero_id || null, id, eid])
          return res.status(200).json({ ok: true, data: asignada })
        }
        const [u] = await query(
          `UPDATE mesas SET estado=COALESCE($1,estado),numero=CASE WHEN $2::boolean THEN $3 ELSE numero END,nombre=COALESCE($4,nombre),capacidad=COALESCE($5,capacidad),activa=COALESCE($6,activa),zona_id=COALESCE($7,zona_id),consumo_minimo=COALESCE($8,consumo_minimo),pos_x=COALESCE($9,pos_x),pos_y=COALESCE($10,pos_y),mesero_id=CASE WHEN $11::boolean THEN $12 ELSE mesero_id END WHERE id=$13 AND empresa_id=$14 RETURNING *`,
          [estado,cambiaNumero,String(numero || '').trim(),nombre,capacidad,activa,zona_id,consumo_minimo,pos_x,pos_y,cambiaMesero,mesero_id || null,id,eid])
        return res.status(200).json({ ok: true, data: u })
      } catch (e: any) { return res.status(500).json({ ok: false, msg: `No fue posible guardar la asignacion: ${e.message}` }) }
    }
    if (req.method === 'DELETE') {
      if (!puedeAdministrarMesas(auth.rol)) return res.status(403).json({ ok: false, msg: 'Sin permisos para eliminar mesas' })
      await query(`UPDATE mesas SET activa=false WHERE id=$1 AND empresa_id=$2`, [id,eid])
      return res.status(200).json({ ok: true })
    }
  }
  return res.status(405).end()
}
