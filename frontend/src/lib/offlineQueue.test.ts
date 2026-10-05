import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory stand-in for IndexedDB.
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
}));

let online = true;
let user: string | null = 'teacher-1';

beforeEach(() => {
  vi.resetModules();
  store.clear();
  online = true;
  user = 'teacher-1';
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  vi.stubGlobal('navigator', {
    get onLine() {
      return online;
    },
  });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === 'user' && user ? JSON.stringify({ id: user }) : null),
  });
});

interface Payload {
  records: { childId: string; status: string }[];
}

async function setup(send: (p: Payload) => Promise<unknown>) {
  const queue = await import('./offlineQueue');
  queue.registerQueueHandler<Payload>('attendance-day', {
    send,
    merge: (older, newer) => ({
      records: [...new Map([...older.records, ...newer.records].map((r) => [r.childId, r])).values()],
    }),
  });
  await queue.startOfflineQueue();
  return queue;
}

const saved = () => (store.get('edunest-offline-queue') as { payload: Payload; error?: string }[]) ?? [];
const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

describe('offlineQueue', () => {
  it('sends right away when online and keeps nothing', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = await setup(send);

    await queue.enqueue('attendance-day', 'attendance:c1:2026-10-05', { records: [{ childId: 'a', status: 'present' }] });
    await flushMicrotasks();

    expect(send).toHaveBeenCalledTimes(1);
    expect(saved()).toEqual([]);
  });

  it('keeps actions while offline and merges saves for the same day', async () => {
    online = false;
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = await setup(send);

    await queue.enqueue('attendance-day', 'attendance:c1:2026-10-05', {
      records: [
        { childId: 'a', status: 'present' },
        { childId: 'b', status: 'present' },
      ],
    });
    await queue.enqueue('attendance-day', 'attendance:c1:2026-10-05', { records: [{ childId: 'b', status: 'absent' }] });

    expect(send).not.toHaveBeenCalled();
    expect(saved()).toHaveLength(1);
    expect(saved()[0].payload.records).toEqual([
      { childId: 'a', status: 'present' },
      { childId: 'b', status: 'absent' },
    ]);

    online = true;
    await queue.flushQueue();
    expect(send).toHaveBeenCalledTimes(1);
    expect(saved()).toEqual([]);
  });

  it('keeps the action when the network fails while sending', async () => {
    const send = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const queue = await setup(send);

    await queue.enqueue('attendance-day', 'k', { records: [{ childId: 'a', status: 'present' }] });
    await flushMicrotasks();

    expect(saved()).toHaveLength(1);
    expect(saved()[0].error).toBeUndefined();
  });

  it('marks an action the server refused, and does not resend it until retried', async () => {
    const queue = await import('./offlineQueue');
    const send = vi.fn().mockRejectedValue(new queue.QueueRejectedError('Classroom not found'));
    await setup(send);

    await queue.enqueue('attendance-day', 'k', { records: [{ childId: 'a', status: 'present' }] });
    await flushMicrotasks();
    expect(saved()[0].error).toBe('Classroom not found');

    await queue.flushQueue();
    expect(send).toHaveBeenCalledTimes(1);

    send.mockResolvedValue(undefined);
    queue.retryAction((store.get('edunest-offline-queue') as { id: string }[])[0].id);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(send).toHaveBeenCalledTimes(2);
    expect(saved()).toEqual([]);
  });

  it("only sends the signed-in user's actions", async () => {
    online = false;
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = await setup(send);
    await queue.enqueue('attendance-day', 'k', { records: [{ childId: 'a', status: 'present' }] });

    user = 'teacher-2';
    online = true;
    await queue.flushQueue();
    expect(send).not.toHaveBeenCalled();

    user = 'teacher-1';
    await queue.flushQueue();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('keeps what the handler reports as a notice', async () => {
    const send = vi.fn().mockResolvedValue({ skipped: ['b'] });
    const queue = await setup(send);

    await queue.enqueue('attendance-day', 'k', { records: [{ childId: 'b', status: 'present' }] });
    await flushMicrotasks();

    expect(store.get('edunest-offline-notices')).toEqual([
      expect.objectContaining({ key: 'k', userId: 'teacher-1', data: { skipped: ['b'] } }),
    ]);
  });
});
