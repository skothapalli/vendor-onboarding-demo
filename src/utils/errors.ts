export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VOMS-4000', 400, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'VOMS-4010', 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'VOMS-4030', 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 'VOMS-4040', 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'VOMS-4090', 409, true);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 'VOMS-4290', 429, true);
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 'VOMS-5000', 500, false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 'VOMS-5030', 503, true);
  }
}

export const ERROR_CODES = {
  // Authentication errors (401x)
  INVALID_CREDENTIALS: 'VOMS-4011',
  TOKEN_EXPIRED: 'VOMS-4012',
  TOKEN_INVALID: 'VOMS-4013',
  MFA_REQUIRED: 'VOMS-4014',
  ACCOUNT_LOCKED: 'VOMS-4015',

  // Authorization errors (403x)
  INSUFFICIENT_PERMISSIONS: 'VOMS-4031',
  RESOURCE_ACCESS_DENIED: 'VOMS-4032',

  // Validation errors (400x)
  INVALID_INPUT: 'VOMS-4001',
  MISSING_REQUIRED_FIELD: 'VOMS-4002',
  INVALID_FORMAT: 'VOMS-4003',

  // Business logic errors (422x)
  INVALID_STATUS_TRANSITION: 'VOMS-4221',
  RESUBMISSION_LIMIT_EXCEEDED: 'VOMS-4222',
  WORKFLOW_NOT_COMPLETE: 'VOMS-4223',
  DOCUMENT_EXPIRED: 'VOMS-4224',
  COMPLIANCE_INCOMPLETE: 'VOMS-4225',
} as const;
