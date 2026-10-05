import * as React from 'react';
import { get, set } from 'idb-keyval';

/**
 * Actions saved while offline (or when sending failed for lack of network),
 * kept on the device and sent when the connection returns.
 *
 * - Each action has a `kind` with a registered handler that sends it.
 * - Actions with the same `key` are merged (e.g. attendance for one class and
 *   day): only the latest state needs sending.
 * - Actions belong to the user who made them and are only sent with that
 *   user's session; they survive logout and app restarts.
 * - A network failure keeps the action for later; a rejection by the server
 *   keeps it with its error, for the user to retry or discard.
 */

export interface QueuedAction<P = unknown> {
  id: string;
  kind: string;
  key: string;
  userId: string;
  payload: P;
  queuedAt: string;
  /** Set when the server rejected it. */
  error?: string;
}

/** A sent action whose result the user should know about (e.g. changes not applied). */
export interface SyncNotice {
  id: string;
  kind: string;
  key: string;
  userId: string;
  data: unknown;
  at: string;
}

export interface QueueHandler<P> {
  /**
   * Sends the action. Throws `QueueRejectedError` when the server refuses it;
   * any other error is treated as a network failure (the action is kept).
   * May return notice data to keep for the user.
   */
  send: (payload: P) => Promise<unknown | void>;
  /** Combines a queued action with a newer one for the same key. */
  merge?: (older: P, newer: P) => P;
  /** Runs after a successful send (e.g. refresh cached data). */
  onSent?: (payload: P) => void;
}

/** The server refused the action: retrying as is won't help. */
export class QueueRejectedError extends Error {}

const STORAGE_KEY = 'edunest-offline-queue';
const NOTICES_KEY = 'edunest-offline-notices';

const handlers = new Map<string, QueueHandler<unknown>>();
let actions: QueuedAction[] = [];
let notices: SyncNotice[] = [];
let flushing = false;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  // New arrays so useSyncExternalStore sees the change.
  actions = [...actions];
  notices = [...notices];
  listeners.forEach((l) => l());
}

async function persist() {
  try {
    await Promise.all([set(STORAGE_KEY, actions), set(NOTICES_KEY, notices)]);
  } catch {
    // Storage unavailable (e.g. private mode): the queue still works in memory.
  }
}

function currentUserId(): string | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? ((JSON.parse(raw) as { id?: string }).id ?? null) : null;
  } catch {
    return null;
  }
}

export function registerQueueHandler<P>(kind: string, handler: QueueHandler<P>): void {
  handlers.set(kind, handler as QueueHandler<unknown>);
}

/** Loads the saved queue and sends what can be sent; resends when back online. */
export function startOfflineQueue(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      try {
        actions = ((await get<QueuedAction[]>(STORAGE_KEY)) ?? []).concat(actions);
        notices = ((await get<SyncNotice[]>(NOTICES_KEY)) ?? []).concat(notices);
      } catch {
        // Nothing saved, or storage unavailable.
      }
      emit();
      window.addEventListener('online', () => void flushQueue());
      // Signing in (or a refreshed session) may unlock this user's actions.
      window.addEventListener('auth:login', () => void flushQueue());
      void flushQueue();
    })();
  }
  return loaded;
}

/** Saves an action for later and tries to send it right away. */
export async function enqueue<P>(kind: string, key: string, payload: P): Promise<void> {
  await startOfflineQueue();
  const userId = currentUserId();
  if (!userId) throw new Error('Not signed in');
  const existing = actions.find((a) => a.key === key && a.userId === userId);
  const merge = handlers.get(kind)?.merge;
  const next: QueuedAction = {
    id: existing?.id ?? crypto.randomUUID(),
    kind,
    key,
    userId,
    payload: existing && merge ? merge(existing.payload, payload) : payload,
    queuedAt: new Date().toISOString(),
  };
  actions = existing ? actions.map((a) => (a === existing ? next : a)) : [...actions, next];
  emit();
  await persist();
  void flushQueue();
}

/** Sends the current user's pending actions, in order, while online. */
export async function flushQueue(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  const userId = currentUserId();
  if (!userId) return;
  flushing = true;
  emit();
  try {
    for (const action of actions.filter((a) => a.userId === userId && !a.error)) {
      const handler = handlers.get(action.kind);
      if (!handler) continue;
      try {
        const notice = await handler.send(action.payload);
        actions = actions.filter((a) => a.id !== action.id);
        if (notice) {
          notices = [
            ...notices.filter((n) => n.key !== action.key),
            { id: action.id, kind: action.kind, key: action.key, userId, data: notice, at: new Date().toISOString() },
          ];
        }
        handler.onSent?.(action.payload);
      } catch (err) {
        if (err instanceof QueueRejectedError) {
          actions = actions.map((a) => (a.id === action.id ? { ...a, error: err.message } : a));
        } else {
          // No network (or it dropped mid-way): keep the rest for later.
          break;
        }
      } finally {
        emit();
        await persist();
      }
    }
  } finally {
    flushing = false;
    emit();
  }
}

/** Tries a rejected action again. */
export function retryAction(id: string): void {
  actions = actions.map((a) => (a.id === id ? { ...a, error: undefined } : a));
  emit();
  void persist().then(flushQueue);
}

/** Drops an action (the user gave up on it). */
export function discardAction(id: string): void {
  actions = actions.filter((a) => a.id !== id);
  emit();
  void persist();
}

export function dismissNotice(id: string): void {
  notices = notices.filter((n) => n.id !== id);
  emit();
  void persist();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current user's queued actions and notices, live. */
export function useOfflineQueue(): { actions: QueuedAction[]; notices: SyncNotice[]; syncing: boolean } {
  const all = React.useSyncExternalStore(subscribe, () => actions);
  const allNotices = React.useSyncExternalStore(subscribe, () => notices);
  const syncing = React.useSyncExternalStore(subscribe, () => flushing);
  const userId = currentUserId();
  return React.useMemo(
    () => ({
      actions: all.filter((a) => a.userId === userId),
      notices: allNotices.filter((n) => n.userId === userId),
      syncing,
    }),
    [all, allNotices, syncing, userId],
  );
}
