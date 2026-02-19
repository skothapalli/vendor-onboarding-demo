import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from './auth.middleware';
import { logger } from '../../utils/logger';

export interface AuditContext {
  correlationId: string;
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent?: string;
  method: string;
  path: string;
  timestamp: Date;
}

export const auditMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  req.correlationId = correlationId;

  res.setHeader('x-correlation-id', correlationId);

  const auditContext: AuditContext = {
    correlationId,
    userId: req.user?.userId,
    userEmail: req.user?.email,
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'],
    method: req.method,
    path: req.path,
    timestamp: new Date(),
  };

  (req as AuthenticatedRequest & { auditContext: AuditContext }).auditContext = auditContext;

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      ...auditContext,
      statusCode: res.statusCode,
      duration,
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'Request completed with error');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'Request completed with client error');
    } else {
      logger.info(logData, 'Request completed');
    }
  });

  next();
};

export const sensitiveOperationAudit = (operationType: string) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    logger.info(
      {
        correlationId: req.correlationId,
        userId: req.user?.userId,
        operationType,
        path: req.path,
        method: req.method,
      },
      `Sensitive operation: ${operationType}`
    );
    next();
  };
};
