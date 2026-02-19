import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  database: {
    url: process.env.DATABASE_URL || '',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || '32-byte-encryption-key-here!!!!',
  },

  storage: {
    endpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:4566',
    bucket: process.env.STORAGE_BUCKET || 'voms-documents',
    accessKey: process.env.STORAGE_ACCESS_KEY || 'test',
    secretKey: process.env.STORAGE_SECRET_KEY || 'test',
    region: process.env.STORAGE_REGION || 'us-east-1',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },

  resubmission: {
    maxAttempts: parseInt(process.env.RESUBMISSION_MAX_ATTEMPTS || '3', 10),
    cooldownDays: parseInt(process.env.RESUBMISSION_COOLDOWN_DAYS || '7', 10),
  },

  sla: {
    approvalHours: parseInt(process.env.SLA_APPROVAL_HOURS || '48', 10),
    escalationHours: parseInt(process.env.SLA_ESCALATION_HOURS || '72', 10),
  },
} as const;

export type Config = typeof config;
