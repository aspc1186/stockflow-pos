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

async function transaction<T>(work: (client: any) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export { query, queryOne, transaction }
