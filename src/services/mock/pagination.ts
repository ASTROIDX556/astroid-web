import type { ApiMeta, ListQuery } from '@/types/api';

/**
 * List-query semantics for the mock provider.
 *
 * Mirrors the collection endpoints of the live API: search (case-insensitive
 * substring over scalar fields), filter (exact match per field), sort with
 * direction, then page/limit slicing. The pagination envelope matches
 * `ApiMeta` so mock responses are indistinguishable from the real backend's.
 *
 * When a caller omits `page`/`limit` the full collection is returned — the
 * dashboard hooks consume complete datasets — while explicit queries paginate
 * exactly like the live API.
 */

/** Hard ceiling so a huge explicit `limit` cannot be used to bypass paging entirely. */
export const MAX_MOCK_PAGE_LIMIT = 500;

export interface PaginatedResult<T> {
  items: T[];
  meta: ApiMeta;
}

/** Coerce a value to something searchable/sortable without stringifying objects nested twice. */
function comparable(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return JSON.stringify(value) ?? null;
}

function matchesSearch<T>(item: T, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle.length === 0) return true;
  if (typeof item !== 'object' || item === null) {
    return String(item).toLowerCase().includes(needle);
  }
  return Object.values(item as Record<string, unknown>).some((value) => {
    const candidate = comparable(value);
    return candidate !== null && String(candidate).toLowerCase().includes(needle);
  });
}

function matchesFilter<T>(item: T, filter?: Record<string, string>): boolean {
  if (!filter) return true;
  const entries = Object.entries(filter);
  if (entries.length === 0) return true;
  if (typeof item !== 'object' || item === null) return false;
  const record = item as Record<string, unknown>;
  return entries.every(([key, expected]) => {
    const actual = comparable(record[key]);
    return actual !== null && String(actual) === expected;
  });
}

/** Stable sort by a scalar field; nullish values sort last regardless of direction. */
function sortItems<T>(items: T[], sort?: string, order: 'asc' | 'desc' = 'asc'): T[] {
  if (!sort) return items;
  const direction = order === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const left = comparable((a as Record<string, unknown>)[sort]);
    const right = comparable((b as Record<string, unknown>)[sort]);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * direction;
    }
    return String(left).localeCompare(String(right)) * direction;
  });
}

/** Page index helper: invalid/out-of-range values fall back to the first page. */
function readPage(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

/** Page size helper: an explicit valid limit is clamped to the max; otherwise the whole collection is returned. */
function readLimit(value: number | undefined, total: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return Math.max(1, total);
  }
  return Math.min(Math.floor(value), MAX_MOCK_PAGE_LIMIT);
}

/**
 * Apply `ListQuery` semantics to a fixture collection.
 *
 * Edge cases covered:
 * - no page/limit → the full collection with accurate meta;
 * - page beyond the last page → empty slice, totals stay correct;
 * - invalid page/limit → full collection (never NaN or a negative slice index);
 * - sort field missing on some rows → those rows sort last.
 */
export function paginate<T>(items: T[], query: ListQuery = {}): PaginatedResult<T> {
  const filtered = items.filter(
    (item) => matchesSearch(item, query.search ?? '') && matchesFilter(item, query.filter),
  );
  const sorted = sortItems(filtered, query.sort, query.order);

  const page = readPage(query.page);
  const limit = readLimit(query.limit, sorted.length);
  const total = sorted.length;
  const start = (page - 1) * limit;

  return {
    items: sorted.slice(start, start + limit),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
