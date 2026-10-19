import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../lib/prisma', () => ({
  default: {
    notification: { deleteMany: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));

import prisma from '../../lib/prisma';
import { notificationsController, READ_NOTIFICATION_DAYS } from './notifications.controller';

const db = prisma as unknown as {
  notification: { deleteMany: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
};

function call(params: Record<string, string> = {}, query: Record<string, unknown> = {}) {
  const req = { user: { userId: 'u1' }, params, query } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  const next = vi.fn();
  return { req, res, next };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.notification.findMany.mockResolvedValue([]);
  db.notification.count.mockResolvedValue(0);
});

describe('removing notifications', () => {
  it('removes one of the user’s own notifications only', async () => {
    db.notification.deleteMany.mockResolvedValue({ count: 1 });
    const { req, res } = call({ id: 'n1' });
    await notificationsController.remove(req, res, vi.fn());
    expect(db.notification.deleteMany).toHaveBeenCalledWith({ where: { id: 'n1', userId: 'u1' } });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('someone else’s notification, or one already gone: not found', async () => {
    db.notification.deleteMany.mockResolvedValue({ count: 0 });
    const { req, res } = call({ id: 'n2' });
    await notificationsController.remove(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('clearing removes the read ones, never one not seen yet', async () => {
    db.notification.deleteMany.mockResolvedValue({ count: 4 });
    const { req, res } = call();
    await notificationsController.removeRead(req, res, vi.fn());
    expect(db.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', isRead: true } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { deleted: 4 } }));
  });
});

describe('the list drops old read notifications', () => {
  it(`on opening (page 1): read ones older than ${READ_NOTIFICATION_DAYS} days`, async () => {
    db.notification.deleteMany.mockResolvedValue({ count: 0 });
    const { req, res } = call({}, { page: 1, pageSize: 20 });
    const before = Date.now();
    await notificationsController.list(req, res, vi.fn());
    const where = db.notification.deleteMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'u1', isRead: true });
    const cutoff = where.createdAt.lt.getTime();
    expect(before - cutoff).toBeGreaterThanOrEqual(READ_NOTIFICATION_DAYS * 86_400_000 - 1000);
    expect(before - cutoff).toBeLessThan(READ_NOTIFICATION_DAYS * 86_400_000 + 1000);
  });

  it('not again for the next pages', async () => {
    const { req, res } = call({}, { page: 2, pageSize: 20 });
    await notificationsController.list(req, res, vi.fn());
    expect(db.notification.deleteMany).not.toHaveBeenCalled();
  });
});
