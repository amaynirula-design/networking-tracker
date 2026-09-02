import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  buildContactQuery,
  escapeFilterValue,
  isFiltered,
} from '@/lib/contacts/query';

describe('buildContactQuery — defaults', () => {
  it('falls back to newest-first when given nothing', () => {
    expect(buildContactQuery()).toEqual(DEFAULT_QUERY);
  });

  it('ignores an unknown sort field instead of trusting it', () => {
    const q = buildContactQuery({ sort: 'password' });
    expect(q.sort).toBe('created_at');
    expect(q.orderColumn).toBe('created_at');
  });

  it('ignores an unknown priority filter', () => {
    expect(buildContactQuery({ priority: 'urgent' }).priority).toBeNull();
  });

  it('treats any direction other than asc as desc', () => {
    expect(buildContactQuery({ direction: 'asc' }).ascending).toBe(true);
    expect(buildContactQuery({ direction: 'desc' }).ascending).toBe(false);
    expect(buildContactQuery({ direction: 'sideways' }).ascending).toBe(false);
  });
});

describe('buildContactQuery — sorting', () => {
  it('maps priority onto the generated rank column, not the text column', () => {
    // Alphabetical order on `priority` would be high, low, medium — wrong.
    const q = buildContactQuery({ sort: 'priority', direction: 'asc' });
    expect(q.orderColumn).toBe('priority_rank');
    expect(q.ascending).toBe(true);
  });

  it('passes through plain columns unchanged', () => {
    expect(buildContactQuery({ sort: 'name' }).orderColumn).toBe('name');
    expect(buildContactQuery({ sort: 'company' }).orderColumn).toBe('company');
  });
});

describe('buildContactQuery — search', () => {
  it('produces no filter for a blank search', () => {
    expect(buildContactQuery({ search: '   ' }).orFilter).toBeNull();
    expect(buildContactQuery({ search: '' }).search).toBeNull();
  });

  it('searches name, company, role and met_at with wildcards', () => {
    const q = buildContactQuery({ search: 'haas' });
    expect(q.orFilter).toBe(
      'name.ilike."*haas*",company.ilike."*haas*",role.ilike."*haas*",met_at.ilike."*haas*"',
    );
  });

  it('trims the search term', () => {
    expect(buildContactQuery({ search: '  haas  ' }).search).toBe('haas');
  });
});

describe('escapeFilterValue — PostgREST grammar safety', () => {
  it('quotes commas so they cannot split a filter into extra clauses', () => {
    // Unescaped, `a,b` would be read as two separate PostgREST conditions.
    expect(escapeFilterValue('a,b')).toBe('"a,b"');
  });

  it('escapes embedded double quotes and backslashes', () => {
    expect(escapeFilterValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(escapeFilterValue('back\\slash')).toBe('"back\\\\slash"');
  });

  it('keeps a crafted term inside a single clause', () => {
    const q = buildContactQuery({ search: 'x,user_id.neq.zzz' });
    // The whole term stays quoted, so it cannot inject a second condition.
    expect(q.orFilter).toContain('name.ilike."*x,user_id.neq.zzz*"');
    expect(q.orFilter?.split('.ilike.')).toHaveLength(5);
  });
});

describe('isFiltered', () => {
  it('is false for the default view', () => {
    expect(isFiltered(DEFAULT_QUERY)).toBe(false);
  });

  it('is true once a search or priority filter is applied', () => {
    expect(isFiltered(buildContactQuery({ search: 'ada' }))).toBe(true);
    expect(isFiltered(buildContactQuery({ priority: 'high' }))).toBe(true);
  });
});


describe('buildContactQuery — date sorting', () => {
  it('accepts the date columns as sort fields', () => {
    expect(buildContactQuery({ sort: 'met_on' }).orderColumn).toBe('met_on');
    expect(buildContactQuery({ sort: 'follow_up_on' }).orderColumn).toBe(
      'follow_up_on',
    );
  });

  it('keeps empty dates at the bottom in both directions', () => {
    // Postgres puts NULLs first when sorting descending. For columns that are
    // often blank that buries the rows the user actually wants to see, so these
    // always sort nulls last.
    expect(buildContactQuery({ sort: 'follow_up_on', direction: 'asc' }).nullsFirst).toBe(false);
    expect(buildContactQuery({ sort: 'follow_up_on', direction: 'desc' }).nullsFirst).toBe(false);
    expect(buildContactQuery({ sort: 'met_on', direction: 'desc' }).nullsFirst).toBe(false);
  });

  it('leaves never-null columns to the database default ordering', () => {
    expect(buildContactQuery({ sort: 'created_at', direction: 'desc' }).nullsFirst).toBe(true);
    expect(buildContactQuery({ sort: 'created_at', direction: 'asc' }).nullsFirst).toBe(false);
  });
});

describe('buildContactQuery — due follow-ups', () => {
  it('is inactive by default', () => {
    expect(buildContactQuery().dueOnOrBefore).toBeNull();
  });

  it('filters to follow-ups on or before today', () => {
    const q = buildContactQuery({ dueOnly: true, today: '2026-09-02' });
    expect(q.dueOnOrBefore).toBe('2026-09-02');
  });

  it('ignores the flag when no date is supplied, rather than guessing one', () => {
    expect(buildContactQuery({ dueOnly: true }).dueOnOrBefore).toBeNull();
    expect(buildContactQuery({ dueOnly: true, today: '' }).dueOnOrBefore).toBeNull();
  });

  it('counts as a filter for the empty-state copy', () => {
    expect(isFiltered(buildContactQuery({ dueOnly: true, today: '2026-09-02' }))).toBe(true);
  });
});
