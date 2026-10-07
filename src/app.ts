import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { corsMiddleware } from './config/cors';
import { requestLogger } from './middleware/requestLogger.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import { apiRateLimiter } from './middleware/rateLimiter.middleware';
import masterRouter from './routes';
import { ApiResponse } from './utils/response.util';

const app: Application = express();

// Trust the first proxy hop (GCP Load Balancer / Cloud Run).
// This ensures req.ip returns the real client IP from X-Forwarded-For,
// which is required for correct Redis-backed rate limiting.
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(corsMiddleware);

// Gzip compression
app.use(compression());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP logging
app.use(requestLogger);

import path from 'path';

// Serve uploaded static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate limiting on API routes
app.use('/api', apiRateLimiter);

// Master API routes mounted at /api/v1 and /api
app.use('/api/v1', masterRouter);
app.use('/api', masterRouter);

import { config } from './config';

// Root health check endpoint for Cloud Run and load balancers
app.get(['/', '/health'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'knotnex-api',
    environment: config.env,
    version: 'v1',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 404 Handler for undefined routes
app.use((req: Request, res: Response) => {
  return ApiResponse.error(res, `Route ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND');
});

// Global error handling middleware
app.use(errorHandler);

export default app;
