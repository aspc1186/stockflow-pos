const { requireAuth, requireSuperAdmin, cors } = require('../_auth')
const { query, queryOne } = require('../_db')
const bcrypt = require('bcryptjs')
const { v4: uuid } = require('uuid')

module.exports = async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  // TODO: implementar rutas de inventario
  return res.status(200).json({ success: true, data: [] })
}
