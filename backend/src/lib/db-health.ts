import prisma from './prisma';

/** One real query a minute at most, however often the check is called. */
const REUSE_MS = 60_000;
const TIMEOUT_MS = 5_000;

export interface DbHealth {
  ok: boolean;
  /** How long the query took, or the timeout. */
  ms: number;
  checkedAt: string;
}

let last: { result: DbHealth; at: number } | null = null;
let running: Promise<DbHealth> | null = null;

async function probe(query: () => Promise<unknown>): Promise<DbHealth> {
  const start = Date.now();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
  });
  try {
    await Promise.race([query(), timeout]);
    return { ok: true, ms: Date.now() - start, checkedAt: new Date().toISOString() };
  } catch (error) {
    console.error('[Kiddoo] Database health check failed:', error instanceof Error ? error.message : error);
    return { ok: false, ms: Date.now() - start, checkedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether the database answers. The answer is reused for a minute, so a
 * monitor (or anyone) calling often neither loads the database nor keeps
 * Neon from sleeping.
 */
export async function checkDatabase(
  query: () => Promise<unknown> = () => prisma.$queryRaw`SELECT 1`,
): Promise<DbHealth> {
  if (last && Date.now() - last.at < REUSE_MS) return last.result;
  if (!running) {
    running = probe(query)
      .then((result) => {
        last = { result, at: Date.now() };
        return result;
      })
      .finally(() => {
        running = null;
      });
  }
  return running;
}

/** For tests. */
export function forgetDatabaseCheck(): void {
  last = null;
  running = null;
}
