import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    order: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn(), groupBy: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('./meta', async (orig) => ({ ...(await orig<typeof import('./meta')>()), sendMetaEvent: vi.fn().mockResolvedValue(true) }));

import prisma from '../../lib/prisma';
import { sendMetaEvent } from './meta';
import { ordersService, amountOf, normalizePhone, orderNumber } from './orders.service';
import { eventOf, phoneForMeta } from './meta';
import { publicOrderSchema } from './orders.routes';

const db = prisma as unknown as { order: Record<string, ReturnType<typeof vi.fn>> };
const meta = sendMetaEvent as unknown as ReturnType<typeof vi.fn>;

const input = {
  plan: 'standard' as const,
  cycle: 'annual' as const,
  directorName: 'Samia Benali',
  nurseryName: 'Les Petits Pas',
  phone: '+213 555 12 34 56',
  wilaya: '16',
  language: 'fr' as const,
  source: 'shopify',
  tracking: { eventId: 'ev-1', fbp: 'fb.1.1.2', utm: { utm_source: 'facebook' } },
};
const request = { ip: '41.100.1.2', userAgent: 'Mozilla/5.0' };

beforeEach(() => {
  vi.clearAllMocks();
  db.order.findFirst.mockResolvedValue(null);
  db.order.create.mockImplementation(async ({ data }) => ({ id: 'o-1', number: 7, ...data }));
});

describe('the amount', () => {
  it('is the server’s: a year costs ten months, the network plan is quoted', () => {
    expect(amountOf('small', 'monthly')).toBe(4900);
    expect(amountOf('standard', 'annual')).toBe(89000);
    expect(amountOf('network', 'monthly')).toBeNull();
  });
});

describe('a phone number', () => {
  it('is written one way, whatever the visitor typed', () => {
    expect(normalizePhone('+213 555 12 34 56')).toBe('0555123456');
    expect(normalizePhone('00213555123456')).toBe('0555123456');
    expect(normalizePhone('0555 12-34-56')).toBe('0555123456');
  });
  it('goes to Meta with the country code', () => {
    expect(phoneForMeta('0555123456')).toBe('213555123456');
  });
});

describe('an order from a landing page', () => {
  it('is saved with the server’s amount, the visitor’s tracking, and sent to Meta as a Lead', async () => {
    const out = await ordersService.createPublic(input, request);
    expect(out).toEqual({ id: 'o-1', number: 'K-0007', duplicate: false });
    const data = db.order.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ amount: 89000, phone: '0555123456', eventId: 'ev-1', fbp: 'fb.1.1.2', ip: '41.100.1.2', utm: { utm_source: 'facebook' } });
    expect(meta).toHaveBeenCalledWith('Lead', expect.objectContaining({ id: 'o-1' }));
  });

  it('pressed twice is saved once', async () => {
    db.order.findFirst.mockResolvedValue({ id: 'o-0', number: 6 });
    const out = await ordersService.createPublic(input, request);
    expect(out).toEqual({ id: 'o-0', number: 'K-0006', duplicate: true });
    expect(db.order.create).not.toHaveBeenCalled();
    expect(meta).not.toHaveBeenCalled();
  });
});

describe('the team’s follow-up', () => {
  const current = { id: 'o-1', number: 7, status: 'contacted', wonAt: null, contactedAt: new Date('2026-11-18'), amount: 8900 };
  beforeEach(() => {
    db.order.findUnique.mockResolvedValue(current);
    db.order.update.mockImplementation(async ({ data }) => ({ ...current, ...data }));
  });

  it('won for the first time: the date is kept and Meta gets the Purchase', async () => {
    const out = await ordersService.update('o-1', { status: 'won' });
    expect(db.order.update.mock.calls[0][0].data.wonAt).toBeInstanceOf(Date);
    expect(meta).toHaveBeenCalledWith('Purchase', current);
    expect(out.reference).toBe('K-0007');
  });

  it('won again: no second Purchase', async () => {
    db.order.findUnique.mockResolvedValue({ ...current, status: 'lost', wonAt: new Date('2026-11-19') });
    await ordersService.update('o-1', { status: 'won' });
    expect(meta).not.toHaveBeenCalled();
  });

  it('an unknown order is a 404', async () => {
    db.order.findUnique.mockResolvedValue(null);
    await expect(ordersService.update('nope', { note: 'x' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('the Meta event', () => {
  const order = { id: 'o-1', directorName: 'Samia Benali', phone: '0555123456', wilaya: '16', amount: 8900, plan: 'standard', eventId: 'ev-1', fbp: 'fb.1', fbc: null, ip: '1.2.3.4', userAgent: 'UA', pageUrl: 'https://danubee.online/p' };
  it('the Lead shares the browser’s event id; personal data is hashed', () => {
    const e = eventOf('Lead', order, new Date('2026-11-18T10:00:00Z'));
    expect(e).toMatchObject({ event_name: 'Lead', event_id: 'ev-1', action_source: 'website', event_source_url: 'https://danubee.online/p', custom_data: { currency: 'DZD', value: 8900 } });
    const user = e.user_data as Record<string, unknown>;
    expect((user.ph as string[])[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(user.client_ip_address).toBe('1.2.3.4');
    expect(JSON.stringify(user)).not.toContain('0555123456');
  });
  it('the Purchase is the platform’s own event', () => {
    expect(eventOf('Purchase', order)).toMatchObject({ event_id: 'purchase-o-1', action_source: 'system_generated' });
  });
});

describe('the public form', () => {
  const body = { plan: 'small', cycle: 'monthly', directorName: 'Samia', phone: '0555123456', wilaya: '16' };
  it('accepts an order without the nursery or the children', () => {
    expect(publicOrderSchema.safeParse(body).success).toBe(true);
  });
  it('refuses a foreign number, a wilaya that does not exist, a made-up utm key', () => {
    expect(publicOrderSchema.safeParse({ ...body, phone: '0612' }).success).toBe(false);
    expect(publicOrderSchema.safeParse({ ...body, wilaya: '59' }).success).toBe(false);
    expect(publicOrderSchema.safeParse({ ...body, tracking: { utm: { evil: 'x' } } }).success).toBe(false);
  });
});

describe('the reference', () => {
  it('reads K-0001', () => expect(orderNumber(1)).toBe('K-0001'));
});

afterEach(() => vi.clearAllMocks());
