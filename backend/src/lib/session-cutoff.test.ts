import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cutSessions, forgetCutoffs, isCut, keepToken } from './session-cutoff';

describe('session cut-off', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T10:00:00Z'));
    forgetCutoffs();
  });
  afterEach(() => vi.useRealTimers());

  const seconds = () => Math.floor(Date.now() / 1000);

  it('lets every token through while nothing was cut', () => {
    expect(isCut('user-1', seconds() - 600)).toBe(false);
  });

  it('refuses the tokens issued before the cut, for that user only', () => {
    const before = seconds() - 60;
    cutSessions('user-1');
    expect(isCut('user-1', before)).toBe(true);
    expect(isCut('user-2', before)).toBe(false);
  });

  it('counts a token issued in the second of the cut as cut, a later one as good', () => {
    cutSessions('user-1');
    expect(isCut('user-1', seconds())).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(isCut('user-1', seconds())).toBe(false);
  });

  it('keeps the one token handed out with the cut', () => {
    cutSessions('user-1', 'new-token');
    expect(isCut('user-1', seconds(), 'new-token')).toBe(false);
    expect(isCut('user-1', seconds(), 'old-token')).toBe(true);
  });

  it('keeps a token from a sign-in made in the second of the cut', () => {
    cutSessions('user-1');
    keepToken('user-1', 'fresh-token');
    expect(isCut('user-1', seconds(), 'fresh-token')).toBe(false);
    expect(isCut('user-1', seconds(), 'stolen-token')).toBe(true);
  });

  it('refuses a token that does not say when it was issued', () => {
    cutSessions('user-1');
    expect(isCut('user-1', undefined)).toBe(true);
  });

  it('forgets a cut once no token from before it can still be alive', () => {
    const before = seconds() - 60;
    cutSessions('user-1');
    vi.advanceTimersByTime(21 * 60 * 1000);
    expect(isCut('user-1', before)).toBe(false);
  });
});
