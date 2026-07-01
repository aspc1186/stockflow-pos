const { requireAuth, cors } = require('../_auth')
const { query } = require('../_db')
const { v4: uuid } = require('uuid')

module.exports = async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const auth = await requireAuth(req, res)
  if (!auth || !auth.empresa_id) return
  const eid = auth.empresa_id
  const urlPath = (req.url || '').split('?')[0]
  const modulo = urlPath.split('/')[2]
  const tablas: any = { zonas: 'zonas', categorias: 'categorias', clientes: 'clientes' }
  const tabla = tablas[modulo]
  if (!tabla) return res.status(404).end()

  if (req.method === 'GET') {
    const { search } = req.query || {}
    let where = `empresa_id=$1`
    const params: any[] = [eid]
    if (search && modulo === 'clientes') { where += ` AND (nombre ILIKE $2 OR telefono ILIKE $2)`; params.push(`%${search}%`) }
    const rows = await query(`SELECT * FROM ${tabla} WHERE ${where} ORDER BY nombre LIMIT 200`, params)
    return res.status(200).json({ success: true, data: rows })
  }
  if (req.method === 'POST') {
    const { nombre, ...rest } = req.body ?? {}
    if (!nombre) return res.status(400).json({ success: false, message: 'Nombre requerido' })
    const keys = ['id', 'empresa_id', 'nombre', ...Object.keys(rest)]
    const vals = [uuid(), eid, nombre, ...Object.values(rest)]
    const placeholders = vals.map((_: any, i: number) => `$${i + 1}`).join(',')
    try {
      const [row] = await query(`INSERT INTO ${tabla} (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`, vals)
      return res.status(201).json({ success: true, data: row })
    } catch (e: any) { return res.status(500).json({ success: false, message: e.message }) }
  }
  return res.status(405).end()
}
