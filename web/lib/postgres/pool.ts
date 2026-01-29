import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

// Create a singleton connection pool
let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    
    if (!connectionString) {
      throw new Error(
        'Missing DATABASE_URL environment variable. ' +
        'Please configure DATABASE_URL in your .env file.'
      )
    }
    
    pool = new Pool({
      connectionString,
      // Connection pool settings optimized for serverless
      max: 10,                    // Maximum connections in pool
      idleTimeoutMillis: 30000,   // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Timeout for new connections
    })
    
    // Log pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }
  
  return pool
}

/**
 * Execute a query with parameters
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool()
  const start = Date.now()
  
  try {
    const result = await pool.query<T>(text, params)
    const duration = Date.now() - start
    
    // Log slow queries in development
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.log('Slow query:', { text: text.substring(0, 100), duration, rows: result.rowCount })
    }
    
    return result
  } catch (error) {
    console.error('Database query error:', { text: text.substring(0, 100), error })
    throw error
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool()
  return pool.connect()
}

/**
 * Execute a transaction with automatic commit/rollback
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Execute a single query and return the first row, or null if no rows
 */
export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(text, params)
  return result.rows[0] || null
}

/**
 * Execute a single query and return all rows
 */
export async function queryAll<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await query<T>(text, params)
  return result.rows
}

/**
 * Execute an INSERT and return the inserted row
 */
export async function insertOne<T extends QueryResultRow = any>(
  table: string,
  data: Record<string, any>
): Promise<T> {
  const keys = Object.keys(data)
  const values = Object.values(data)
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
  const columns = keys.join(', ')
  
  const text = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`
  const result = await query<T>(text, values)
  
  if (result.rows.length === 0) {
    throw new Error(`Insert into ${table} returned no rows`)
  }
  
  return result.rows[0]
}

/**
 * Execute an INSERT for multiple rows
 */
export async function insertMany<T extends QueryResultRow = any>(
  table: string,
  dataArray: Record<string, any>[]
): Promise<T[]> {
  if (dataArray.length === 0) {
    return []
  }
  
  const keys = Object.keys(dataArray[0])
  const columns = keys.join(', ')
  
  // Build values placeholders: ($1, $2, $3), ($4, $5, $6), ...
  const allValues: any[] = []
  const valuePlaceholders = dataArray.map((data, rowIndex) => {
    const rowPlaceholders = keys.map((key, colIndex) => {
      allValues.push(data[key])
      return `$${rowIndex * keys.length + colIndex + 1}`
    })
    return `(${rowPlaceholders.join(', ')})`
  }).join(', ')
  
  const text = `INSERT INTO ${table} (${columns}) VALUES ${valuePlaceholders} RETURNING *`
  const result = await query<T>(text, allValues)
  
  return result.rows
}

/**
 * Execute an UPDATE and return affected rows
 */
export async function update<T extends QueryResultRow = any>(
  table: string,
  data: Record<string, any>,
  whereClause: string,
  whereParams: any[] = []
): Promise<T[]> {
  const keys = Object.keys(data)
  const values = Object.values(data)
  
  // Build SET clause: column1 = $1, column2 = $2, ...
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')
  
  // Adjust where parameter placeholders to continue from data params
  const adjustedWhereClause = whereClause.replace(/\$(\d+)/g, (_, num) => 
    `$${parseInt(num) + keys.length}`
  )
  
  const text = `UPDATE ${table} SET ${setClause} WHERE ${adjustedWhereClause} RETURNING *`
  const result = await query<T>(text, [...values, ...whereParams])
  
  return result.rows
}

/**
 * Execute a DELETE and return affected row count
 */
export async function deleteRows(
  table: string,
  whereClause: string,
  whereParams: any[] = []
): Promise<number> {
  const text = `DELETE FROM ${table} WHERE ${whereClause}`
  const result = await query(text, whereParams)
  return result.rowCount || 0
}

/**
 * Call a PostgreSQL function
 */
export async function rpc<T = any>(
  functionName: string,
  params: Record<string, any> = {}
): Promise<T> {
  const paramNames = Object.keys(params)
  const paramValues = Object.values(params)
  
  // Build function call: function_name($1, $2, ...)
  // Named parameters: function_name(p_param1 := $1, p_param2 := $2, ...)
  const paramList = paramNames.map((name, i) => `${name} := $${i + 1}`).join(', ')
  
  const text = `SELECT ${functionName}(${paramList}) as result`
  const result = await query(text, paramValues)
  
  return result.rows[0]?.result
}

/**
 * Count rows matching a condition
 */
export async function count(
  table: string,
  whereClause?: string,
  whereParams: any[] = []
): Promise<number> {
  let text = `SELECT COUNT(*) as count FROM ${table}`
  if (whereClause) {
    text += ` WHERE ${whereClause}`
  }
  
  const result = await query(text, whereParams)
  return parseInt(result.rows[0].count, 10)
}

/**
 * Check if the database connection is working
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1')
    return true
  } catch {
    return false
  }
}

// Export pool getter for advanced use cases
export { getPool }
