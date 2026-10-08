import { describe, it, expect, vi } from 'vitest';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { errorHandler } from './error.middleware';

function handle(err: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  errorHandler(err as Error, {} as Request, res as unknown as Response, vi.fn());
  return { status: res.status.mock.calls[0][0] as number, body: res.json.mock.calls[0][0] };
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });

describe('errorHandler', () => {
  it('answers 413 FILE_TOO_LARGE for an upload over the limit', () => {
    const { status, body } = handle(new multer.MulterError('LIMIT_FILE_SIZE'));
    expect(status).toBe(413);
    expect(body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('answers 400 INVALID_FILE_TYPE for a refused file type', () => {
    const { status, body } = handle(new Error('Only JPEG, PNG and WebP images are allowed'));
    expect(status).toBe(400);
    expect(body.error).toEqual({ code: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG and WebP images are allowed' });
  });

  it('answers 400 for a malformed JSON body', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 });
    expect(handle(err)).toMatchObject({ status: 400, body: { error: { code: 'INVALID_REQUEST' } } });
  });

  it('turns database duplicates, missing rows and links into 409 / 404', () => {
    expect(handle(prismaError('P2002'))).toMatchObject({ status: 409, body: { error: { code: 'CONFLICT' } } });
    expect(handle(prismaError('P2003'))).toMatchObject({ status: 409, body: { error: { code: 'CONFLICT' } } });
    expect(handle(prismaError('P2025'))).toMatchObject({ status: 404, body: { error: { code: 'NOT_FOUND' } } });
  });

  it('keeps anything else a 500 that reveals nothing in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(handle(new Error('secret detail'))).toMatchObject({
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      });
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
