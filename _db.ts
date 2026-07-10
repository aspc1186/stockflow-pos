import { Pool } from 'pg'

let pool: any = null

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5
    })
  }
  return pool
}

async function query(sql: string, params?: any[]): Promise<any[]> {
  const client = await getPool().connect()
  try {
    const r = await client.query(sql, params)
    return r.rows
  } catch(e) {
    throw e
  } finally {
    client.release()
  }
}

async function queryOne(sql: string, params?: any[]): Promise<any | null> {
  const rows = await query(sql, params)
  return rows[0] ?? null
}

export { query, queryOne }
