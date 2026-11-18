import { OrderStatus, Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { sendMetaEvent } from './meta';

export class OrderServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'OrderServiceError';
  }
}

/** The monthly price of each plan, in DA (the network plan is quoted). A year costs ten months. */
export const PLAN_MONTHLY: Record<string, number | null> = { small: 4900, standard: 8900, network: null };
export const ANNUAL_MONTHS = 10;

export function amountOf(plan: string, cycle: string): number | null {
  const monthly = PLAN_MONTHLY[plan];
  if (monthly == null) return null;
  return cycle === 'annual' ? monthly * ANNUAL_MONTHS : monthly;
}

/** An Algerian number written one way (0555123456), whatever the visitor typed. */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00213')) digits = '0' + digits.slice(5);
  else if (digits.startsWith('213') && digits.length === 12) digits = '0' + digits.slice(3);
  return digits;
}

export const orderNumber = (n: number): string => `K-${String(n).padStart(4, '0')}`;

export interface PublicOrderInput {
  plan: 'small' | 'standard' | 'network';
  cycle: 'monthly' | 'annual';
  directorName: string;
  nurseryName?: string;
  phone: string;
  wilaya: string;
  childrenCount?: number;
  language: 'fr' | 'ar';
  source?: string;
  tracking?: { eventId?: string; fbp?: string; fbc?: string; pageUrl?: string; utm?: Record<string, string> };
}

export interface RequestInfo {
  ip: string | null;
  userAgent: string | null;
}

/** The same phone, the same plan, a few minutes apart: the visitor pressed twice. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const listSelect = {
  id: true, number: true, status: true, plan: true, cycle: true, amount: true, directorName: true, nurseryName: true,
  phone: true, wilaya: true, childrenCount: true, language: true, note: true, source: true, utm: true,
  contactedAt: true, wonAt: true, createdAt: true,
} satisfies Prisma.OrderSelect;

export const ordersService = {
  /** An order from a landing page. Its amount is the server's, never the page's. */
  async createPublic(input: PublicOrderInput, request: RequestInfo) {
    const phone = normalizePhone(input.phone);
    const recent = await prisma.order.findFirst({
      where: { phone, plan: input.plan, cycle: input.cycle, createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } },
      select: { id: true, number: true },
    });
    if (recent) return { id: recent.id, number: orderNumber(recent.number), duplicate: true };

    const t = input.tracking ?? {};
    const order = await prisma.order.create({
      data: {
        plan: input.plan,
        cycle: input.plan === 'network' ? 'monthly' : input.cycle,
        amount: amountOf(input.plan, input.cycle),
        directorName: input.directorName,
        nurseryName: input.nurseryName || null,
        phone,
        wilaya: input.wilaya,
        childrenCount: input.childrenCount ?? null,
        language: input.language,
        source: input.source || null,
        pageUrl: t.pageUrl || null,
        utm: t.utm && Object.keys(t.utm).length ? t.utm : undefined,
        eventId: t.eventId || null,
        fbp: t.fbp || null,
        fbc: t.fbc || null,
        ip: request.ip,
        userAgent: request.userAgent,
      },
    });
    // The server's copy of the browser's Lead (same event id): not awaited, the visitor does not wait for Meta.
    void sendMetaEvent('Lead', order);
    return { id: order.id, number: orderNumber(order.number), duplicate: false };
  },

  async list(status?: OrderStatus) {
    const rows = await prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: listSelect,
    });
    const counts = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
    return {
      orders: rows.map((o) => ({ ...o, reference: orderNumber(o.number) })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<OrderStatus, number>>,
    };
  },

  /** The team's follow-up: the status and its note. Won for the first time: Meta gets the Purchase. */
  async update(id: string, input: { status?: OrderStatus; note?: string | null }) {
    const current = await prisma.order.findUnique({ where: { id } });
    if (!current) throw new OrderServiceError('Order not found', 404);
    const now = new Date();
    const data: Prisma.OrderUpdateInput = {};
    if (input.note !== undefined) data.note = input.note?.trim() || null;
    if (input.status && input.status !== current.status) {
      data.status = input.status;
      if (input.status === 'contacted' && !current.contactedAt) data.contactedAt = now;
      if (input.status === 'won' && !current.wonAt) data.wonAt = now;
    }
    const order = await prisma.order.update({ where: { id }, data, select: listSelect });
    if (input.status === 'won' && !current.wonAt) await sendMetaEvent('Purchase', current);
    return { ...order, reference: orderNumber(order.number) };
  },
};
