import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { errorResponse } from '../utils/response';

/**
 * Creates middleware that validates the request body against a Zod schema.
 * Returns 400 with field-level error messages on validation failure.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Request body validation failed', details),
        );
        return;
      }
      next(error);
    }
  };
}

/**
 * Creates middleware that validates the request query parameters against a Zod schema.
 * Parsed values are assigned back to req.query for downstream use.
 * Returns 400 with field-level error messages on validation failure.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Query parameter validation failed', details),
        );
        return;
      }
      next(error);
    }
  };
}

/**
 * Creates middleware that validates the request route parameters against a Zod schema.
 * Useful for validating UUID format on :id params.
 * Returns 400 with field-level error messages on validation failure.
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Route parameter validation failed', details),
        );
        return;
      }
      next(error);
    }
  };
}
