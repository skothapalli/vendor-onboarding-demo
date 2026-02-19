import { Router, Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma';
import { getRedisClient } from '../../infrastructure/cache/redis';

const router = Router();

router.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'connected';
  } catch {
    checks.database = 'disconnected';
    healthy = false;
  }

  // Check Redis
  try {
    const redis = getRedisClient();
    await redis.ping();
    checks.cache = 'connected';
  } catch {
    checks.cache = 'disconnected';
    healthy = false;
  }

  const statusCode = healthy ? 200 : 503;

  res.status(statusCode).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

export { router as healthRoutes };
