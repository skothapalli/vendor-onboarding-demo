import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.logging.level,
  transport:
    config.env === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    env: config.env,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

export type Logger = typeof logger;
