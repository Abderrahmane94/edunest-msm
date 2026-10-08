import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { errorResponse } from '../utils/response';

/** Messages of the upload filters (multer fileFilter) that refuse a file type. */
const FILE_TYPE_MESSAGES = ['File type not allowed', 'Only JPEG, PNG and WebP images are allowed'];

interface KnownError {
  status: number;
  code: string;
  message: string;
}

/**
 * Errors that are the request's fault or an expected situation, with the
 * answer they deserve (instead of "500 Internal server error").
 */
export function describeKnownError(err: unknown): KnownError | null {
  // Uploads
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return { status: 413, code: 'FILE_TOO_LARGE', message: 'File too large' };
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid file upload' };
  }
  if (err instanceof Error && FILE_TYPE_MESSAGES.includes(err.message)) {
    return { status: 400, code: 'INVALID_FILE_TYPE', message: err.message };
  }

  // Request body (express.json)
  const bodyError = err as { type?: string };
  if (bodyError?.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_REQUEST', message: 'Malformed request body' };
  }
  if (bodyError?.type === 'entity.too.large') {
    return { status: 413, code: 'FILE_TOO_LARGE', message: 'Request too large' };
  }

  // Database
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return { status: 409, code: 'CONFLICT', message: 'This item already exists' };
      case 'P2003':
        return { status: 409, code: 'CONFLICT', message: 'This item is still used elsewhere' };
      case 'P2025':
        return { status: 404, code: 'NOT_FOUND', message: 'The requested resource was not found' };
    }
  }
  return null;
}

/** Last error handler: known errors get their answer, anything else is a 500 (logged). */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const known = describeKnownError(err);
  if (known) {
    if (known.status >= 500) console.error('[Error]', err);
    res.status(known.status).json(errorResponse(known.code, known.message));
    return;
  }

  const statusCode = (err as { statusCode?: number }).statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error';

  console.error('[Error]', err);

  res.status(statusCode).json(errorResponse('INTERNAL_ERROR', message));
}
