/**
 * Access tokens live 15 minutes and cannot be taken back one by one. When a
 * session must end now (logout, password changed or reset, account
 * deactivated or removed), the moment is noted here and every access token
 * the user was issued up to it is refused.
 *
 * Kept in memory: enough for one server, and a restart only gives back what
 * is left of those 15 minutes. Deactivated and removed accounts are also
 * checked against the database on every request (see tenancy.middleware).
 */
interface Cut {
  /** Seconds: tokens say when they were issued to the second. */
  at: number;
  /** Tokens issued in the second of the cut by a fresh sign-in (or with the cut itself): they stay good. */
  except: Set<string>;
}

const cutoffs = new Map<string, Cut>();

/** Longer than an access token lives: after that, no token from before the cut exists. */
const KEEP_SECONDS = 20 * 60;

const now = (): number => Math.floor(Date.now() / 1000);

/** Ends every session the user has open now, but for `except` when one token is issued in exchange. */
export function cutSessions(userId: string, except?: string): void {
  const at = now();
  cutoffs.set(userId, { at, except: new Set(except ? [except] : []) });
  if (cutoffs.size > 5000) {
    for (const [id, cut] of cutoffs) if (at - cut.at > KEEP_SECONDS) cutoffs.delete(id);
  }
}

/** Whether a token issued at `issuedAt` (seconds) was cut since. */
export function isCut(userId: string, issuedAt: number | undefined, token?: string): boolean {
  const cut = cutoffs.get(userId);
  if (cut === undefined) return false;
  if (now() - cut.at > KEEP_SECONDS) {
    cutoffs.delete(userId);
    return false;
  }
  if (token !== undefined && cut.except.has(token)) return false;
  // Issued in the very second of the cut counts as before it: a token cannot say more precisely.
  return issuedAt === undefined || issuedAt <= cut.at;
}

/**
 * A token just issued on proof of identity (sign-in, session renewal): were
 * the user's sessions cut in this very second, it must not be taken for one
 * of those from before.
 */
export function keepToken(userId: string, token: string): void {
  const cut = cutoffs.get(userId);
  if (cut && cut.at >= now()) cut.except.add(token);
}

/** For tests. */
export function forgetCutoffs(): void {
  cutoffs.clear();
}
