import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory stand-in for IndexedDB.
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

const post = vi.fn();
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, apiClient: { post: (...args: unknown[]) => post(...args), get: vi.fn() } };
});
vi.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries: vi.fn() } }));

let online = true;

beforeEach(() => {
  vi.resetModules();
  store.clear();
  post.mockReset();
  online = true;
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  vi.stubGlobal('navigator', {
    get onLine() {
      return online;
    },
  });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === 'user' ? JSON.stringify({ id: 'admin-1' }) : null),
  });
});

const payment = (over: Record<string, unknown> = {}) => ({
  clientId: '3f9a2c1e-8a1d-4c9e-9a51-6d3f2f7f1a01',
  branchId: 'branch-1',
  childId: 'child-1',
  childName: 'Yasmine B',
  totalAmount: 5000,
  channel: 'cash' as const,
  valueDate: '2026-10-08',
  allocations: [{ billingPeriodId: 'p1', amount: 5000, label: 'Mensualité (oct. 2026)' }],
  recordedAt: '2026-10-08T09:15:00.000Z',
  recordedByName: 'Amina A',
  ...over,
});

async function setup() {
  const queue = await import('@/lib/offlineQueue');
  const payments = await import('./useOfflinePayments');
  await queue.startOfflineQueue();
  return { queue, payments };
}

const saved = () => (store.get('edunest-offline-queue') as { payload: unknown; error?: string }[]) ?? [];
const notices = () => (store.get('edunest-offline-notices') as { data: Record<string, unknown> }[]) ?? [];
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('offline payments', () => {
  it('names a payment kept on the device by its date and a part of its id', async () => {
    const { payments } = await setup();
    expect(payments.provisionalRef(payment())).toBe('PROV-261008-3F9A');
  });

  it('keeps a payment made offline, then sends it once with its device id and keeps the receipt number', async () => {
    const { queue, payments } = await setup();
    online = false;
    await payments.savePaymentOffline(payment());
    expect(post).not.toHaveBeenCalled();
    expect(saved()).toHaveLength(1);

    online = true;
    post.mockResolvedValue({
      success: true,
      data: { id: 'pay-1', receiptNumber: 'ECO-2026-000123', totalAmount: '5000', valueDate: '2026-10-08' },
    });
    await queue.flushQueue();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe('/payments/records?branchId=branch-1');
    expect(post.mock.calls[0][1]).toMatchObject({
      clientId: '3f9a2c1e-8a1d-4c9e-9a51-6d3f2f7f1a01',
      allocations: [{ billingPeriodId: 'p1', amount: 5000 }],
    });
    expect(saved()).toHaveLength(0);
    expect(notices()[0].data).toMatchObject({ receiptNumber: 'ECO-2026-000123', provisionalRef: 'PROV-261008-3F9A' });
  });

  it('keeps the payment when the server is unreachable', async () => {
    const { queue, payments } = await setup();
    post.mockRejectedValue(new TypeError('Failed to fetch'));

    await payments.savePaymentOffline(payment());
    await flush();
    await queue.flushQueue();

    expect(saved()).toHaveLength(1);
    expect(saved()[0].error).toBeUndefined();
  });

  it('keeps a refused payment "to correct", with the reason the server gave', async () => {
    const { payments } = await setup();
    post.mockResolvedValue({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Allocation amount exceeds…', meta: { reason: 'exceeds_outstanding' } },
    });

    await payments.savePaymentOffline(payment());
    await flush();

    expect(saved()[0].error).toBe('reason:exceeds_outstanding');
    const t = ((key: string) => key) as never;
    expect(payments.paymentRefusalText(t, 'reason:exceeds_outstanding')).toBe(
      'payments.offline.reasons.exceeds_outstanding',
    );
  });

  it('keeps the payment when the session expired, until signed in again', async () => {
    const { payments } = await setup();
    post.mockResolvedValue({ success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } });

    await payments.savePaymentOffline(payment());
    await flush();

    expect(saved()).toHaveLength(1);
    expect(saved()[0].error).toBeUndefined();
  });

  it('never sends a payment without échéances: it waits "to allocate"', async () => {
    const { payments } = await setup();

    await payments.savePaymentOffline(payment({ allocations: [] }));
    await flush();

    expect(post).not.toHaveBeenCalled();
    expect(saved()[0].error).toBe(payments.NEEDS_ALLOCATION);
  });

  it('counts what payments still on the device take from each échéance', async () => {
    const { payments } = await setup();
    const action = (id: string, allocations: { billingPeriodId: string; amount: number }[], error?: string) => ({
      id,
      kind: 'payment',
      key: id,
      userId: 'admin-1',
      queuedAt: '',
      error,
      payload: payment({ allocations: allocations.map((a) => ({ ...a, label: '' })) }),
    });

    const amounts = payments.pendingAmountsByPeriod([
      action('a', [{ billingPeriodId: 'p1', amount: 2000 }]),
      action('b', [{ billingPeriodId: 'p1', amount: 1000 }, { billingPeriodId: 'p2', amount: 500 }]),
      // Refused: not going to the server as is.
      action('c', [{ billingPeriodId: 'p1', amount: 9000 }], 'reason:exceeds_outstanding'),
      // The payment being corrected doesn't count against itself.
      action('d', [{ billingPeriodId: 'p2', amount: 700 }]),
    ], 'd');

    expect(Object.fromEntries(amounts)).toEqual({ p1: 3000, p2: 500 });
  });
});
