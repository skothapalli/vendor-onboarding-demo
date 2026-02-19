import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../utils/errors';

type RequestLocation = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, location: RequestLocation = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = req[location];
      const validated = schema.parse(data);
      req[location] = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.reduce(
          (acc, err) => {
            const path = err.path.join('.');
            acc[path] = err.message;
            return acc;
          },
          {} as Record<string, string>
        );

        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
};

export const validateBody = (schema: ZodSchema) => validate(schema, 'body');
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query');
export const validateParams = (schema: ZodSchema) => validate(schema, 'params');
