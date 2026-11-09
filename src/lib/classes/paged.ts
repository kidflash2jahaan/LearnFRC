import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Production's PostgREST answers at most 1000 rows per request (max_rows)
 * and drops the rest without an error, so `.limit(5000)` quietly means 1000.
 * src/lib/queries.ts pages its big reads for the same reason. This pages by
 * id, 1000 rows at a time, until a page comes back short.
 */
export const PAGE_ROWS = 1000;

export type PagedWhere = {
  eq?: Record<string, string>;
  gte?: Record<string, string>;
};

/**
 * Every row a query matches, in id order. `columns` must include `id`.
 * Stops at `maxRows` as a guard. A read error is logged and the rows read so
 * far come back, the way a single read's error gave an empty list before.
 */
export async function allRowsById<T extends { id: number | string }>(
  admin: SupabaseClient,
  table: string,
  columns: string,
  where: PagedWhere,
  maxRows = 100_000
): Promise<T[]> {
  const out: T[] = [];
  let last: number | string | null = null;
  while (out.length < maxRows) {
    let q = admin.from(table).select(columns);
    for (const [k, v] of Object.entries(where.eq ?? {})) q = q.eq(k, v);
    for (const [k, v] of Object.entries(where.gte ?? {})) q = q.gte(k, v);
    if (last !== null) q = q.gt("id", last);
    const { data, error } = await q.order("id", { ascending: true }).limit(PAGE_ROWS);
    if (error) {
      console.error(`paged read of ${table}:`, error.message);
      break;
    }
    const rows = (data ?? []) as unknown as T[];
    out.push(...rows);
    if (rows.length < PAGE_ROWS) break;
    last = rows[rows.length - 1].id;
  }
  return out;
}

/** Every row of one class in `table`, in id order. */
export function allClassRows<T extends { id: number | string }>(
  admin: SupabaseClient,
  table: string,
  columns: string,
  classId: string
): Promise<T[]> {
  return allRowsById<T>(admin, table, columns, { eq: { class_id: classId } });
}
