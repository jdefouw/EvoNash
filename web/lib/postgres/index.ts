// PostgreSQL client library for EvoNash
// Replaces Supabase client with direct PostgreSQL connections

export {
  query,
  queryOne,
  queryAll,
  insertOne,
  insertMany,
  update,
  deleteRows,
  rpc,
  count,
  getClient,
  transaction,
  healthCheck,
  getPool
} from './pool'
