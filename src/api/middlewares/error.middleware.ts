import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { AuthenticatedRequest } from './auth.middleware';

interface ErrorResponse {
  code: string;
  message: string;
  correlationId?: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const correlationId = (req as AuthenticatedRequest).correlationId;

  logger.error(
    {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      correlationId,
      path: req.path,
      method: req.method,
    },
    'Error occurred'
  );

  if (error instanceof AppError) {
    const response: ErrorResponse = {
      code: error.code,
      message: error.message,
      correlationId,
    };

    if (error.details) {
      response.details = error.details;
    }

    res.status(error.statusCode).json(response);
    return;
  }

  const response: ErrorResponse = {
    code: 'VOMS-5000',
    message: config.env === 'production' ? 'Internal server error' : error.message,
    correlationId,
  };

  if (config.env !== 'production') {
    response.stack = error.stack;
  }

  res.status(500).json(response);
};

export const notFoundMiddleware = (req: Request, res: Response): void => {
  res.status(404).json({
    code: 'VOMS-4040',
    message: `Route ${req.method} ${req.path} not found`,
  });
};
