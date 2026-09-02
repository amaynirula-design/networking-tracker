import { isPriority, type Priority } from './schema';

/** Sort options offered in the UI. */
export const SORT_FIELDS = ['name', 'company', 'priority', 'created_at'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export const SORT_LABELS: Record<SortField, string> = {
  name: 'Name',
  company: 'Company',
  priority: 'Priority',
  created_at: 'Date added',
};

/**
 * Sorting by `priority` alphabetically would yield high, low, medium — which is
 * meaningless to a user. The table carries a generated `priority_rank` column
 * (high=1, medium=2, low=3) so the database can order it correctly.
 */
const ORDER_COLUMN: Record<SortField, string> = {
  name: 'name',
  company: 'company',
  priority: 'priority_rank',
  created_at: 'created_at',
};

/** Columns the free-text search scans. */
export const SEARCH_COLUMNS = ['name', 'company', 'role', 'met_at'] as const;

export type ContactQuery = {
  search?: string | null;
  priority?: string | null;
  sort?: string | null;
  direction?: string | null;
};

export type ResolvedQuery = {
  search: string | null;
  priority: Priority | null;
  sort: SortField;
  direction: SortDirection;
  /** Convenience for postgrest-js `.order(column, { ascending })`. */
  orderColumn: string;
  ascending: boolean;
  /** Argument for postgrest-js `.or(...)`, or null when there is no search. */
  orFilter: string | null;
};

export const DEFAULT_QUERY: ResolvedQuery = {
  search: null,
  priority: null,
  sort: 'created_at',
  direction: 'desc',
  orderColumn: 'created_at',
  ascending: false,
  orFilter: null,
};

/**
 * Quote a value for the PostgREST filter grammar.
 *
 * `,` `.` `(` `)` and `:` are structural in that grammar, so an unescaped
 * search term such as `a,b` would be parsed as two filter clauses. Wrapping the
 * value in double quotes neutralises them; inside the quotes only `\` and `"`
 * need escaping.
 */
export function escapeFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Normalise untrusted query-string input into a query we can execute. */
export function buildContactQuery(input: ContactQuery = {}): ResolvedQuery {
  const search = typeof input.search === 'string' ? input.search.trim() : '';
  const priority = isPriority(input.priority) ? input.priority : null;

  const sort: SortField = (SORT_FIELDS as readonly string[]).includes(
    input.sort ?? '',
  )
    ? (input.sort as SortField)
    : DEFAULT_QUERY.sort;

  const direction: SortDirection = input.direction === 'asc' ? 'asc' : 'desc';

  let orFilter: string | null = null;
  if (search !== '') {
    const term = escapeFilterValue(`*${search}*`);
    orFilter = SEARCH_COLUMNS.map((col) => `${col}.ilike.${term}`).join(',');
  }

  return {
    search: search === '' ? null : search,
    priority,
    sort,
    direction,
    orderColumn: ORDER_COLUMN[sort],
    ascending: direction === 'asc',
    orFilter,
  };
}

/** True when the user has narrowed the list — drives "no results" vs "no contacts". */
export function isFiltered(query: ResolvedQuery): boolean {
  return query.search !== null || query.priority !== null;
}
