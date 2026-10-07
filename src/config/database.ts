import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { config } from './index';
import { logger } from './logger';

const poolConfig: PoolConfig = {
  connectionString: config.database.url,
  min: config.database.poolMin,
  max: config.database.poolMax,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
};

export const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.info('Connected to PostgreSQL (Cloud SQL)');
});

pool.on('error', (err: Error) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
});

export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (config.env === 'development') {
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error: any) {
    logger.error('Database query failed', { text, error: error.message });
    throw error;
  }
};

export const getClient = async () => {
  const client = await pool.connect();
  return client;
};
