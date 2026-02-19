import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import 'express-async-errors';

import { config } from './config';
import { logger } from './utils/logger';
import { apiRoutes } from './api/routes';
import { errorMiddleware, notFoundMiddleware } from './api/middlewares/error.middleware';
import { auditMiddleware } from './api/middlewares/audit.middleware';
import { defaultRateLimiter } from './api/middlewares/rate-limit.middleware';

export function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    })
  );

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // Logging
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/v1/health/live',
      },
    })
  );

  // Rate limiting
  app.use(defaultRateLimiter);

  // Audit middleware
  app.use(auditMiddleware as express.RequestHandler);

  // API routes
  app.use(`/api/${config.apiVersion}`, apiRoutes);

  // Error handling
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
