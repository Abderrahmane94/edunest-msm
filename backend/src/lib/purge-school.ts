import type { Prisma } from '@prisma/client';
import prisma from './prisma';

/**
 * Erases a school for good: every row that belongs to it, in every table,
 * found by following the database's own links (foreign keys) from the school
 * and from each table's school_id. Nothing is listed by hand, so a table added
 * later is erased too. One transaction: all of it, or nothing.
 *
 * Refuses, and erases nothing, if a row it reaches belongs to another school
 * or to nobody (a link it does not expect).
 */

export class PurgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurgeError';
  }
}

interface Link {
  table: string;
  column: string;
  parent: string;
}

/** Tables that point at a school's rows without a foreign key: erased with what they point at. */
const UNLINKED: Array<{ table: string; column: string; parent: string }> = [
  { table: 'payment_audit_entries', column: 'payment_record_id', parent: 'payment_records' },
  { table: 'payment_audit_entries', column: 'branch_id', parent: 'branches' },
];

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function links(tx: Pick<Prisma.TransactionClient, '$queryRawUnsafe'>): Promise<{ links: Link[]; withSchoolId: string[] }> {
  const fks = await tx.$queryRawUnsafe<Array<{ table: string; column: string; parent: string; cols: number }>>(`
    SELECT c.conrelid::regclass::text AS table, a.attname AS column, c.confrelid::regclass::text AS parent,
           array_length(c.conkey, 1) AS cols
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f' AND n.nspname = current_schema()`);
  if (fks.some((f) => Number(f.cols) !== 1)) throw new PurgeError('A link over several columns: not handled');
  const tables = await tx.$queryRawUnsafe<Array<{ table: string }>>(`
    SELECT c.relname AS table FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'school_id' AND NOT a.attisdropped
    WHERE n.nspname = current_schema() AND c.relkind = 'r'`);
  const unquote = (t: string) => t.replace(/^"|"$/g, '');
  return {
    links: [...fks.map((f) => ({ table: unquote(f.table), column: f.column, parent: unquote(f.parent) })), ...UNLINKED],
    withSchoolId: tables.map((t) => t.table),
  };
}

/** Children before parents, so nothing still points at a row when it goes. */
function deletionOrder(tables: string[], graph: Link[]): string[] {
  const inSet = new Set(tables);
  const edges = graph.filter((l) => l.table !== l.parent && inSet.has(l.table) && inSet.has(l.parent));
  const order: string[] = [];
  const left = new Set(tables);
  while (left.size) {
    // A table can go when no table still left points at it.
    const ready = [...left].filter((t) => !edges.some((e) => e.parent === t && left.has(e.table)));
    if (!ready.length) throw new PurgeError(`Linked in a circle: ${[...left].join(', ')}`);
    for (const t of ready.sort()) {
      order.push(t);
      left.delete(t);
    }
  }
  return order;
}

export async function purgeSchool(schoolId: string): Promise<Record<string, number>> {
  return prisma.$transaction(
    async (tx) => {
      const { links: graph, withSchoolId } = await links(tx);
      const rows = new Map<string, Set<string>>([['schools', new Set([schoolId])]]);
      const add = (table: string, ids: string[]) => {
        const set = rows.get(table) ?? new Set<string>();
        let added = 0;
        for (const id of ids) if (!set.has(id)) (set.add(id), added++);
        rows.set(table, set);
        return added;
      };

      // Every row carrying the school's id…
      for (const table of withSchoolId) {
        const found = await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id::text AS id FROM ${q(table)} WHERE school_id::text = $1`, schoolId);
        add(table, found.map((r) => r.id));
      }
      // …then every row pointing at one of those, until nothing new is found.
      for (let changed = true; changed; ) {
        changed = false;
        for (const link of graph) {
          const parents = rows.get(link.parent);
          if (!parents?.size) continue;
          const found = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT id::text AS id FROM ${q(link.table)} WHERE ${q(link.column)}::text = ANY($1::text[])`,
            [...parents],
          );
          if (add(link.table, found.map((r) => r.id))) changed = true;
        }
      }

      // Nothing of another school, nor of the platform (a super admin has no school).
      for (const table of withSchoolId) {
        const ids = [...(rows.get(table) ?? [])];
        if (!ids.length) continue;
        const [other] = await tx.$queryRawUnsafe<Array<{ n: number }>>(
          `SELECT count(*)::int AS n FROM ${q(table)} WHERE id::text = ANY($1::text[]) AND school_id::text IS DISTINCT FROM $2`,
          ids,
          schoolId,
        );
        if (other.n > 0) throw new PurgeError(`${other.n} row(s) of ${table} reached that are not this school's`);
      }

      const counts: Record<string, number> = {};
      for (const table of deletionOrder([...rows.keys()].filter((t) => rows.get(t)!.size), graph)) {
        const ids = [...rows.get(table)!];
        const n = await tx.$executeRawUnsafe(`DELETE FROM ${q(table)} WHERE id::text = ANY($1::text[])`, ids);
        if (n) counts[table] = n;
      }
      return counts;
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}
