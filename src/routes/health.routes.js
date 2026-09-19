const express = require('express');
const router = express.Router();

/**
 * @route   GET /health or /api/health
 * @desc    Main service health check with mock service statuses
 * @access  Public
 */
router.get('/', (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  res.status(200).json({
    status: 'ok',
    service: 'knotnex-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    uptimeSeconds,
    environment: process.env.NODE_ENV || 'development',
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      memoryUsage: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      },
    },
    // Mocked service dependencies for integration testing
    dependencies: {
      database: {
        name: 'MongoDB',
        status: 'healthy (mocked)',
        latency: '2ms',
      },
      cache: {
        name: 'Redis',
        status: 'healthy (mocked)',
        latency: '1ms',
      },
      authService: {
        name: 'JWT Auth',
        status: 'operational (mocked)',
      },
    },
  });
});

/**
 * @route   GET /health/mock or /api/health/mock
 * @desc    Mock endpoint for testing failure states, latency, or specific health scenarios
 * @access  Public
 */
router.get('/mock', async (req, res) => {
  const { status = 'ok', delay = 0 } = req.query;

  if (Number(delay) > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(Number(delay), 5000)));
  }

  if (status === 'down') {
    return res.status(503).json({
      status: 'error',
      message: 'Mock Service Unavailable (Simulated)',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: { status: 'down (mocked)' },
        cache: { status: 'down (mocked)' },
      },
    });
  }

  if (status === 'degraded') {
    return res.status(200).json({
      status: 'degraded',
      message: 'Mock Service Degraded (Simulated)',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: { status: 'slow (mocked)', latency: '3500ms' },
        cache: { status: 'healthy (mocked)', latency: '1ms' },
      },
    });
  }

  return res.status(200).json({
    status: 'ok',
    message: 'Mock health check successful',
    timestamp: new Date().toISOString(),
    mockData: {
      activeConnections: 42,
      pendingTasks: 3,
      simulation: 'healthy',
    },
  });
});

module.exports = router;
