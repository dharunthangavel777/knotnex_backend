import { Router } from 'express';
import { ApiResponse } from '../utils/response.util';
import { pool, query } from '../config/database';
import { runMigrations } from '../db/migrate';

const router = Router();

router.get('/', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const client = await pool.connect();
    client.release();
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  return ApiResponse.success(res, {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      api: 'operational',
      database: dbStatus,
    },
  }, 'Knotnex API service is healthy');
});

router.get('/migrations', async (req, res) => {
  try {
    const migrationsRes = await query('SELECT name, applied_at FROM schema_migrations ORDER BY id ASC');
    return ApiResponse.success(res, {
      appliedCount: migrationsRes.rows.length,
      migrations: migrationsRes.rows,
    });
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

router.post('/migrations/run', async (req, res) => {
  const authKey = req.headers['x-admin-key'] || req.body?.secret;
  if (authKey !== 'knotnex-admin-migrate-2026') {
    return ApiResponse.error(res, 'Unauthorized migration trigger', 401);
  }

  try {
    const result = await runMigrations();
    return ApiResponse.success(res, result, 'Automated Cloud SQL migration completed successfully');
  } catch (err: any) {
    return ApiResponse.error(res, `Migration execution failed: ${err.message}`, 500);
  }
});

export default router;
