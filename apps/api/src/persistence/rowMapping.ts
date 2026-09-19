/** Postgres drivers return `timestamptz` as `Date`; the API's wire format is always an ISO string. */
export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

export function toIsoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : toIso(value);
}

/** `jsonb` arrives already parsed from both `pg` and PGlite, but tolerate a JSON string too. */
export function parseJson<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

export function stringArray(value: unknown): string[] {
  const parsed = parseJson<unknown>(value);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === 'string')
    : [];
}
