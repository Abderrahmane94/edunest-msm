/**
 * The app was called EduNest. A choice remembered on this device under the
 * former name is moved to the new one the first time it is read.
 */
export function readRemembered(key: string, formerKey: string): string | null {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
    const former = localStorage.getItem(formerKey);
    if (former !== null) {
      localStorage.setItem(key, former);
      localStorage.removeItem(formerKey);
    }
    return former;
  } catch {
    return null;
  }
}
