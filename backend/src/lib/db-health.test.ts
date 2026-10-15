import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkDatabase, forgetDatabaseCheck } from './db-health';

describe('checkDatabase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    forgetDatabaseCheck();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('says ok when the query answers', async () => {
    expect((await checkDatabase(async () => 1)).ok).toBe(true);
  });

  it('says down when the query fails', async () => {
    expect((await checkDatabase(async () => { throw new Error('refused'); })).ok).toBe(false);
  });

  it('says down when the query hangs past the timeout', async () => {
    const result = checkDatabase(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(5_000);
    expect((await result).ok).toBe(false);
  });

  it('asks the database at most once a minute', async () => {
    const query = vi.fn(async () => 1);
    await checkDatabase(query);
    await checkDatabase(query);
    await Promise.all([checkDatabase(query), checkDatabase(query)]);
    expect(query).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    await checkDatabase(query);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
