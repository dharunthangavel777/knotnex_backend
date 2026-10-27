import cors from 'cors';
import { config } from './index';

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow mobile apps, curl, server-to-server requests with no origin
    if (!origin) return callback(null, true);

    if (
      config.corsOrigins.includes('*') ||
      config.corsOrigins.includes(origin) ||
      origin.endsWith('.knotnex.com') ||
      origin.includes('run.app') ||
      /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|\d+\.\d+\.\d+\.\d+):\d+$/.test(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
};

export const corsMiddleware = cors(corsOptions);
