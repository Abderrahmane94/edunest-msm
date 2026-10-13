/** The most a list endpoint gives at once. */
export const FULL_PAGE = 100;

/**
 * A whole list, page after page: pickers and client-side tables need every
 * row, not the first hundred. `load` returns one page and the total.
 */
export async function everyPage<T>(load: (page: number) => Promise<{ items: T[]; total: number }>): Promise<{ items: T[]; total: number }> {
  const first = await load(1);
  let items = first.items;
  // Bounded on purpose: a list that never ends would be a bug elsewhere.
  for (let page = 2; items.length < first.total && page <= 100; page++) {
    const next = await load(page);
    if (next.items.length === 0) break;
    items = items.concat(next.items);
  }
  return { items, total: first.total };
}
