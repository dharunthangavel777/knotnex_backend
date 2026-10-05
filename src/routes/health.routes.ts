import { Router } from 'express';
import { ApiResponse } from '../utils/response.util';
import { pool } from '../config/database';

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

export default router;
